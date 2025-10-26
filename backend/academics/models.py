from django.db import models
from django.conf import settings
import os


def upload_to_subject_files(instance, filename):
    """Generate upload path for subject files"""
    ext = filename.split('.')[-1]
    return f'subject_files/{instance.subject.id}/{instance.content_type}/{filename}'


def upload_to_content_files(instance, filename):
    """Generate upload path for content files"""
    return f'subject_files/{instance.content.subject.id}/{instance.content.id}/{filename}'


class Class(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class ClassSession(models.Model):
    classroom = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='sessions')
    academic_year = models.CharField(max_length=9, default="2024/2025")
    term = models.CharField(
        max_length=20,
        choices=[
            ("First Term", "First Term"),
            ("Second Term", "Second Term"),
            ("Third Term", "Third Term"),
        ],
        default="First Term"
    )

    class Meta:
        unique_together = ('classroom', 'academic_year', 'term')
        ordering = ['-academic_year', 'classroom__name', 'term']

    def __str__(self):
        return f"{self.classroom.name} - {self.academic_year} - {self.term}"


class Subject(models.Model):
    DEPARTMENT_CHOICES = [
        ('General', 'General'),
        ('Science', 'Science'),
        ('Arts', 'Arts'),
        ('Commercial', 'Commercial'),
    ]

    name = models.CharField(max_length=100)
    class_session = models.ForeignKey('ClassSession', on_delete=models.CASCADE, related_name='subjects')
    teacher = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'teacher'}
    )
    department = models.CharField(
        max_length=20,
        choices=DEPARTMENT_CHOICES,
        default='General',
        blank=True,
        null=True
    )

    def __str__(self):
        return f"{self.name} - {self.class_session} - {self.department or 'No Dept'}"


class StudentSession(models.Model):
    """
    Links students to specific academic sessions while preserving historical data
    """
    student = models.ForeignKey(
        'users.CustomUser', 
        on_delete=models.CASCADE, 
        limit_choices_to={'role': 'student'},
        related_name='student_sessions'
    )
    class_session = models.ForeignKey(
        'ClassSession', 
        on_delete=models.CASCADE,
        related_name='enrolled_students'
    )
    date_enrolled = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('student', 'class_session')
        ordering = ['-class_session__academic_year', 'class_session__term']
    
    def __str__(self):
        return f"{self.student.username} - {self.class_session}"


class SubjectContent(models.Model):
    """
    Base model for all subject content (assignments, notes, announcements)
    Content is tied to the subject - any teacher assigned to the subject can access it
    """
    CONTENT_TYPE_CHOICES = [
        ('assignment', 'Assignment'),
        ('note', 'Class Note'),
        ('announcement', 'Announcement'),
    ]

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='content'
    )
    created_by = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        limit_choices_to={'role__in': ['teacher', 'admin']},
        help_text="Teacher who originally created this content"
    )
    content_type = models.CharField(
        max_length=20,
        choices=CONTENT_TYPE_CHOICES
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # Assignment-specific fields
    due_date = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Required for assignments"
    )
    max_score = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text="Maximum score for assignment"
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['subject', 'content_type']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.get_content_type_display()}: {self.title} - {self.subject.name}"
    
    @property
    def file_count(self):
        """Get the number of files attached to this content"""
        return self.files.filter(is_active=True).count()
    
    @property
    def is_overdue(self):
        """Check if assignment is overdue"""
        if self.content_type == 'assignment' and self.due_date:
            from django.utils import timezone
            return timezone.now() > self.due_date
        return False
    
    def clean(self):
        """Validate model data"""
        from django.core.exceptions import ValidationError
        
        # Assignments must have due_date
        if self.content_type == 'assignment' and not self.due_date:
            raise ValidationError({
                'due_date': 'Due date is required for assignments.'
            })


class ContentFile(models.Model):
    """
    Model to store multiple files for each content item
    """
    content = models.ForeignKey(
        SubjectContent,
        on_delete=models.CASCADE,
        related_name='files'
    )
    file = models.FileField(
        upload_to=upload_to_content_files,
        help_text="File attachment"
    )
    original_name = models.CharField(
        max_length=255,
        help_text="Original filename when uploaded"
    )
    file_size = models.PositiveIntegerField(
        help_text="File size in bytes"
    )
    content_type_mime = models.CharField(
        max_length=100,
        help_text="MIME type of the file"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['uploaded_at']
    
    def __str__(self):
        return f"{self.original_name} - {self.content.title}"
    
    @property
    def file_name(self):
        """Get the original filename"""
        return self.original_name
    
    @property
    def file_extension(self):
        """Get file extension"""
        return os.path.splitext(self.original_name)[1].lower()
    
    @property
    def formatted_file_size(self):
        """Get file size in a readable format"""
        size = self.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size / (1024 * 1024):.1f} MB"


class StudentContentView(models.Model):
    """
    Track when students view content (for read receipts/analytics)
    """
    student = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'}
    )
    content = models.ForeignKey(
        SubjectContent,
        on_delete=models.CASCADE,
        related_name='student_views'
    )
    viewed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('student', 'content')
        ordering = ['-viewed_at']
    
    def __str__(self):
        return f"{self.student.username} viewed {self.content.title}"


class AssignmentSubmission(models.Model):
    """
    Student submissions for assignments
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
        ('returned', 'Returned'),
    ]
    
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'},
        related_name='assignment_submissions'
    )
    assignment = models.ForeignKey(
        'SubjectContent',
        on_delete=models.CASCADE,
        limit_choices_to={'content_type': 'assignment'},
        related_name='submissions'
    )
    
    # Submission details
    submission_text = models.TextField(
        blank=True,
        help_text="Optional text submission"
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='submitted'
    )
    
    # Track submission attempts (max 2: initial + 1 update)
    submission_count = models.PositiveIntegerField(
        default=1,
        help_text="Number of times student has submitted (max 2)"
    )
    
    # Grading information (filled by teacher later)
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Score awarded by teacher"
    )
    feedback = models.TextField(
        blank=True,
        help_text="Teacher feedback"
    )
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role__in': ['teacher', 'admin']},
        related_name='graded_submissions'
    )
    graded_at = models.DateTimeField(null=True, blank=True)
    
    # Admin approval for viewing grades
    grade_released = models.BooleanField(
        default=False,
        help_text="Admin approval to release grade to student"
    )
    
    class Meta:
        unique_together = ('student', 'assignment')
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['student', 'status']),
            models.Index(fields=['assignment', 'status']),
        ]
    
    def __str__(self):
        return f"{self.student.username} - {self.assignment.title}"
    
    @property
    def is_late(self):
        """Check if submission was late"""
        if self.assignment.due_date and self.submitted_at:
            return self.submitted_at > self.assignment.due_date
        return False
    
    @property
    def can_view_grade(self):
        """Check if student can view their grade"""
        return self.status == 'graded' and self.grade_released
    
    @property
    def can_resubmit(self):
        """Check if student can resubmit (max 2 submissions)"""
        return self.submission_count < 2 and self.status != 'graded'


class SubmissionFile(models.Model):
    """
    Files attached to assignment submissions
    """
    submission = models.ForeignKey(
        AssignmentSubmission,
        on_delete=models.CASCADE,
        related_name='files'
    )
    file = models.FileField(
        upload_to='submissions/%Y/%m/%d/'
    )
    original_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.original_name} - {self.submission.student.username}"
    
    @property
    def file_extension(self):
        """Get file extension"""
        return os.path.splitext(self.original_name)[1].lower()
    
    @property
    def formatted_file_size(self):
        """Format file size in human readable format"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"