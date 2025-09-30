from rest_framework import serializers
from .models import ActivityLog, NotificationStatus, NotificationPreference
from academics.models import Subject


class ActivityLogSerializer(serializers.ModelSerializer):
    user_full_name = serializers.SerializerMethodField()
    classroom_name = serializers.CharField(read_only=True)
    academic_session = serializers.CharField(read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_department = serializers.CharField(source='subject.department', read_only=True)
    time_ago = serializers.SerializerMethodField()
    
    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user', 'role', 'action', 'activity_type', 'timestamp',
            'extra_data', 'subject', 'content_type', 'content_title', 'content_id',
            'is_notification', 'user_full_name', 'classroom_name',
            'academic_session', 'subject_name', 'subject_department', 'time_ago'
        ]
        read_only_fields = ['user', 'timestamp']
    
    def get_user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else "Unknown User"
    
    def get_time_ago(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        diff = now - obj.timestamp
        
        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            return f"{diff.seconds // 60} minutes ago"
        elif diff < timedelta(days=1):
            return f"{diff.seconds // 3600} hours ago"
        elif diff < timedelta(days=7):
            return f"{diff.days} days ago"
        else:
            return obj.timestamp.strftime("%b %d, %Y")


class AdminNotificationSerializer(ActivityLogSerializer):
    """Serializer for admin notifications - shows all content activities"""
    teacher_name = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    
    class Meta(ActivityLogSerializer.Meta):
        model = ActivityLog
        fields = ActivityLogSerializer.Meta.fields + ['teacher_name', 'student_count']
    
    def get_teacher_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else "Unknown Teacher"
    
    def get_student_count(self, obj):
        """Get count of students who should see this notification"""
        if not obj.subject or not obj.subject.class_session:
            return 0
        
        from academics.models import StudentSession
        
        # Get all students in the class session
        student_sessions = StudentSession.objects.filter(
            class_session=obj.subject.class_session,
            is_active=True
        )
        
        # Filter by department for SS classes
        count = 0
        for student_session in student_sessions:
            student = student_session.student
            
            # If it's SS class and subject has specific department, filter by student department
            if (obj.subject.class_session.classroom and 
                obj.subject.class_session.classroom.name.startswith('S.S.S.') and 
                obj.subject.department != 'General' and 
                student.department != obj.subject.department):
                continue
            
            count += 1
        
        return count


class StudentNotificationSerializer(ActivityLogSerializer):
    """Serializer for student notifications - filtered by their subjects"""
    is_new = serializers.SerializerMethodField()
    read_status = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()
    
    class Meta(ActivityLogSerializer.Meta):
        model = ActivityLog
        fields = ActivityLogSerializer.Meta.fields + ['is_new', 'read_status', 'teacher_name']
    
    def get_is_new(self, obj):
        """Check if this notification is new for the current user"""
        request = self.context.get('request')
        if request and request.user:
            try:
                notification_status = NotificationStatus.objects.get(
                    user=request.user,
                    activity_log=obj
                )
                return not notification_status.is_read
            except NotificationStatus.DoesNotExist:
                return True  # If no status exists, it's new
        return True
    
    def get_read_status(self, obj):
        """Get detailed read status for the current user"""
        request = self.context.get('request')
        if request and request.user:
            try:
                notification_status = NotificationStatus.objects.get(
                    user=request.user,
                    activity_log=obj
                )
                return {
                    'is_read': notification_status.is_read,
                    'read_at': notification_status.read_at,
                    'created_at': notification_status.created_at
                }
            except NotificationStatus.DoesNotExist:
                return {
                    'is_read': False,
                    'read_at': None,
                    'created_at': None
                }
        return {
            'is_read': False,
            'read_at': None,
            'created_at': None
        }
    
    def get_teacher_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else "Unknown Teacher"


class NotificationStatusSerializer(serializers.ModelSerializer):
    activity_log = ActivityLogSerializer(read_only=True)
    user_full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificationStatus
        fields = ['id', 'user', 'activity_log', 'is_read', 'read_at', 'created_at', 'user_full_name']
        read_only_fields = ['user', 'read_at', 'created_at']
    
    def get_user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else "Unknown User"


class NotificationSummarySerializer(serializers.Serializer):
    """Serializer for notification summary data"""
    total_notifications = serializers.IntegerField()
    unread_count = serializers.IntegerField()
    recent_notifications = ActivityLogSerializer(many=True)
    content_summary = serializers.DictField()
    user_role = serializers.CharField()
    
    def to_representation(self, instance):
        # instance should be a dictionary with the summary data
        return instance


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for notification preferences"""
    
    class Meta:
        model = NotificationPreference
        fields = ['id', 'user', 'notification_type', 'is_enabled', 'email_notifications']
        read_only_fields = ['user']
    
    def create(self, validated_data):
        # Ensure uniqueness
        preference, created = NotificationPreference.objects.get_or_create(
            user=validated_data['user'],
            notification_type=validated_data['notification_type'],
            defaults={
                'is_enabled': validated_data.get('is_enabled', True),
                'email_notifications': validated_data.get('email_notifications', False)
            }
        )
        
        if not created:
            # Update existing preference
            preference.is_enabled = validated_data.get('is_enabled', preference.is_enabled)
            preference.email_notifications = validated_data.get('email_notifications', preference.email_notifications)
            preference.save()
        
        return preference


class DetailedActivityLogSerializer(ActivityLogSerializer):
    """Extended serializer with additional details for specific views"""
    notification_recipients = serializers.SerializerMethodField()
    content_details = serializers.SerializerMethodField()
    
    class Meta(ActivityLogSerializer.Meta):
        fields = ActivityLogSerializer.Meta.fields + ['notification_recipients', 'content_details']
    
    def get_notification_recipients(self, obj):
        """Get list of users who received this notification"""
        if not obj.is_notification:
            return []
        
        recipients = NotificationStatus.objects.filter(
            activity_log=obj
        ).select_related('user').values(
            'user__id',
            'user__first_name', 
            'user__last_name',
            'user__username',
            'is_read',
            'read_at'
        )
        
        return list(recipients)
    
    def get_content_details(self, obj):
        """Get additional content details if available"""
        if not obj.content_id or not obj.content_type:
            return None
        
        try:
            from academics.models import SubjectContent
            content = SubjectContent.objects.get(id=obj.content_id)
            
            return {
                'id': content.id,
                'title': content.title,
                'description': content.description[:200] if content.description else None,
                'file_count': content.files.count() if hasattr(content, 'files') else 0,
                'created_at': content.created_at,
                'is_active': content.is_active
            }
        except:
            return None


class BulkNotificationActionSerializer(serializers.Serializer):
    """Serializer for bulk notification actions"""
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=100
    )
    action = serializers.ChoiceField(choices=['mark_read', 'mark_unread'])
    
    def validate_notification_ids(self, value):
        """Validate that all notification IDs exist and are notifications"""
        existing_ids = ActivityLog.objects.filter(
            id__in=value,
            is_notification=True
        ).values_list('id', flat=True)
        
        if len(existing_ids) != len(value):
            invalid_ids = set(value) - set(existing_ids)
            raise serializers.ValidationError(
                f"Invalid notification IDs: {list(invalid_ids)}"
            )
        
        return value