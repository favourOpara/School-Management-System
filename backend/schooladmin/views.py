from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import generics, status
from rest_framework.views import APIView

from .models import FeeStructure, StudentFeeRecord
from .serializers import FeeStructureSerializer, StudentFeeRecordSerializer
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
        try:
            fee = FeeStructure.objects.get(id=fee_id)
        except FeeStructure.DoesNotExist:
            return Response({"detail": "Fee structure not found."},
                            status=status.HTTP_404_NOT_FOUND)

        students = CustomUser.objects.filter(
            role='student',
            classroom__in=fee.classes.all()
        )

        grouped = {}
        for student in students:
            cls = student.classroom
            if not cls:
                continue

            cid = cls.id
            cname = cls.name

            # Fetch or create record
            rec, _ = StudentFeeRecord.objects.get_or_create(
                student=student,
                fee_structure=fee,
                defaults={"amount_paid": 0, "payment_status": "UNPAID"}
            )

            paid_amt = rec.amount_paid
            outstanding = fee.amount - paid_amt

            # update status if needed
            if paid_amt >= fee.amount and rec.payment_status != 'PAID':
                rec.payment_status = 'PAID'
                rec.save(update_fields=['payment_status'])

            if cid not in grouped:
                grouped[cid] = {
                    "classId": cid,
                    "className": cname,
                    "students": [],
                    "paid": 0,
                    "outstanding": 0,
                }

            grouped[cid]["students"].append({
                "record_id": rec.id,
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.last_name}",
                "username": student.username,
                "academic_year": student.academic_year,
                "fee_name": fee.name,
                "fee_amount": fee.amount,
                "amount_paid": paid_amt,
                "outstanding": outstanding,
                "payment_status": rec.payment_status,
            })

            grouped[cid]["paid"] += paid_amt
            grouped[cid]["outstanding"] += outstanding

        return Response(list(grouped.values()))


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_fee_payment(request, record_id):
    try:
        rec = StudentFeeRecord.objects.get(id=record_id)
    except StudentFeeRecord.DoesNotExist:
        return Response({"detail": "Fee record not found."},
                        status=status.HTTP_404_NOT_FOUND)

    amt = request.data.get("amount_paid")
    if amt is None:
        return Response({"detail": "amount_paid is required."},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        amt = float(amt)
    except ValueError:
        return Response({"detail": "amount_paid must be a number."},
                        status=status.HTTP_400_BAD_REQUEST)

    rec.amount_paid = amt
    rec.payment_status = 'PAID' if amt >= rec.fee_structure.amount else 'UNPAID'
    rec.save(update_fields=['amount_paid', 'payment_status'])

    serializer = StudentFeeRecordSerializer(rec)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def fee_dashboard_view(request):
    academic_year = request.GET.get('academic_year')
    term = request.GET.get('term')

    if not academic_year or not term:
        return Response({"detail": "Missing academic_year or term."}, status=400)

    fees = FeeStructure.objects.filter(academic_year=academic_year, term=term)
    response_data = []

    for fee in fees:
        students = CustomUser.objects.filter(role='student', classroom__in=fee.classes.all())
        grouped = {}

        for student in students:
            cls = student.classroom
            if not cls:
                continue

            cid = cls.id
            cname = cls.name

            rec, _ = StudentFeeRecord.objects.get_or_create(
                student=student,
                fee_structure=fee,
                defaults={"amount_paid": 0, "payment_status": "UNPAID"}
            )

            paid_amt = rec.amount_paid
            outstanding = fee.amount - paid_amt

            if paid_amt >= fee.amount and rec.payment_status != 'PAID':
                rec.payment_status = 'PAID'
                rec.save(update_fields=['payment_status'])

            if cid not in grouped:
                grouped[cid] = {
                    "classId": cid,
                    "className": cname,
                    "fee_structure_id": fee.id,
                    "students": [],
                    "paid": 0,
                    "outstanding": 0,
                }

            grouped[cid]["students"].append({
                "record_id": rec.id,
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.last_name}",
                "username": student.username,
                "academic_year": student.academic_year,
                "fee_name": fee.name,
                "fee_amount": fee.amount,
                "amount_paid": paid_amt,
                "outstanding": outstanding,
                "payment_status": rec.payment_status,
            })

            grouped[cid]["paid"] += paid_amt
            grouped[cid]["outstanding"] += outstanding

        response_data.extend(grouped.values())

    return Response(response_data)
