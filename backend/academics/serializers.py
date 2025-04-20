from rest_framework import serializers
from .models import Class, ClassSession, Subject
from users.models import CustomUser
import re

# 🔹 Serializer for Permanent Class (e.g., J.S.S.1, S.S.S.3)
class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'name', 'description']


# 🔹 Serializer for Academic Class Session (flattened for frontend compatibility)
class ClassSessionSerializer(serializers.ModelSerializer):
    classroom = ClassSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(),
        source='classroom',
        write_only=True
    )
    name = serializers.CharField(source='classroom.name', read_only=True)

    class Meta:
        model = ClassSession
        fields = ['id', 'name', 'academic_year', 'term', 'classroom', 'classroom_id']

    def validate_academic_year(self, value):
        pattern = r'^(\d{4})\/(\d{4})$'
        match = re.match(pattern, value)
        if not match:
            raise serializers.ValidationError("Academic year must be in format YYYY/YYYY.")
        start, end = int(match.group(1)), int(match.group(2))
        if end != start + 1:
            raise serializers.ValidationError("Second year must be exactly one year after the first.")
        return value


# 🔹 Serializer for Subject creation (linked to class session + teacher)
class SubjectSerializer(serializers.ModelSerializer):
    class_session = serializers.PrimaryKeyRelatedField(
        queryset=ClassSession.objects.all()
    )
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role='teacher')
    )

    class Meta:
        model = Subject
        fields = ['id', 'name', 'class_session', 'teacher']

    def validate_teacher(self, teacher):
        if teacher.role != 'teacher':
            raise serializers.ValidationError("Assigned user must be a teacher.")
        return teacher
