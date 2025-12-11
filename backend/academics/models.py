from django.db import models
from django.conf import settings
import os
from .storage import AssignmentFileStorage


def upload_to_subject_files(instance, filename):
    """Generate upload path for subject files"""
    ext = filename.split('.')[-1]
    return f'subject_files/{instance.subject.id}/{instance.content_type}/{filename}'


def upload_to_content_files(instance, filename):
    """Generate upload path for content files"""
    return f'subject_files/{instance.content.subject.id}/{instance.content.id}/{filename}'


class Department(models.Model):
    """
    Departments for senior classes (Science, Arts, Commercial)
    Students in S.S.S classes choose one of these departments
    """
    DEPARTMENT_CHOICES = [
        ('Science', 'Science'),
        ('Arts', 'Arts'),
        ('Commercial', 'Commercial'),
    ]

    name = models.CharField(
        max_length=20,
        choices=DEPARTMENT_CHOICES,
        unique=True,
        help_text="Department name"
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class Class(models.Model):
    """
    A class/grade level (e.g., J.S.S.1, S.S.S.2)
    """
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    has_departments = models.BooleanField(
        default=False,
        help_text="If True, students and subjects in this class must select a department (Science/Arts/Commercial)"
    )

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


class Topic(models.Model):
    """
    Topics/Chapters for organizing questions within a subject
    """
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='topics'
    )
    name = models.CharField(
        max_length=200,
        help_text="Topic or chapter name (e.g., 'Algebra', 'Grammar', 'Photosynthesis')"
    )
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order of topic in curriculum"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['subject', 'order', 'name']
        unique_together = ('subject', 'name')

    def __str__(self):
        return f"{self.subject.name} - {self.name}"


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

    # Report sheet distribution tracking
    report_sent = models.BooleanField(
        default=False,
        help_text="Whether report sheet has been sent to student and parent"
    )
    report_sent_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date and time when report was sent"
    )
    report_sent_by = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'admin'},
        related_name='sent_reports',
        help_text="Admin who sent the report"
    )

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

    def delete(self, *args, **kwargs):
        """Override delete to remove all associated files from Cloudinary"""
        # Explicitly delete all ContentFile objects and their files
        for content_file in self.files.all():
            if content_file.file:
                content_file.file.delete(save=False)
            content_file.delete()
        super().delete(*args, **kwargs)


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
        help_text="File attachment",
        storage=AssignmentFileStorage()
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
    
    def delete(self, *args, **kwargs):
        """Override delete to remove file from Cloudinary"""
        if self.file:
            self.file.delete(save=False)
        super().delete(*args, **kwargs)

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

    @property
    def download_url(self):
        """Get the actual Cloudinary URL from the API"""
        if self.file:
            import cloudinary.api
            try:
                # Get the public_id without extension
                public_id = self.file.name
                # Fetch the resource from Cloudinary to get the real URL
                resource = cloudinary.api.resource(public_id, resource_type='raw')
                return resource.get('secure_url', self.file.url)
            except:
                # Fallback to the stored URL if API call fails
                return self.file.url
        return None


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

    def delete(self, *args, **kwargs):
        """Override delete to remove all associated files from Cloudinary"""
        # Explicitly delete all SubmissionFile objects and their files
        for submission_file in self.files.all():
            if submission_file.file:
                submission_file.file.delete(save=False)
            submission_file.delete()
        super().delete(*args, **kwargs)


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
        upload_to='submissions/%Y/%m/%d/',
        storage=AssignmentFileStorage()
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
    
    def delete(self, *args, **kwargs):
        """Override delete to remove file from Cloudinary"""
        if self.file:
            self.file.delete(save=False)
        super().delete(*args, **kwargs)

    @property
    def formatted_file_size(self):
        """Format file size in human readable format"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"

    @property
    def download_url(self):
        """Get the actual Cloudinary URL from the API"""
        if self.file:
            import cloudinary.api
            try:
                # Get the public_id without extension
                public_id = self.file.name
                # Fetch the resource from Cloudinary to get the real URL
                resource = cloudinary.api.resource(public_id, resource_type='raw')
                return resource.get('secure_url', self.file.url)
            except:
                # Fallback to the stored URL if API call fails
                return self.file.url
        return None


class Assessment(models.Model):
    """
    Model for tests and exams created by teachers
    """
    ASSESSMENT_TYPE_CHOICES = [
        ('test_1', 'Test 1'),
        ('test_2', 'Test 2'),
        ('mid_term', 'Mid-Term Test'),
        ('final_exam', 'Final Exam'),
    ]

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='assessments'
    )
    topic = models.ForeignKey(
        'Topic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assessments',
        help_text="Topic/Chapter this assessment covers"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        limit_choices_to={'role__in': ['teacher', 'admin']},
        related_name='created_assessments'
    )
    title = models.CharField(max_length=200)
    assessment_type = models.CharField(
        max_length=10,
        choices=ASSESSMENT_TYPE_CHOICES
    )
    duration_minutes = models.PositiveIntegerField(
        help_text="Duration of the assessment in minutes"
    )
    assessment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when the assessment will be conducted (set by admin)"
    )
    total_marks = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        help_text="Total marks for this assessment"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    is_released = models.BooleanField(
        default=False,
        help_text="Whether students can see this assessment (controlled by admin)"
    )

    class Meta:
        ordering = ['-assessment_date', '-created_at']
        indexes = [
            models.Index(fields=['subject', 'assessment_type']),
            models.Index(fields=['assessment_date']),
        ]

    def __str__(self):
        return f"{self.get_assessment_type_display()}: {self.title} - {self.subject.name}"

    @property
    def question_count(self):
        """Get the number of questions in this assessment"""
        return self.questions.filter(is_active=True).count()


def upload_to_exam_images(instance, filename):
    """Generate upload path for exam question images"""
    ext = filename.split('.')[-1]
    return f'exam_images/{instance.assessment.subject.id}/{instance.assessment.id}/{instance.question_number}.{ext}'


class Question(models.Model):
    """
    Individual questions for an assessment
    """
    QUESTION_TYPE_CHOICES = [
        ('multiple_choice', 'Multiple Choice'),
        ('true_false', 'True/False'),
        ('fill_blank', 'Fill in the Blanks'),
        ('essay', 'Essay/Short Answer'),
        ('matching', 'Matching'),
    ]

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name='questions'
    )
    question_type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPE_CHOICES,
        default='multiple_choice',
        help_text="Type of question"
    )
    question_text = models.TextField(
        help_text="The question text"
    )
    marks = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Marks allocated to this question"
    )
    question_number = models.PositiveIntegerField(
        help_text="Question number/order"
    )
    # Image field - only for exams
    image = models.ImageField(
        upload_to=upload_to_exam_images,
        null=True,
        blank=True,
        help_text="Optional image for exam questions (max 100KB)"
    )
    # For fill in the blanks and essay questions
    correct_answer = models.TextField(
        blank=True,
        help_text="Correct answer for fill-in-the-blanks or essay marking guide"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['question_number']
        unique_together = ('assessment', 'question_number')

    def __str__(self):
        return f"Q{self.question_number}: {self.question_text[:50]}... ({self.marks} marks)"

    def clean(self):
        """Validate question data"""
        from django.core.exceptions import ValidationError

        if self.image:
            # Check file size (100KB = 102400 bytes)
            if self.image.size > 102400:
                raise ValidationError({
                    'image': 'Image file size cannot exceed 100KB.'
                })

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class QuestionOption(models.Model):
    """
    Options for multiple choice and matching questions
    """
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='options'
    )
    option_text = models.TextField(
        help_text="Option text (e.g., 'The capital of France')"
    )
    option_label = models.CharField(
        max_length=5,
        help_text="Option label (A, B, C, D, etc.)"
    )
    is_correct = models.BooleanField(
        default=False,
        help_text="Whether this is the correct answer"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order of option"
    )

    class Meta:
        ordering = ['order', 'option_label']
        unique_together = ('question', 'option_label')

    def __str__(self):
        return f"{self.question.question_text[:30]}... - Option {self.option_label}"


class MatchingPair(models.Model):
    """
    For matching type questions - pairs of items to match
    """
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='matching_pairs'
    )
    left_item = models.CharField(
        max_length=500,
        help_text="Item on the left side"
    )
    right_item = models.CharField(
        max_length=500,
        help_text="Item on the right side (correct match)"
    )
    pair_number = models.PositiveIntegerField(
        help_text="Pair number/order"
    )

    class Meta:
        ordering = ['pair_number']
        unique_together = ('question', 'pair_number')

    def __str__(self):
        return f"{self.left_item} → {self.right_item}"


class AssessmentSubmission(models.Model):
    """
    Student submission for an assessment
    """
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name='submissions'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assessment_submissions'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    time_taken = models.PositiveIntegerField(
        help_text="Time taken in seconds"
    )
    score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Score obtained (auto-calculated for objective questions)"
    )
    max_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        help_text="Maximum possible score"
    )
    is_graded = models.BooleanField(
        default=False,
        help_text="Whether essay/fill-blank questions have been manually graded"
    )

    class Meta:
        ordering = ['-submitted_at']
        unique_together = ('assessment', 'student')
        indexes = [
            models.Index(fields=['student', 'assessment']),
            models.Index(fields=['submitted_at']),
        ]

    def __str__(self):
        return f"{self.student.get_full_name()} - {self.assessment.title} ({self.score}/{self.max_score})"

    @property
    def percentage(self):
        """Calculate percentage score"""
        if self.score is not None and self.max_score > 0:
            return (float(self.score) / float(self.max_score)) * 100
        return 0


class StudentAnswer(models.Model):
    """
    Individual answer for a question in an assessment submission
    """
    submission = models.ForeignKey(
        AssessmentSubmission,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='student_answers'
    )
    # For multiple choice - store option ID
    selected_option = models.ForeignKey(
        QuestionOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_selections'
    )
    # For true/false, fill blank, essay
    text_answer = models.TextField(
        blank=True,
        help_text="Text answer for non-multiple choice questions"
    )
    # For matching questions - store as JSON
    matching_answers = models.JSONField(
        null=True,
        blank=True,
        help_text="Matching question answers as JSON"
    )
    is_correct = models.BooleanField(
        null=True,
        blank=True,
        help_text="Whether the answer is correct (null for essay/manual grading)"
    )
    points_earned = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Points earned for this question"
    )

    class Meta:
        ordering = ['question__question_number']
        unique_together = ('submission', 'question')

    def __str__(self):
        return f"{self.submission.student.get_full_name()} - Q{self.question.question_number}"

class AssessmentAccess(models.Model):
    """
    Tracks individual student access to assessments.
    Used for fee-based access control and selective unlocking.
    """
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name='access_records'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assessment_access'
    )
    is_unlocked = models.BooleanField(
        default=False,
        help_text="Whether this student has access to this assessment"
    )
    unlocked_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When access was granted"
    )
    unlocked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assessments_unlocked',
        help_text="Admin/Principal who granted access"
    )

    class Meta:
        ordering = ['-unlocked_at']
        unique_together = ('assessment', 'student')
        indexes = [
            models.Index(fields=['student', 'assessment']),
            models.Index(fields=['is_unlocked']),
        ]

    def __str__(self):
        status = "Unlocked" if self.is_unlocked else "Locked"
        return f"{self.student.get_full_name()} - {self.assessment.title} ({status})"
