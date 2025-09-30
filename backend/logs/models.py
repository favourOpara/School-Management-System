from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class ActivityLog(models.Model):
    ACTIVITY_TYPES = [
        ('user_created', 'User Created'),
        ('content_created', 'Content Created'),
        ('content_updated', 'Content Updated'),
        ('content_deleted', 'Content Deleted'),
        ('assignment_graded', 'Assignment Graded'),
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('system', 'System Activity'),
    ]

    CONTENT_TYPES = [
        ('assignment', 'Assignment'),
        ('note', 'Class Note'),
        ('announcement', 'Announcement'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20)
    action = models.TextField()
    activity_type = models.CharField(
        max_length=20, 
        choices=ACTIVITY_TYPES, 
        default='system'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    extra_data = models.JSONField(blank=True, null=True)
    
    # Content-specific fields for notifications
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Subject related to this activity"
    )
    content_type = models.CharField(
        max_length=20,
        choices=CONTENT_TYPES,
        null=True,
        blank=True,
        help_text="Type of content (assignment, note, announcement)"
    )
    content_title = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        help_text="Title of the content"
    )
    content_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="ID of the related content"
    )
    
    # Notification tracking
    is_notification = models.BooleanField(
        default=False,
        help_text="Whether this activity should appear as a notification"
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['activity_type', 'timestamp']),
            models.Index(fields=['subject', 'timestamp']),
            models.Index(fields=['is_notification', 'timestamp']),
            models.Index(fields=['subject', 'is_notification', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.action} at {self.timestamp}"

    @property
    def classroom_name(self):
        """Get the classroom name for this activity"""
        if self.subject and self.subject.class_session and self.subject.class_session.classroom:
            return self.subject.class_session.classroom.name
        return None

    @property
    def academic_session(self):
        """Get the academic session info"""
        if self.subject and self.subject.class_session:
            return f"{self.subject.class_session.academic_year} - {self.subject.class_session.term}"
        return None

    @classmethod
    def log_content_activity(cls, user, subject, content_type, content_title, content_id, activity_type='content_created'):
        """
        Helper method to log content-related activities that generate notifications
        """
        action_map = {
            'content_created': f"uploaded new {content_type}",
            'content_updated': f"updated {content_type}",
            'content_deleted': f"deleted {content_type}",
        }
        
        action = f"{action_map.get(activity_type, 'performed action on')} '{content_title}' for {subject.name}"
        if subject.class_session and subject.class_session.classroom:
            action += f" ({subject.class_session.classroom.name})"
        
        activity_log = cls.objects.create(
            user=user,
            role=user.role,
            action=action,
            activity_type=activity_type,
            subject=subject,
            content_type=content_type,
            content_title=content_title,
            content_id=content_id,
            is_notification=True,
            extra_data={
                'subject_id': subject.id,
                'subject_name': subject.name,
                'classroom': subject.class_session.classroom.name if subject.class_session and subject.class_session.classroom else None,
                'academic_year': subject.class_session.academic_year if subject.class_session else None,
                'term': subject.class_session.term if subject.class_session else None,
                'department': subject.department,
                'teacher_name': f"{user.first_name} {user.last_name}",
                'teacher_id': user.id,
                'class_session_id': subject.class_session.id if subject.class_session else None,
            }
        )
        
        # Create notification status records for relevant users
        activity_log.create_notification_status_records()
        
        return activity_log
    
    def create_notification_status_records(self):
        """
        Create NotificationStatus records for users who should see this notification
        """
        if not self.is_notification or not self.subject:
            return
        
        from academics.models import StudentSession
        
        # Get all students enrolled in this subject's class session
        student_sessions = StudentSession.objects.filter(
            class_session=self.subject.class_session,
            is_active=True
        ).select_related('student')
        
        # Filter students by department for SS classes with specific departments
        relevant_students = []
        for student_session in student_sessions:
            student = student_session.student
            
            # If it's SS class and subject has specific department, filter by student department
            if (self.subject.class_session.classroom and 
                self.subject.class_session.classroom.name.startswith('S.S.S.') and 
                self.subject.department != 'General' and 
                student.department != self.subject.department):
                continue  # Skip students not in this department
            
            relevant_students.append(student)
        
        # Bulk create notification status records
        notification_statuses = []
        for student in relevant_students:
            notification_statuses.append(
                NotificationStatus(
                    user=student,
                    activity_log=self,
                    is_read=False
                )
            )
        
        if notification_statuses:
            NotificationStatus.objects.bulk_create(
                notification_statuses,
                ignore_conflicts=True  # Avoid duplicates
            )
    
    def get_notification_status_for_user(self, user):
        """Get notification status for a specific user"""
        try:
            return NotificationStatus.objects.get(user=user, activity_log=self)
        except NotificationStatus.DoesNotExist:
            return None


class NotificationStatus(models.Model):
    """
    Track read status of notifications for different users
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    activity_log = models.ForeignKey(ActivityLog, on_delete=models.CASCADE, related_name='notification_statuses')
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'activity_log')
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', 'activity_log']),
            models.Index(fields=['activity_log', 'is_read']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.activity_log.action} - Read: {self.is_read}"
    
    def mark_as_read(self):
        """Mark this notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class NotificationPreference(models.Model):
    """
    User preferences for notifications
    """
    NOTIFICATION_TYPES = [
        ('assignment', 'New Assignments'),
        ('note', 'Class Notes'),
        ('announcement', 'Announcements'),
        ('grading', 'Grading Updates'),
        ('all', 'All Notifications'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notification_preferences')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    is_enabled = models.BooleanField(default=True)
    email_notifications = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ('user', 'notification_type')
        indexes = [
            models.Index(fields=['user', 'notification_type']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.notification_type} - Enabled: {self.is_enabled}"