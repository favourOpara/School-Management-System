from rest_framework import serializers
from .models import (
    SessionCalendar, SchoolDay, HolidayLabel, AttendanceRecord,
    AttendanceCalendar, AttendanceSchoolDay, AttendanceHolidayLabel
)
from users.models import CustomUser
from academics.models import Subject, ClassSession


# ORIGINAL ATTENDANCE SERIALIZERS
class HolidayLabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = HolidayLabel
        fields = ['id', 'label']


class SchoolDaySerializer(serializers.ModelSerializer):
    holiday_label = HolidayLabelSerializer(required=False, allow_null=True)

    class Meta:
        model = SchoolDay
        fields = ['id', 'date', 'is_school_day', 'holiday_label']


class SessionCalendarSerializer(serializers.ModelSerializer):
    school_days = SchoolDaySerializer(many=True, read_only=True)

    class Meta:
        model = SessionCalendar
        fields = ['id', 'academic_year', 'term', 'created_at', 'school_days']


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    marked_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'subject', 'subject_name',
            'school_day', 'marked_by', 'marked_by_name', 'marked_at'
        ]
        read_only_fields = ['marked_by', 'marked_at']
    
    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"
    
    def get_marked_by_name(self, obj):
        if obj.marked_by:
            return f"{obj.marked_by.first_name} {obj.marked_by.last_name}"
        return None
    
    def create(self, validated_data):
        validated_data['marked_by'] = self.context['request'].user
        return super().create(validated_data)


# ATTENDANCE CALENDAR SERIALIZERS (for React components)
class AttendanceHolidayLabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceHolidayLabel
        fields = ['id', 'date', 'label', 'holiday_type']


class AttendanceSchoolDaySerializer(serializers.ModelSerializer):
    holiday_label = AttendanceHolidayLabelSerializer(required=False, allow_null=True)

    class Meta:
        model = AttendanceSchoolDay
        fields = ['id', 'date', 'day_type', 'holiday_label']


class AttendanceCalendarSerializer(serializers.ModelSerializer):
    school_days = AttendanceSchoolDaySerializer(many=True, read_only=True)
    holidays = AttendanceHolidayLabelSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    total_school_days = serializers.ReadOnlyField(source='get_total_school_days')
    total_holidays = serializers.ReadOnlyField(source='get_total_holidays')
    
    class Meta:
        model = AttendanceCalendar
        fields = [
            'id', 'academic_year', 'term', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'school_days', 'holidays',
            'total_school_days', 'total_holidays', 'class_sessions'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}"
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)