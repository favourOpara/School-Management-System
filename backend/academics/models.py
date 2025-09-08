from django.db import models
import os


def upload_to_subject_files(instance, filename):
    """Generate upload path for subject files"""
    # Get file extension
    ext = filename.split('.')[-1]
    # Create path: subject_files/subject_id/content_type/filename
    return f'subject_files/{instance.subject.id}/{instance.content_type}/{filename}'


def upload_to_content_files(instance, filename):
    """Generate upload path for content files"""
    # Create path: subject_files/subject_id/content_id/filename
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


# UPDATED MODELS FOR MULTIPLE FILES SUPPORT

class SubjectContent(models.Model):
    """
    Base model for all subject content (assignments, notes, announcements)
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
    teacher = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'teacher'}
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
    
    def clean(self):
        """Validate model data"""
        from django.core.exceptions import ValidationError
        
        # Assignments must have due_date
        if self.content_type == 'assignment' and not self.due_date:
            raise ValidationError({
                'due_date': 'Due date is required for assignments.'
            })
        
        # Only teacher assigned to the subject can create content
        if self.teacher != self.subject.teacher:
            raise ValidationError({
                'teacher': 'Only the assigned teacher can create content for this subject.'
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