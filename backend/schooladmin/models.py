from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from academics.models import Class, ClassSession
from decimal import Decimal


class FeeStructure(models.Model):
    TERM_CHOICES = [
        ("First Term", "First Term"),
        ("Second Term", "Second Term"),
        ("Third Term", "Third Term"),
    ]

    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    academic_year = models.CharField(max_length=9)  # e.g. '2024/2025'
    term = models.CharField(max_length=20, choices=TERM_CHOICES, default="First Term")
    classes = models.ManyToManyField(Class, related_name='fee_structures')
    date_created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.academic_year} - {self.term}"


class StudentFeeRecord(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('PAID', 'Paid'),
        ('PARTIAL', 'Partially Paid'),
        ('UNPAID', 'Unpaid'),
    ]

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, limit_choices_to={'role': 'student'})
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.CASCADE)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    date_paid = models.DateTimeField(auto_now=True)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='UNPAID')

    def __str__(self):
        return f"{self.student.username} - {self.fee_structure.name} - {self.payment_status}"


class GradingScale(models.Model):
    """
    Defines letter grade boundaries (A, B, C, D, F) for a school
    """
    name = models.CharField(max_length=100, help_text="Name for this grading scale (e.g., 'Standard Scale', 'Honors Scale')")
    description = models.TextField(blank=True)
    academic_year = models.CharField(max_length=9, blank=True)
    term = models.CharField(max_length=20, blank=True)
    
    # Grade boundaries (minimum scores for each letter grade)
    a_min_score = models.PositiveIntegerField(
        default=90,
        help_text="Minimum score for grade A (e.g., 90%)"
    )
    b_min_score = models.PositiveIntegerField(
        default=80,
        help_text="Minimum score for grade B (e.g., 80%)"
    )
    c_min_score = models.PositiveIntegerField(
        default=70,
        help_text="Minimum score for grade C (e.g., 70%)"
    )
    d_min_score = models.PositiveIntegerField(
        default=60,
        help_text="Minimum score for grade D (e.g., 60%)"
    )
    # F is implied for anything below D
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'admin'}
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['name']
    
    def clean(self):
        """Validate that grade boundaries are in descending order"""
        if not (self.a_min_score > self.b_min_score > self.c_min_score > self.d_min_score):
            raise ValidationError(
                "Grade boundaries must be in descending order (A > B > C > D)"
            )
        
        if self.d_min_score < 0 or self.a_min_score > 100:
            raise ValidationError(
                "Grade boundaries must be between 0 and 100"
            )
    
    def get_letter_grade(self, score):
        """Get letter grade for a given score"""
        # Convert score to float for comparison
        score = float(score)
        
        if score >= self.a_min_score:
            return 'A'
        elif score >= self.b_min_score:
            return 'B'
        elif score >= self.c_min_score:
            return 'C'
        elif score >= self.d_min_score:
            return 'D'
        else:
            return 'F'
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.name} (A:{self.a_min_score}+ B:{self.b_min_score}+ C:{self.c_min_score}+ D:{self.d_min_score}+)"


class GradingConfiguration(models.Model):
    """
    Stores grading weight configuration for each academic session
    Admin sets these percentages once per session, all teachers must follow
    """
    academic_year = models.CharField(max_length=9)  # e.g. '2024/2025'
    term = models.CharField(
        max_length=20,
        choices=[
            ("First Term", "First Term"),
            ("Second Term", "Second Term"),
            ("Third Term", "Third Term"),
        ]
    )
    
    # Grade component percentages (must total 100%)
    attendance_percentage = models.PositiveIntegerField(
        help_text="Percentage weight for attendance (5-20%)"
    )
    assignment_percentage = models.PositiveIntegerField(
        help_text="Percentage weight for assignments (5-20%)"
    )
    test_percentage = models.PositiveIntegerField(
        help_text="Percentage weight for tests"
    )
    exam_percentage = models.PositiveIntegerField(
        help_text="Percentage weight for exams"
    )
    
    # Link to grading scale
    grading_scale = models.ForeignKey(
        GradingScale,
        on_delete=models.CASCADE,
        help_text="Grading scale to use for letter grades"
    )
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'admin'}
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # Optional: Track if this was copied from another session
    copied_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Original configuration this was copied from"
    )
    
    class Meta:
        unique_together = ('academic_year', 'term')
        ordering = ['-academic_year', 'term']
    
    def clean(self):
        """Validate that percentages total 100%"""
        total = (
            self.attendance_percentage + 
            self.assignment_percentage + 
            self.test_percentage + 
            self.exam_percentage
        )
        if total != 100:
            raise ValidationError(
                f"Grade percentages must total 100%. Current total: {total}%"
            )
        
        # Validate attendance and assignment ranges
        if not (5 <= self.attendance_percentage <= 20):
            raise ValidationError("Attendance percentage must be between 5% and 20%")
        
        if not (5 <= self.assignment_percentage <= 20):
            raise ValidationError("Assignment percentage must be between 5% and 20%")
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    
    def copy_to_session(self, target_academic_year, target_term, admin_user):
        """
        Create a copy of this configuration for a new session
        If a configuration already exists for the target session, it will be deactivated
        """
        # Check if a configuration already exists for this academic year and term
        existing_config = GradingConfiguration.objects.filter(
            academic_year=target_academic_year,
            term=target_term
        ).first()

        if existing_config:
            # Deactivate the existing configuration
            existing_config.is_active = False
            existing_config.save()
            print(f"Deactivated existing config during copy: {existing_config.id} for {target_academic_year} - {target_term}")

        new_config = GradingConfiguration.objects.create(
            academic_year=target_academic_year,
            term=target_term,
            attendance_percentage=self.attendance_percentage,
            assignment_percentage=self.assignment_percentage,
            test_percentage=self.test_percentage,
            exam_percentage=self.exam_percentage,
            grading_scale=self.grading_scale,
            created_by=admin_user,
            copied_from=self
        )
        return new_config
    
    def __str__(self):
        return f"Grading Config: {self.academic_year} - {self.term}"


class GradeComponent(models.Model):
    """
    Individual grade types within a grading configuration
    """
    COMPONENT_TYPES = [
        ('attendance', 'Attendance'),
        ('assignment', 'Assignment'), 
        ('test', 'Test'),
        ('exam', 'Exam'),
    ]
    
    grading_config = models.ForeignKey(
        GradingConfiguration,
        on_delete=models.CASCADE,
        related_name='components'
    )
    component_type = models.CharField(max_length=20, choices=COMPONENT_TYPES)
    percentage_weight = models.PositiveIntegerField()
    max_score = models.PositiveIntegerField(
        default=100,
        help_text="Maximum possible score for this component"
    )
    description = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('grading_config', 'component_type')
    
    def __str__(self):
        return f"{self.get_component_type_display()} - {self.percentage_weight}%"


class StudentGrade(models.Model):
    """
    Stores actual grades for students in each component
    """
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'}
    )
    grading_config = models.ForeignKey(
        GradingConfiguration,
        on_delete=models.CASCADE
    )
    component = models.ForeignKey(
        GradeComponent,
        on_delete=models.CASCADE
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE
    )
    
    # Grade details
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Actual score achieved"
    )
    max_possible_score = models.PositiveIntegerField(
        help_text="Maximum score for this specific item"
    )
    
    # Metadata
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='grades_entered',
        limit_choices_to={'role__in': ['teacher', 'admin']}
    )
    date_entered = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Optional: Link to specific assignment/test
    related_content = models.ForeignKey(
        'academics.SubjectContent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Link to assignment/test if applicable"
    )
    
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('student', 'component', 'subject', 'related_content')
        ordering = ['-date_entered']
    
    def clean(self):
        """Validate score doesn't exceed maximum"""
        if self.score > self.max_possible_score:
            raise ValidationError(
                f"Score ({self.score}) cannot exceed maximum possible score ({self.max_possible_score})"
            )
    
    @property
    def percentage_score(self):
        """Calculate percentage score"""
        if self.max_possible_score == 0:
            return 0
        return (self.score / self.max_possible_score) * 100
    
    @property
    def weighted_score(self):
        """Calculate weighted score based on component percentage"""
        return (self.percentage_score * self.component.percentage_weight) / 100
    
    def __str__(self):
        return f"{self.student.username} - {self.subject.name} - {self.component.component_type}: {self.score}/{self.max_possible_score}"


# GRADING-RELATED ATTENDANCE RECORD (different from attendance calendar)
class AttendanceRecord(models.Model):
    """
    Track student attendance for grading purposes
    This is different from the attendance calendar system
    """
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'}
    )
    class_session = models.ForeignKey(
        'academics.ClassSession',
        on_delete=models.CASCADE,
        db_index=True
    )
    date = models.DateField(db_index=True)
    is_present = models.BooleanField(default=False)
    
    # Additional attendance details
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='grading_attendance_recorded',
        limit_choices_to={'role__in': ['teacher', 'admin']}
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('student', 'class_session', 'date')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['class_session', 'date']),
            models.Index(fields=['student', 'class_session']),
        ]
    
    def __str__(self):
        status = "Present" if self.is_present else "Absent"
        return f"{self.student.username} - {self.date} - {status}"


class GradeSummary(models.Model):
    """
    Calculated final grades for each student per subject
    Auto-generated based on component grades
    """
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'}
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE
    )
    grading_config = models.ForeignKey(
        GradingConfiguration,
        on_delete=models.CASCADE
    )
    
    # Calculated scores
    attendance_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    assignment_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    test_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    exam_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    total_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    letter_grade = models.CharField(max_length=2, blank=True)
    
    # NEW FIELD: Track if attendance is manually finalized
    attendance_finalized = models.BooleanField(
        default=False,
        help_text="If True, attendance score won't be auto-updated from attendance records"
    )

    # Track if test/exam scores have been manually entered by teacher (one-time only)
    test_manual_entry = models.BooleanField(
        default=False,
        help_text="If True, test score was manually entered by teacher and cannot be edited again"
    )
    exam_manual_entry = models.BooleanField(
        default=False,
        help_text="If True, exam score was manually entered by teacher and cannot be edited again"
    )

    # Metadata
    last_calculated = models.DateTimeField(auto_now=True)
    is_final = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ('student', 'subject', 'grading_config')
        ordering = ['-total_score']
    
    def calculate_letter_grade(self):
        """Convert total score to letter grade using the session's grading scale"""
        return self.grading_config.grading_scale.get_letter_grade(self.total_score)
    
    def recalculate_total_score(self):
        """
        Recalculate total score based on weighted components
        Called when any component grade changes

        NOTE: The individual component scores (attendance_score, assignment_score, etc.)
        are already weighted percentages out of 100%. For example, if assignments are
        worth 10% and a student scores 95%, the assignment_score is already 9.5.
        Therefore, we just sum them directly without re-applying weights.
        """
        # Convert all scores to Decimal to avoid type mismatch
        attendance_score = Decimal(str(self.attendance_score))
        assignment_score = Decimal(str(self.assignment_score))
        test_score = Decimal(str(self.test_score))
        exam_score = Decimal(str(self.exam_score))

        # Sum the already-weighted scores
        self.total_score = attendance_score + assignment_score + test_score + exam_score
        self.letter_grade = self.calculate_letter_grade()

        return self.total_score
    
    def save(self, *args, **kwargs):
        # Auto-calculate letter grade on save
        self.letter_grade = self.calculate_letter_grade()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student.username} - {self.subject.name} - {self.total_score}% ({self.letter_grade})"


class ConfigurationTemplate(models.Model):
    """
    Save commonly used configurations as templates for easy copying
    """
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Same structure as GradingConfiguration
    attendance_percentage = models.PositiveIntegerField()
    assignment_percentage = models.PositiveIntegerField()
    test_percentage = models.PositiveIntegerField()
    exam_percentage = models.PositiveIntegerField()
    
    grading_scale = models.ForeignKey(
        GradingScale,
        on_delete=models.CASCADE
    )
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'admin'}
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['name']
    
    def clean(self):
        """Validate that percentages total 100%"""
        total = (
            self.attendance_percentage + 
            self.assignment_percentage + 
            self.test_percentage + 
            self.exam_percentage
        )
        if total != 100:
            raise ValidationError(f"Template percentages must total 100%. Current total: {total}%")
    
    def apply_to_session(self, academic_year, term, admin_user):
        """
        Create a new GradingConfiguration from this template
        """
        config = GradingConfiguration.objects.create(
            academic_year=academic_year,
            term=term,
            attendance_percentage=self.attendance_percentage,
            assignment_percentage=self.assignment_percentage,
            test_percentage=self.test_percentage,
            exam_percentage=self.exam_percentage,
            grading_scale=self.grading_scale,
            created_by=admin_user
        )
        return config
    
    def __str__(self):
        return f"Template: {self.name}"