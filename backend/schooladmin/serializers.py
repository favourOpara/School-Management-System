from rest_framework import serializers
from .models import FeeStructure, StudentFeeRecord
from users.models import CustomUser
from academics.models import Class


class FeeStructureSerializer(serializers.ModelSerializer):
    classes = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Class.objects.all()
    )
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        model = FeeStructure
        fields = '__all__'

    def create(self, validated_data):
        classes = validated_data.pop('classes')
        fee = FeeStructure.objects.create(**validated_data)
        fee.classes.set(classes)

        for class_obj in classes:
            # Ensure class_obj is a real Class instance
            if isinstance(class_obj, int):
                class_obj = Class.objects.get(pk=class_obj)

            students = CustomUser.objects.filter(
                role='student',
                classroom=class_obj,
                academic_year=fee.academic_year
            )
            for student in students:
                StudentFeeRecord.objects.create(
                    student=student,
                    fee_structure=fee,
                    payment_status='UNPAID',
                )

        return fee

    def update(self, instance, validated_data):
        classes = validated_data.pop('classes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if classes is not None:
            instance.classes.set(classes)
        return instance


class StudentFeeRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_name = serializers.CharField(source='fee_structure.name', read_only=True)

    class Meta:
        model = StudentFeeRecord
        fields = [
            'id',
            'student',
            'student_name',
            'fee_structure',
            'fee_name',
            'amount_paid',
            'date_paid',
            'payment_status'
        ]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"


class FeeStudentSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    full_name = serializers.CharField()
    username = serializers.CharField()
    classroom = serializers.CharField(allow_null=True)
    academic_year = serializers.CharField()
    fee_name = serializers.CharField()
    fee_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2)
    outstanding = serializers.DecimalField(max_digits=10, decimal_places=2)

