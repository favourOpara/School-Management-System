from rest_framework import serializers
from .models import SessionCalendar, SchoolDay, HolidayLabel


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
