# utils.py
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta
from .models import ActivityLog, NotificationStatus
from academics.models import StudentSession


def get_student_notifications_queryset(student):
    """
    Get all notifications relevant to a specific student
    """
    # Get all subjects the student is enrolled in (active sessions)
    student_sessions = StudentSession.objects.filter(
        student=student,
        is_active=True
    ).select_related('class_session')

    # Get the class sessions this student is in
    class_session_ids = student_sessions.values_list('class_session_id', flat=True)

    # Get notifications for subjects in those class sessions
    notifications = ActivityLog.objects.filter(
        is_notification=True,
        activity_type__in=['content_created', 'content_updated'],
        subject__class_session_id__in=class_session_ids
    ).select_related('user', 'subject__class_session__classroom')
    
    # Filter by department for SS classes
    filtered_notifications = []
    for notification in notifications:
        subject = notification.subject
        
        # Check if student should see this notification based on department
        if (subject and subject.class_session.classroom and 
            subject.class_session.classroom.name.startswith('S.S.S.') and 
            subject.department != 'General' and 
            student.department != subject.department):
            continue
        
        filtered_notifications.append(notification.id)
    
    return ActivityLog.objects.filter(
        id__in=filtered_notifications
    ).order_by('-timestamp')


def get_admin_notifications_queryset():
    """
    Get all notifications relevant to admins
    """
    return ActivityLog.objects.filter(
        is_notification=True,
        activity_type__in=['content_created', 'content_updated', 'content_deleted']
    ).select_related(
        'user', 'subject__class_session__classroom', 'subject__teacher'
    ).order_by('-timestamp')


def get_notification_summary_for_user(user):
    """
    Get notification summary statistics for a user
    """
    if user.role == 'admin':
        queryset = get_admin_notifications_queryset()
        
        # For admins, consider notifications from today as "unread"
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        unread_count = queryset.filter(timestamp__gte=today_start).count()
        
    elif user.role == 'student':
        queryset = get_student_notifications_queryset(user)
        
        # Ensure notification status records exist
        for notification in queryset:
            NotificationStatus.objects.get_or_create(
                user=user,
                activity_log=notification,
                defaults={'is_read': False}
            )
        
        unread_count = NotificationStatus.objects.filter(
            user=user,
            activity_log__in=queryset,
            is_read=False
        ).count()
        
    else:
        queryset = ActivityLog.objects.none()
        unread_count = 0

    total_notifications = queryset.count()
    
    # Get content breakdown
    content_summary = {}
    if queryset.exists():
        content_breakdown = queryset.values('content_type').annotate(
            count=Count('id')
        )
        content_summary = {
            item['content_type']: item['count'] 
            for item in content_breakdown 
            if item['content_type']
        }

    return {
        'total_notifications': total_notifications,
        'unread_count': unread_count,
        'content_summary': content_summary,
        'recent_notifications': queryset[:5]
    }


def mark_notifications_as_read_for_user(user, notification_ids=None):
    """
    Mark notifications as read for a specific user
    
    Args:
        user: The user to mark notifications for
        notification_ids: List of specific notification IDs to mark (None for all)
    
    Returns:
        int: Number of notifications marked as read
    """
    if user.role != 'student':
        return 0
    
    queryset = get_student_notifications_queryset(user)
    
    if notification_ids:
        queryset = queryset.filter(id__in=notification_ids)
    
    updated_count = 0
    for notification in queryset:
        notification_status, created = NotificationStatus.objects.get_or_create(
            user=user,
            activity_log=notification,
            defaults={'is_read': True, 'read_at': timezone.now()}
        )
        
        if not created and not notification_status.is_read:
            notification_status.mark_as_read()
            updated_count += 1
        elif created:
            updated_count += 1
    
    return updated_count


def get_notification_analytics():
    """
    Get analytics data for notifications (admin use)
    """
    # Overall statistics
    total_notifications = ActivityLog.objects.filter(is_notification=True).count()
    total_students = NotificationStatus.objects.values('user').distinct().count()
    
    # Recent activity (last 7 days)
    week_ago = timezone.now() - timedelta(days=7)
    recent_notifications = ActivityLog.objects.filter(
        is_notification=True,
        timestamp__gte=week_ago
    ).count()
    
    # Content type breakdown
    content_breakdown = ActivityLog.objects.filter(
        is_notification=True
    ).values('content_type').annotate(
        count=Count('id')
    ).order_by('-count')
    
    # Most active teachers
    teacher_activity = ActivityLog.objects.filter(
        is_notification=True,
        activity_type__in=['content_created', 'content_updated']
    ).values(
        'user__id', 'user__first_name', 'user__last_name'
    ).annotate(
        count=Count('id')
    ).order_by('-count')[:10]
    
    # Most active subjects
    subject_activity = ActivityLog.objects.filter(
        is_notification=True
    ).values(
        'subject__id', 'subject__name', 'subject__department'
    ).annotate(
        count=Count('id')
    ).order_by('-count')[:10]
    
    # Read rate statistics (for students)
    read_stats = NotificationStatus.objects.aggregate(
        total_statuses=Count('id'),
        read_statuses=Count('id', filter=Q(is_read=True))
    )
    
    read_rate = 0
    if read_stats['total_statuses'] > 0:
        read_rate = (read_stats['read_statuses'] / read_stats['total_statuses']) * 100
    
    return {
        'overview': {
            'total_notifications': total_notifications,
            'total_students': total_students,
            'recent_notifications': recent_notifications,
            'read_rate': round(read_rate, 2)
        },
        'content_breakdown': list(content_breakdown),
        'teacher_activity': list(teacher_activity),
        'subject_activity': list(subject_activity)
    }


def cleanup_old_notifications(days_to_keep=90):
    """
    Clean up old notifications and their status records
    
    Args:
        days_to_keep: Number of days to keep notifications (default 90)
    
    Returns:
        dict: Cleanup statistics
    """
    cutoff_date = timezone.now() - timedelta(days=days_to_keep)
    
    # Get old notifications
    old_notifications = ActivityLog.objects.filter(
        is_notification=True,
        timestamp__lt=cutoff_date
    )
    
    # Count before deletion
    notifications_count = old_notifications.count()
    statuses_count = NotificationStatus.objects.filter(
        activity_log__in=old_notifications
    ).count()
    
    # Delete notification statuses first (due to foreign key)
    NotificationStatus.objects.filter(
        activity_log__in=old_notifications
    ).delete()
    
    # Delete old notifications
    old_notifications.delete()
    
    return {
        'deleted_notifications': notifications_count,
        'deleted_statuses': statuses_count,
        'cutoff_date': cutoff_date
    }


def ensure_notification_status_records():
    """
    Ensure all students have notification status records for relevant notifications
    This is useful for migration or fixing missing records
    """
    from users.models import CustomUser
    
    students = CustomUser.objects.filter(role='student')
    created_count = 0
    
    for student in students:
        # Get all notifications relevant to this student
        notifications = get_student_notifications_queryset(student)
        
        for notification in notifications:
            status, created = NotificationStatus.objects.get_or_create(
                user=student,
                activity_log=notification,
                defaults={'is_read': False}
            )
            
            if created:
                created_count += 1
    
    return created_count