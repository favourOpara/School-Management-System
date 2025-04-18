# academics/serializers.py
from rest_framework import serializers
from .models import ClassRoom
import re

class ClassRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassRoom
        fields = ['id', 'name', 'description', 'academic_year', 'term']

    def validate_academic_year(self, value):
        """
        Validates that academic_year is in YYYY/YYYY format and consecutive.
        """
        pattern = r'^(\d{4})\/(\d{4})$'
        match = re.match(pattern, value)
        if not match:
            raise serializers.ValidationError('Academic year must be in format YYYY/YYYY.')

        start, end = int(match.group(1)), int(match.group(2))
        if end != start + 1:
            raise serializers.ValidationError('Second year must be exactly one year after the first.')

        return value
