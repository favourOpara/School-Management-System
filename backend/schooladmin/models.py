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


class FeePaymentHistory(models.Model):
    """
    Track all payment transactions for audit trail and receipt generation
    """
    TRANSACTION_TYPES = [
        ('payment', 'Payment'),
        ('adjustment', 'Adjustment'),
        ('refund', 'Refund'),
    ]

    fee_record = models.ForeignKey(
        StudentFeeRecord,
        on_delete=models.CASCADE,
        related_name='payment_history'
    )
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default='payment')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    previous_total = models.DecimalField(max_digits=10, decimal_places=2)
    new_total = models.DecimalField(max_digits=10, decimal_places=2)
    balance_before = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)

    payment_method = models.CharField(max_length=50, blank=True)
    transaction_reference = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='fee_payments_recorded'
    )
    transaction_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-transaction_date']
        verbose_name_plural = 'Fee Payment Histories'

    def __str__(self):
        return f"{self.fee_record.student.username} - {self.transaction_type} - ₦{self.amount}"


class FeeReceipt(models.Model):
    """
    Fee receipts sent to parents for fee payments
    """
    TERM_CHOICES = [
        ("First Term", "First Term"),
        ("Second Term", "Second Term"),
        ("Third Term", "Third Term"),
    ]

    STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('pending', 'Pending'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'},
        related_name='fee_receipts'
    )
    receipt_number = models.CharField(max_length=50, unique=True)
    academic_year = models.CharField(max_length=9)  # e.g. '2024/2025'
    term = models.CharField(max_length=20, choices=TERM_CHOICES)

    # Amount details
    total_fees = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total fees for the term")
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount paid")
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Outstanding balance")

    # Payment details
    payment_method = models.CharField(max_length=50, blank=True, help_text="Cash, Transfer, etc.")
    transaction_reference = models.CharField(max_length=100, blank=True)

    # Status and metadata
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    date_issued = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)

    # Optional fields
    remarks = models.TextField(blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='receipts_issued',
        limit_choices_to={'role': 'admin'}
    )

    # PDF file (optional - can be generated on the fly or stored)
    pdf_file = models.FileField(upload_to='fee_receipts/', blank=True, null=True)

    # Notification tracking
    notification_sent = models.BooleanField(default=False)
    notification_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date_issued']
        indexes = [
            models.Index(fields=['student', 'academic_year', 'term']),
            models.Index(fields=['receipt_number']),
        ]

    def __str__(self):
        return f"Receipt #{self.receipt_number} - {self.student.username} - {self.academic_year} {self.term}"

    def save(self, *args, **kwargs):
        # Auto-calculate balance if not set
        if not self.balance:
            self.balance = self.total_fees - self.amount_paid

        # Auto-set status based on payment
        if self.amount_paid >= self.total_fees:
            self.status = 'paid'
        elif self.amount_paid > 0:
            self.status = 'partial'
        else:
            self.status = 'pending'

        super().save(*args, **kwargs)


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
        # Check if any required fields are None
        if any(x is None for x in [
            self.attendance_percentage,
            self.assignment_percentage,
            self.test_percentage,
            self.exam_percentage
        ]):
            raise ValidationError(
                "All percentage fields (attendance, assignment, test, exam) are required."
            )

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
        If a configuration already exists for the target session, it will be deactivated as the active one,
        but kept for historical reference
        """
        # Check if a configuration already exists for this academic year and term
        existing_config = GradingConfiguration.objects.filter(
            academic_year=target_academic_year,
            term=target_term,
            is_active=True
        ).first()

        if existing_config:
            # Deactivate the existing configuration so only one is active per session
            # But keep it in the database for historical access
            existing_config.is_active = False
            existing_config.save()
            print(f"Deactivated existing active config during copy: {existing_config.id} for {target_academic_year} - {target_term}")

        new_config = GradingConfiguration.objects.create(
            academic_year=target_academic_year,
            term=target_term,
            attendance_percentage=self.attendance_percentage,
            assignment_percentage=self.assignment_percentage,
            test_percentage=self.test_percentage,
            exam_percentage=self.exam_percentage,
            grading_scale=self.grading_scale,
            created_by=admin_user,
            copied_from=self,
            is_active=True
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


class Announcement(models.Model):
    """
    General announcements from admin to students, teachers, parents, or everyone
    """
    AUDIENCE_CHOICES = [
        ('everyone', 'Everyone'),
        ('students', 'All Students'),
        ('teachers', 'All Teachers'),
        ('parents', 'All Parents'),
        ('specific', 'Specific Users'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    SEND_TYPE_CHOICES = [
        ('manual', 'Send Manually'),
        ('scheduled', 'Schedule for Later'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    # Conditional targeting choices for parents
    PARENT_FILTER_CHOICES = [
        ('all', 'All Parents'),
        ('owing_fees', 'Parents with Students Owing Fees'),
        ('low_attendance', 'Parents with Students Having Attendance Below 50%'),
    ]

    # Conditional targeting choices for students
    STUDENT_FILTER_CHOICES = [
        ('all', 'All Students'),
        ('owing_fees', 'Students Owing Fees'),
        ('low_attendance', 'Students with Attendance Below 50%'),
        ('low_assignment', 'Students with Assignment Scores Below 50%'),
        ('low_test', 'Students with Test Scores Below 50%'),
    ]

    # Conditional targeting choices for teachers
    TEACHER_FILTER_CHOICES = [
        ('all', 'All Teachers'),
        ('incomplete_grading', 'Teachers with Incomplete Grading After Deadline'),
    ]

    title = models.CharField(max_length=200)
    message = models.TextField()
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='everyone')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')

    # Scheduling fields
    send_type = models.CharField(max_length=20, choices=SEND_TYPE_CHOICES, default='manual')
    scheduled_date = models.DateField(null=True, blank=True, help_text="Date to send the announcement")
    scheduled_time = models.TimeField(null=True, blank=True, help_text="Time to send the announcement")
    send_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    sent_at = models.DateTimeField(null=True, blank=True)

    # Conditional targeting filters
    parent_filter = models.CharField(
        max_length=20,
        choices=PARENT_FILTER_CHOICES,
        default='all',
        help_text="Filter criteria for parent recipients"
    )
    student_filter = models.CharField(
        max_length=20,
        choices=STUDENT_FILTER_CHOICES,
        default='all',
        help_text="Filter criteria for student recipients"
    )
    teacher_filter = models.CharField(
        max_length=30,
        choices=TEACHER_FILTER_CHOICES,
        default='all',
        help_text="Filter criteria for teacher recipients"
    )
    grading_deadline = models.DateField(
        null=True,
        blank=True,
        help_text="Deadline date for grading completion (e.g., exam end date)"
    )

    # Recurrence/Frequency settings
    is_recurring = models.BooleanField(
        default=False,
        help_text="Whether this announcement should be sent repeatedly"
    )
    recurrence_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Number of days between recurring sends (e.g., 10 means every 10 days)"
    )
    last_sent_date = models.DateField(
        null=True,
        blank=True,
        help_text="Last date this recurring announcement was sent"
    )
    next_send_date = models.DateField(
        null=True,
        blank=True,
        help_text="Next scheduled send date for recurring announcements"
    )

    # For specific users
    specific_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='specific_announcements',
        blank=True
    )

    # Optional filters for audience
    specific_classes = models.ManyToManyField(
        Class,
        related_name='class_announcements',
        blank=True,
        help_text="Send to students/parents in specific classes"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_announcements',
        limit_choices_to={'role': 'admin'}
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    # Track who has read the announcement
    read_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='read_announcements',
        blank=True
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.get_priority_display()} ({self.audience})"

    def get_recipients_count(self):
        """Calculate the number of users who should see this announcement"""
        from users.models import CustomUser

        if self.audience == 'specific':
            return self.specific_users.count()
        elif self.audience == 'everyone':
            return CustomUser.objects.filter(is_active=True).count()
        else:
            # For students, teachers, parents
            role_map = {
                'students': 'student',
                'teachers': 'teacher',
                'parents': 'parent'
            }
            role = role_map.get(self.audience)
            if role:
                query = CustomUser.objects.filter(role=role, is_active=True)
                if self.specific_classes.exists() and role in ['student', 'parent']:
                    if role == 'student':
                        query = query.filter(classroom__in=self.specific_classes.all())
                    else:  # parents
                        query = query.filter(children__classroom__in=self.specific_classes.all()).distinct()
                return query.count()
        return 0

    def mark_as_read(self, user):
        """Mark announcement as read by a user"""
        self.read_by.add(user)

    def is_read_by(self, user):
        """Check if user has read this announcement"""
        return self.read_by.filter(id=user.id).exists()

    def get_filtered_students(self):
        """
        Get students based on student_filter criteria
        Returns queryset of students
        """
        from users.models import CustomUser
        from django.db.models import Avg, Q
        from datetime import datetime, timedelta

        students = CustomUser.objects.filter(role='student', is_active=True)

        # Apply class filter if specified
        if self.specific_classes.exists():
            students = students.filter(classroom__in=self.specific_classes.all())

        if self.student_filter == 'all':
            return students

        elif self.student_filter == 'owing_fees':
            # Students who owe fees (have unpaid or partial fee records)
            students_owing = []
            for student in students:
                fee_records = StudentFeeRecord.objects.filter(
                    student=student,
                    payment_status__in=['UNPAID', 'PARTIAL']
                )
                if fee_records.exists():
                    students_owing.append(student.id)
            return students.filter(id__in=students_owing)

        elif self.student_filter == 'low_attendance':
            # Students with attendance below 50% (using attendance records and calendar)
            from attendance.models import AttendanceRecord as CalendarAttendance

            students_low_attendance = []
            for student in students:
                # Check grading attendance records
                total_attendance = AttendanceRecord.objects.filter(student=student).count()
                present_count = AttendanceRecord.objects.filter(student=student, is_present=True).count()

                # Also check calendar attendance
                calendar_total = CalendarAttendance.objects.filter(student=student).count()
                calendar_present = CalendarAttendance.objects.filter(
                    student=student,
                    status__in=['present', 'late']
                ).count()

                # Calculate attendance percentage
                if total_attendance > 0:
                    attendance_percentage = (present_count / total_attendance) * 100
                    if attendance_percentage < 50:
                        students_low_attendance.append(student.id)
                elif calendar_total > 0:
                    calendar_percentage = (calendar_present / calendar_total) * 100
                    if calendar_percentage < 50:
                        students_low_attendance.append(student.id)

            return students.filter(id__in=students_low_attendance)

        elif self.student_filter == 'low_assignment':
            # Students with assignment scores below 50%
            from academics.models import AssessmentSubmission

            students_low_assignment = []
            for student in students:
                # Get assignment submissions
                submissions = AssessmentSubmission.objects.filter(
                    student=student,
                    assessment__assessment_type='assignment'
                ).exclude(grade__isnull=True)

                if submissions.exists():
                    # Calculate average percentage
                    total_percentage = 0
                    count = 0
                    for submission in submissions:
                        if submission.assessment.total_marks > 0:
                            percentage = (float(submission.grade) / float(submission.assessment.total_marks)) * 100
                            total_percentage += percentage
                            count += 1

                    if count > 0:
                        avg_percentage = total_percentage / count
                        if avg_percentage < 50:
                            students_low_assignment.append(student.id)

            return students.filter(id__in=students_low_assignment)

        elif self.student_filter == 'low_test':
            # Students with test scores below 50%
            from academics.models import AssessmentSubmission

            students_low_test = []
            for student in students:
                # Get test submissions
                submissions = AssessmentSubmission.objects.filter(
                    student=student,
                    assessment__assessment_type='test'
                ).exclude(grade__isnull=True)

                if submissions.exists():
                    # Calculate average percentage
                    total_percentage = 0
                    count = 0
                    for submission in submissions:
                        if submission.assessment.total_marks > 0:
                            percentage = (float(submission.grade) / float(submission.assessment.total_marks)) * 100
                            total_percentage += percentage
                            count += 1

                    if count > 0:
                        avg_percentage = total_percentage / count
                        if avg_percentage < 50:
                            students_low_test.append(student.id)

            return students.filter(id__in=students_low_test)

        return students

    def get_filtered_parents(self):
        """
        Get parents based on parent_filter criteria
        Returns queryset of parents
        """
        from users.models import CustomUser
        from django.db.models import Q

        parents = CustomUser.objects.filter(role='parent', is_active=True)

        # Apply class filter if specified (parents with children in specific classes)
        if self.specific_classes.exists():
            parents = parents.filter(children__classroom__in=self.specific_classes.all()).distinct()

        if self.parent_filter == 'all':
            return parents

        elif self.parent_filter == 'owing_fees':
            # Parents whose children owe fees
            parents_owing = []
            for parent in parents:
                children = parent.children.all()
                for child in children:
                    fee_records = StudentFeeRecord.objects.filter(
                        student=child,
                        payment_status__in=['UNPAID', 'PARTIAL']
                    )
                    if fee_records.exists():
                        parents_owing.append(parent.id)
                        break  # One child owing is enough

            return parents.filter(id__in=parents_owing)

        elif self.parent_filter == 'low_attendance':
            # Parents whose children have attendance below 50%
            from attendance.models import AttendanceRecord as CalendarAttendance

            parents_low_attendance = []
            for parent in parents:
                children = parent.children.all()
                for child in children:
                    # Check grading attendance
                    total_attendance = AttendanceRecord.objects.filter(student=child).count()
                    present_count = AttendanceRecord.objects.filter(student=child, is_present=True).count()

                    # Also check calendar attendance
                    calendar_total = CalendarAttendance.objects.filter(student=child).count()
                    calendar_present = CalendarAttendance.objects.filter(
                        student=child,
                        status__in=['present', 'late']
                    ).count()

                    # Calculate attendance percentage
                    low_attendance = False
                    if total_attendance > 0:
                        attendance_percentage = (present_count / total_attendance) * 100
                        if attendance_percentage < 50:
                            low_attendance = True
                    elif calendar_total > 0:
                        calendar_percentage = (calendar_present / calendar_total) * 100
                        if calendar_percentage < 50:
                            low_attendance = True

                    if low_attendance:
                        parents_low_attendance.append(parent.id)
                        break  # One child with low attendance is enough

            return parents.filter(id__in=parents_low_attendance)

        return parents

    def get_filtered_teachers(self):
        """
        Get teachers based on teacher_filter criteria
        Returns queryset of teachers
        """
        from users.models import CustomUser
        from academics.models import Subject

        teachers = CustomUser.objects.filter(role='teacher', is_active=True)

        if self.teacher_filter == 'all':
            return teachers

        elif self.teacher_filter == 'incomplete_grading':
            """
            Find teachers who have not completed grading after the deadline.
            A teacher has incomplete grading if they have students in their subjects
            who don't have complete grade entries (test_score and exam_score not entered).
            """
            if not self.grading_deadline:
                # If no deadline is set, return empty queryset
                return teachers.none()

            teachers_incomplete = []

            # Get all subjects taught by each teacher
            for teacher in teachers:
                subjects = Subject.objects.filter(teacher=teacher)

                if not subjects.exists():
                    continue

                # Check each subject for incomplete grading
                has_incomplete = False
                for subject in subjects:
                    # Get students enrolled in this subject's class
                    class_session = subject.class_session
                    students = CustomUser.objects.filter(
                        role='student',
                        classroom=class_session.classroom_assigned,
                        is_active=True
                    )

                    # Check if all students have grade summaries with exam scores entered
                    for student in students:
                        try:
                            grade_summary = GradeSummary.objects.get(
                                student=student,
                                subject=subject
                            )

                            # Check if test and exam have been manually entered
                            # If exam_score is 0 and not manually entered, it's incomplete
                            if not grade_summary.exam_manual_entry or grade_summary.exam_score == 0:
                                has_incomplete = True
                                break

                        except GradeSummary.DoesNotExist:
                            # No grade summary exists = incomplete
                            has_incomplete = True
                            break

                    if has_incomplete:
                        break

                if has_incomplete:
                    teachers_incomplete.append(teacher.id)

            return teachers.filter(id__in=teachers_incomplete)

        return teachers

    # CRITICAL FIX EXPLANATION
# ============================================================================
# 
# THE PROBLEM:
# bulk_create() does NOT trigger Django's post_save signals!
# 
# Your signals.py has:
#   @receiver(post_save, sender=Notification)
#   def send_notification_email_on_create(...)
# 
# But when you do:
#   Notification.objects.bulk_create(notifications_to_create)
# 
# Django creates all notifications in ONE SQL INSERT statement for performance.
# This means post_save signal NEVER FIRES, so no emails are sent!
# 
# THE SOLUTION:
# After bulk_create, manually send emails for each created notification.
# 
# ============================================================================

# Replace ONLY the send_announcement() method in your Announcement model
# Location: backend/schooladmin/models.py (around line 1780)

def send_announcement(self):
    """
    Send the announcement to recipients
    FIXED: Manually sends emails after bulk_create
    (bulk_create doesn't trigger post_save signals)
    """
    from logs.models import Notification
    from users.models import CustomUser
    from django.utils import timezone
    from datetime import timedelta
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Get recipients based on audience
    recipients = []

    if self.audience == 'specific':
        recipients = list(self.specific_users.all())
    elif self.audience == 'everyone':
        recipients = list(CustomUser.objects.filter(is_active=True))
    elif self.audience == 'students':
        recipients = list(self.get_filtered_students())
    elif self.audience == 'parents':
        recipients = list(self.get_filtered_parents())
    elif self.audience == 'teachers':
        recipients = list(self.get_filtered_teachers())

    logger.info(f"📧 Creating announcement for {len(recipients)} recipients")

    # Create notification objects (in memory, not in database yet)
    notifications_to_create = []
    for recipient in recipients:
        notifications_to_create.append(
            Notification(
                recipient=recipient,
                title=f"New Announcement: {self.title}",
                message=self.message,
                notification_type='announcement',
                priority=self.priority if self.priority in ['low', 'medium', 'high'] else 'medium',
                extra_data={
                    'announcement_id': self.id,
                    'announcement_title': self.title
                }
            )
        )

    # Bulk create in database (fast, but doesn't trigger signals!)
    created_notifications = Notification.objects.bulk_create(notifications_to_create, batch_size=500)
    notifications_created = len(created_notifications)
    
    logger.info(f"✅ Created {notifications_created} notifications in database")

    # ============================================================================
    # SEND EMAILS MANUALLY (since bulk_create skipped the post_save signal)
    # ============================================================================
    from django.db import transaction
    
    def send_emails_after_commit():
        """Send emails after database transaction commits"""
        from logs.email_service import send_notification_email
        
        logger.info(f"📧 Sending emails to {len(created_notifications)} recipients")
        
        emails_sent = 0
        emails_failed = 0
        emails_skipped = 0
        
        for notification in created_notifications:
            # Skip users without email addresses
            if not notification.recipient.email:
                logger.debug(f"Skipping {notification.recipient.username} - no email")
                emails_skipped += 1
                continue
            
            try:
                result = send_notification_email(
                    recipient_user=notification.recipient,
                    notification_title=notification.title,
                    notification_message=notification.message,
                    notification_type=notification.notification_type,
                    priority=notification.priority
                )
                
                if result:
                    emails_sent += 1
                    logger.debug(f"✅ Email sent to {notification.recipient.email}")
                else:
                    emails_failed += 1
                    logger.warning(f"❌ Email failed for {notification.recipient.email}")
                    
            except Exception as e:
                logger.error(f"❌ Exception sending email to {notification.recipient.email}: {str(e)}")
                emails_failed += 1
        
        logger.info(f"📊 Email Summary: {emails_sent} sent, {emails_failed} failed, {emails_skipped} skipped (no email)")
    
    # Schedule emails to be sent after the database commit completes
    # This prevents blocking the HTTP response while emails are being sent
    transaction.on_commit(send_emails_after_commit)
    logger.info(f"⏳ Emails queued for sending after transaction commit")

    # Update announcement status
    self.send_status = 'sent'
    self.sent_at = timezone.now()
    self.is_active = True

    # Handle recurring announcements
    if self.is_recurring and self.recurrence_days:
        self.last_sent_date = timezone.now().date()
        self.next_send_date = self.last_sent_date + timedelta(days=self.recurrence_days)
        self.send_status = 'scheduled'

    self.save()

    return notifications_created