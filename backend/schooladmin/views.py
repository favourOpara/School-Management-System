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
            return Response({"detail": "Fee structure not found."}, status=status.HTTP_404_NOT_FOUND)

        students = CustomUser.objects.filter(role='student', classroom__in=fee.classes.all())
        grouped_data = {}

        for student in students:
            class_name = student.classroom.name if student.classroom else "Unknown Class"
            class_id = student.classroom.id if student.classroom else 0

            record = StudentFeeRecord.objects.filter(student=student, fee_structure=fee).first()
            paid_amount = record.amount_paid if record else 0
            outstanding = fee.amount - paid_amount

            if class_id not in grouped_data:
                grouped_data[class_id] = {
                    "classId": class_id,
                    "className": class_name,
                    "students": [],
                    "paid": 0,
                    "outstanding": 0,
                }

            grouped_data[class_id]["students"].append({
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.last_name}",
                "username": student.username,
                "academic_year": student.academic_year,
                "fee_name": fee.name,
                "fee_amount": fee.amount,
                "amount_paid": paid_amount,
                "outstanding": outstanding,
                "payment_status": record.payment_status if record else "UNPAID",
            })

            grouped_data[class_id]["paid"] += paid_amount
            grouped_data[class_id]["outstanding"] += outstanding

        return Response(list(grouped_data.values()))
