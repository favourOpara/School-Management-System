from django.db import models

TERM_CHOICES = [
    ('First Term', 'First Term'),
    ('Second Term', 'Second Term'),
    ('Third Term', 'Third Term'),
]

class SessionCalendar(models.Model):
    academic_year = models.CharField(max_length=20)
    term = models.CharField(max_length=20, choices=TERM_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['academic_year', 'term']

    def __str__(self):
        return f"{self.academic_year} - {self.term}"


class SchoolDay(models.Model):
    session = models.ForeignKey(SessionCalendar, on_delete=models.CASCADE, related_name='school_days')
    date = models.DateField()
    is_school_day = models.BooleanField(default=True)  # False means it's a holiday

    class Meta:
        unique_together = ['session', 'date']
        ordering = ['date']

    def __str__(self):
        return f"{self.date} ({'School Day' if self.is_school_day else 'Holiday'})"


class HolidayLabel(models.Model):
    school_day = models.OneToOneField(SchoolDay, on_delete=models.CASCADE, related_name='holiday_label')
    label = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.school_day.date} - {self.label}"

from django.conf import settings
from academics.models import Subject  # Adjust import as needed

class AttendanceRecord(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendance_records')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='attendance_records')
    school_day = models.ForeignKey(SchoolDay, on_delete=models.CASCADE, related_name='attendance_records')
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='marked_attendance')
    marked_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'subject', 'school_day']

    def __str__(self):
        return f"{self.student.get_full_name()} - {self.subject.name} - {self.school_day.date}"
