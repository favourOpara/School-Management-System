# views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import generics, status
from rest_framework.views import APIView

from .models import FeeStructure, StudentFeeRecord
from .serializers import (
    FeeStructureSerializer,
    StudentFeeRecordSerializer
)
from users.views import IsAdminRole
from users.models import CustomUser


class CreateFeeStructureView(generics.CreateAPIView):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


class ListFeeStructuresView(generics.ListAPIView):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


class UpdateFeeStructureView(generics.RetrieveUpdateAPIView):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'


class DeleteFeeStructureView(generics.DestroyAPIView):
    queryset = FeeStructure.objects.all()
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'


class ListStudentFeeRecordsView(generics.ListAPIView):
    queryset = StudentFeeRecord.objects.all()
    serializer_class = StudentFeeRecordSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        fee_id = self.request.query_params.get('fee_id')
        if fee_id:
            return self.queryset.filter(fee_structure_id=fee_id)
        return self.queryset


class FeeStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request, fee_id):
        # 1) Fetch the FeeStructure
        try:
            fee = FeeStructure.objects.get(id=fee_id)
        except FeeStructure.DoesNotExist:
            return Response(
                {"detail": "Fee structure not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 2) For every student in those classes, ensure a record exists:
        students = CustomUser.objects.filter(
            role='student',
            classroom__in=fee.classes.all()
        )

        grouped = {}
        for student in students:
            cls = student.classroom
            cid = cls.id if cls else 0
            cname = cls.name if cls else "Unknown Class"

            # get or create the StudentFeeRecord
            record, _ = StudentFeeRecord.objects.get_or_create(
                student=student,
                fee_structure=fee,
                defaults={'payment_status': 'UNPAID', 'amount_paid': 0}
            )

            # compute outstanding
            paid_amt = record.amount_paid
            outstanding_amt = fee.amount - paid_amt

            # init class bucket
            if cid not in grouped:
                grouped[cid] = {
                    "classId": cid,
                    "className": cname,
                    "students": [],
                    "paid": 0.0,
                    "outstanding": 0.0,
                }

            # append this student
            grouped[cid]["students"].append({
                "record_id":      record.id,
                "student_id":     student.id,
                "full_name":      f"{student.first_name} {student.last_name}",
                "username":       student.username,
                "academic_year":  student.academic_year,
                "fee_name":       fee.name,
                "fee_amount":     float(fee.amount),
                "amount_paid":    float(paid_amt),
                "outstanding":    float(outstanding_amt),
                "payment_status": record.payment_status,
            })

            grouped[cid]["paid"]        += float(paid_amt)
            grouped[cid]["outstanding"] += float(outstanding_amt)

        return Response(list(grouped.values()))


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_fee_payment(request, record_id):
    # 1) fetch record
    try:
        record = StudentFeeRecord.objects.get(id=record_id)
    except StudentFeeRecord.DoesNotExist:
        return Response(
            {"detail": "Fee record not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    # 2) validate input
    amt = request.data.get("amount_paid")
    if amt is None:
        return Response(
            {"detail": "amount_paid is required."},
            status=status.HTTP_400_BAD_REQUEST
        )
    try:
        amt = float(amt)
    except (TypeError, ValueError):
        return Response(
            {"detail": "amount_paid must be a valid number."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3) update both amount_paid *and* payment_status
    record.amount_paid = amt
    record.payment_status = "PAID" if amt >= record.fee_structure.amount else "UNPAID"
    record.save()

    # 4) return the updated record
    serialized = StudentFeeRecordSerializer(record)
    return Response(serialized.data, status=status.HTTP_200_OK)
