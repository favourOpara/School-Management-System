from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from academics.models import Subject, ClassSession

TERM_CHOICES = [
    ('First Term', 'First Term'),
    ('Second Term', 'Second Term'),
    ('Third Term', 'Third Term'),
]

# ORIGINAL ATTENDANCE MODELS
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


# ATTENDANCE CALENDAR MODELS (for ViewAttendance and EditAttendanceCalendar components)
class AttendanceCalendar(models.Model):
    """
    Stores the attendance calendar setup for each academic session
    Used by ViewAttendance and EditAttendanceCalendar React components
    """
    TERM_CHOICES = [
        ("First Term", "First Term"),
        ("Second Term", "Second Term"),
        ("Third Term", "Third Term"),
    ]
    
    academic_year = models.CharField(max_length=9)  # e.g. '2024/2025'
    term = models.CharField(max_length=20, choices=TERM_CHOICES)
    
    # Link to all class sessions for this academic year/term
    class_sessions = models.ManyToManyField(
        ClassSession,
        related_name='attendance_calendars',
        help_text="Class sessions this calendar applies to"
    )
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'admin'}
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('academic_year', 'term')
        ordering = ['-academic_year', 'term']
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Auto-link to matching class sessions if not already linked
        if not self.class_sessions.exists():
            matching_sessions = ClassSession.objects.filter(
                academic_year=self.academic_year,
                term=self.term
            )
            self.class_sessions.set(matching_sessions)
    
    def get_total_school_days(self):
        """Get total number of school days in this calendar"""
        return self.school_days.count()
    
    def get_total_holidays(self):
        """Get total number of holidays in this calendar"""
        return self.holidays.count()
    
    def is_school_day(self, date):
        """Check if a given date is a school day"""
        return self.school_days.filter(date=date).exists()
    
    def is_holiday(self, date):
        """Check if a given date is a holiday"""
        return self.holidays.filter(date=date).exists()
    
    def __str__(self):
        return f"Calendar: {self.academic_year} - {self.term}"


class AttendanceSchoolDay(models.Model):
    """
    Individual school days within an attendance calendar
    """
    calendar = models.ForeignKey(
        AttendanceCalendar,
        on_delete=models.CASCADE,
        related_name='school_days'
    )
    date = models.DateField()
    
    # Optional: Track if this is a special type of school day
    day_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type of school day (e.g., 'Regular', 'Exam Day', 'Half Day')"
    )
    
    class Meta:
        unique_together = ('calendar', 'date')
        ordering = ['date']
    
    def __str__(self):
        return f"{self.calendar} - {self.date} ({self.day_type or 'Regular'})"


class AttendanceHolidayLabel(models.Model):
    """
    Holiday labels that can be applied to dates
    """
    calendar = models.ForeignKey(
        AttendanceCalendar,
        on_delete=models.CASCADE,
        related_name='holidays'
    )
    date = models.DateField()
    label = models.CharField(max_length=100)
    
    # Optional: Holiday type for better categorization
    holiday_type = models.CharField(
        max_length=50,
        blank=True,
        choices=[
            ('public', 'Public Holiday'),
            ('religious', 'Religious Holiday'),
            ('school', 'School Holiday'),
            ('break', 'Term Break'),
            ('other', 'Other'),
        ],
        default='public'
    )
    
    class Meta:
        unique_together = ('calendar', 'date')
        ordering = ['date']
    
    def __str__(self):
        return f"{self.label} - {self.date} ({self.get_holiday_type_display()})"