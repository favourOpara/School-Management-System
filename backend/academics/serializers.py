from rest_framework import serializers
from .models import Class, ClassSession, Subject
from users.models import CustomUser
import re


class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'name', 'description']


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


class SubjectSerializer(serializers.ModelSerializer):
    class_session = ClassSessionSerializer(read_only=True)  # used in GET
    class_session_id = serializers.PrimaryKeyRelatedField(  # used in POST/PUT
        queryset=ClassSession.objects.all(),
        source='class_session',
        write_only=True
    )
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role='teacher')
    )

    class Meta:
        model = Subject
        fields = ['id', 'name', 'class_session', 'class_session_id', 'teacher', 'department']

    def validate_teacher(self, teacher):
        if teacher.role != 'teacher':
            raise serializers.ValidationError("Assigned user must be a teacher.")
        return teacher
