from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Count, Case, When, IntegerField, Prefetch
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import ActivityLog, NotificationStatus, NotificationPreference
from .serializers import (
    ActivityLogSerializer, AdminNotificationSerializer,
    StudentNotificationSerializer, NotificationStatusSerializer,
    NotificationSummarySerializer, NotificationPreferenceSerializer
)
from academics.models import StudentSession


class IsAdminRole(permissions.BasePermission):
    """Allow access to admin and principal roles"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'principal']


class ActivityLogListView(generics.ListAPIView):
    """Admin and Principal: View all activity logs"""
    queryset = ActivityLog.objects.all().select_related(
        'user', 'subject__class_session__classroom'
    ).order_by('-timestamp')
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAdminRole]


class AdminNotificationsView(generics.ListAPIView):
    """Admin and Principal notifications: All content activities from teachers"""
    serializer_class = AdminNotificationSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        """Return all content-related notifications"""
        return ActivityLog.objects.filter(
            is_notification=True,
            activity_type__in=['content_created', 'content_updated', 'content_deleted']
        ).select_related(
            'user', 'subject__class_session__classroom', 'subject__teacher'
        ).order_by('-timestamp')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Apply filters
        content_type = request.query_params.get('content_type')
        subject_id = request.query_params.get('subject')
        teacher_id = request.query_params.get('teacher')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if content_type:
            queryset = queryset.filter(content_type=content_type)
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if teacher_id:
            queryset = queryset.filter(user_id=teacher_id)
        if date_from:
            queryset = queryset.filter(timestamp__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(timestamp__date__lte=date_to)
        
        # Pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        
        # Add summary data
        total_notifications = queryset.count()
        today_notifications = queryset.filter(timestamp__date=timezone.now().date()).count()
        
        content_summary = queryset.values('content_type').annotate(
            count=Count('id')
        ).order_by('-count')
        
        teacher_summary = queryset.values('user__id', 'user__first_name', 'user__last_name').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        subject_summary = queryset.values('subject__id', 'subject__name').annotate(
            count=Count('id')
        ).order_by('-count')[:10]

        return Response({
            'notifications': serializer.data,
            'summary': {
                'total_notifications': total_notifications,
                'today_notifications': today_notifications,
                'content_breakdown': list(content_summary),
                'top_teachers': list(teacher_summary),
                'top_subjects': list(subject_summary)
            }
        })


class StudentNotificationsView(generics.ListAPIView):
    """Student notifications: Content from subjects they're enrolled in"""
    serializer_class = StudentNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return notifications for subjects the student is enrolled in"""
        user = self.request.user
        
        if user.role != 'student':
            return ActivityLog.objects.none()

        # Get all subjects the student is enrolled in (active sessions)
        student_sessions = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).select_related('class_session')

        # Get the class sessions this student is in
        class_session_ids = student_sessions.values_list('class_session_id', flat=True)

        # Get notifications for subjects in those class sessions
        notifications = ActivityLog.objects.filter(
            is_notification=True,
            activity_type__in=['content_created', 'content_updated'],
            subject__class_session_id__in=class_session_ids
        ).select_related(
            'user', 'subject__class_session__classroom'
        )
        
        # Filter by department for SS classes
        filtered_notifications = []
        for notification in notifications:
            subject = notification.subject
            
            # Check if student should see this notification based on department
            if (subject and subject.class_session.classroom and 
                subject.class_session.classroom.name.startswith('S.S.S.') and 
                subject.department != 'General' and 
                user.department != subject.department):
                continue
            
            filtered_notifications.append(notification.id)
        
        return ActivityLog.objects.filter(
            id__in=filtered_notifications
        ).order_by('-timestamp')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Ensure notification status records exist for all notifications
        for notification in queryset:
            NotificationStatus.objects.get_or_create(
                user=request.user,
                activity_log=notification,
                defaults={'is_read': False}
            )
        
        # Apply filters
        content_type = request.query_params.get('content_type')
        subject_id = request.query_params.get('subject')
        unread_only = request.query_params.get('unread_only', '').lower() == 'true'
        
        if content_type:
            queryset = queryset.filter(content_type=content_type)
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if unread_only:
            # Filter for unread notifications only
            unread_notification_ids = NotificationStatus.objects.filter(
                user=request.user,
                activity_log__in=queryset,
                is_read=False
            ).values_list('activity_log_id', flat=True)
            queryset = queryset.filter(id__in=unread_notification_ids)
        
        # Pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        
        # Add summary data
        total_notifications = queryset.count()
        unread_count = NotificationStatus.objects.filter(
            user=request.user,
            activity_log__in=queryset,
            is_read=False
        ).count()
        
        content_summary = queryset.values('content_type').annotate(
            count=Count('id')
        ).order_by('-count')
        
        subject_summary = queryset.values('subject__id', 'subject__name').annotate(
            count=Count('id')
        ).order_by('-count')

        return Response({
            'notifications': serializer.data,
            'summary': {
                'total_notifications': total_notifications,
                'unread_count': unread_count,
                'content_breakdown': list(content_summary),
                'subject_breakdown': list(subject_summary)
            }
        })


class NotificationSummaryView(APIView):
    """Get notification summary for the current user"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role in ['admin', 'principal']:
            # Admin and Principal see all content notifications
            queryset = ActivityLog.objects.filter(
                is_notification=True,
                activity_type__in=['content_created', 'content_updated', 'content_deleted']
            ).select_related('user', 'subject')

            # For admins and principals, consider notifications from today as "unread"
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            unread_count = queryset.filter(timestamp__gte=today_start).count()
            
        elif user.role == 'student':
            # Students see notifications for their subjects
            student_sessions = StudentSession.objects.filter(
                student=user,
                is_active=True
            ).select_related('class_session')

            class_session_ids = student_sessions.values_list('class_session_id', flat=True)

            queryset = ActivityLog.objects.filter(
                is_notification=True,
                activity_type__in=['content_created', 'content_updated'],
                subject__class_session_id__in=class_session_ids
            ).select_related('user', 'subject')
            
            # Filter by department for SS classes
            filtered_notifications = []
            for notification in queryset:
                subject = notification.subject
                
                if (subject and subject.class_session.classroom and 
                    subject.class_session.classroom.name.startswith('S.S.S.') and 
                    subject.department != 'General' and 
                    user.department != subject.department):
                    continue
                
                filtered_notifications.append(notification.id)
            
            queryset = ActivityLog.objects.filter(id__in=filtered_notifications)
            
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
            
        elif user.role == 'teacher':
            # Teachers might see notifications about their own activities or grading-related ones
            queryset = ActivityLog.objects.filter(
                Q(user=user) | Q(activity_type='assignment_graded'),
                is_notification=True
            ).select_related('user', 'subject')
            unread_count = 0  # Teachers don't have read status tracking yet
            
        else:
            queryset = ActivityLog.objects.none()
            unread_count = 0

        total_notifications = queryset.count()
        recent_notifications = queryset.order_by('-timestamp')[:5]
        
        content_summary = {}
        if queryset.exists():
            content_breakdown = queryset.values('content_type').annotate(
                count=Count('id')
            )
            content_summary = {item['content_type']: item['count'] for item in content_breakdown}

        serializer = ActivityLogSerializer(recent_notifications, many=True)
        
        summary_data = {
            'total_notifications': total_notifications,
            'unread_count': unread_count,
            'recent_notifications': serializer.data,
            'content_summary': content_summary,
            'user_role': user.role
        }
        
        return Response(summary_data)


class MarkNotificationReadView(APIView):
    """Mark a notification as read for the current user"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        try:
            activity_log = ActivityLog.objects.get(id=notification_id, is_notification=True)
            
            # Only students have notification status tracking
            if request.user.role == 'student':
                notification_status, created = NotificationStatus.objects.get_or_create(
                    user=request.user,
                    activity_log=activity_log,
                    defaults={'is_read': True, 'read_at': timezone.now()}
                )
                
                if not created:
                    notification_status.mark_as_read()
                
                return Response({'message': 'Notification marked as read'})
            else:
                return Response({'message': 'Notification read status not applicable for your role'})
            
        except ActivityLog.DoesNotExist:
            return Response(
                {'error': 'Notification not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class MarkAllNotificationsReadView(APIView):
    """Mark all notifications as read for the current user"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        
        if user.role == 'student':
            # Get all notifications for student's subjects
            student_sessions = StudentSession.objects.filter(
                student=user,
                is_active=True
            ).select_related('class_session')

            class_session_ids = student_sessions.values_list('class_session_id', flat=True)

            notifications = ActivityLog.objects.filter(
                is_notification=True,
                activity_type__in=['content_created', 'content_updated'],
                subject__class_session_id__in=class_session_ids
            )
            
            # Filter by department for SS classes
            filtered_notifications = []
            for notification in notifications:
                subject = notification.subject
                
                if (subject and subject.class_session.classroom and 
                    subject.class_session.classroom.name.startswith('S.S.S.') and 
                    subject.department != 'General' and 
                    user.department != subject.department):
                    continue
                
                filtered_notifications.append(notification.id)
            
            notifications = ActivityLog.objects.filter(id__in=filtered_notifications)
            
            # Mark all as read
            updated_count = 0
            for notification in notifications:
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
            
            return Response({
                'message': f'Marked {updated_count} notifications as read'
            })
        
        else:
            return Response({
                'message': 'No notifications to mark as read'
            })


class StudentSubjectNotificationsView(generics.ListAPIView):
    """Get notifications for a specific subject (student only)"""
    serializer_class = StudentNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        subject_id = self.kwargs.get('subject_id')
        
        if user.role != 'student':
            return ActivityLog.objects.none()
        
        # Verify student is enrolled in the subject
        student_sessions = StudentSession.objects.filter(
            student=user,
            is_active=True,
            class_session__subjects__id=subject_id
        )
        
        if not student_sessions.exists():
            return ActivityLog.objects.none()
        
        # Get notifications for this specific subject
        notifications = ActivityLog.objects.filter(
            is_notification=True,
            activity_type__in=['content_created', 'content_updated'],
            subject_id=subject_id
        ).select_related('user', 'subject__class_session__classroom')
        
        # Check department filtering for SS classes
        filtered_notifications = []
        for notification in notifications:
            subject = notification.subject
            
            if (subject and subject.class_session.classroom and 
                subject.class_session.classroom.name.startswith('S.S.S.') and 
                subject.department != 'General' and 
                user.department != subject.department):
                continue
            
            filtered_notifications.append(notification.id)
        
        return ActivityLog.objects.filter(
            id__in=filtered_notifications
        ).order_by('-timestamp')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        if not queryset.exists():
            return Response({
                'message': 'No notifications found for this subject or you are not enrolled in it',
                'notifications': [],
                'summary': {
                    'total_notifications': 0,
                    'unread_count': 0
                }
            })
        
        # Ensure notification status records exist
        for notification in queryset:
            NotificationStatus.objects.get_or_create(
                user=request.user,
                activity_log=notification,
                defaults={'is_read': False}
            )
        
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        
        unread_count = NotificationStatus.objects.filter(
            user=request.user,
            activity_log__in=queryset,
            is_read=False
        ).count()
        
        return Response({
            'notifications': serializer.data,
            'summary': {
                'total_notifications': queryset.count(),
                'unread_count': unread_count
            }
        })


class NotificationPreferencesView(generics.ListCreateAPIView):
    """Manage notification preferences for the current user"""
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationPreferenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Update or delete a specific notification preference"""
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)


class BulkMarkNotificationsReadView(APIView):
    """Mark multiple notifications as read"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        notification_ids = request.data.get('notification_ids', [])
        
        if not notification_ids:
            return Response(
                {'error': 'notification_ids required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if request.user.role != 'student':
            return Response(
                {'message': 'Bulk read marking not applicable for your role'}
            )
        
        # Get valid notifications
        notifications = ActivityLog.objects.filter(
            id__in=notification_ids,
            is_notification=True
        )
        
        updated_count = 0
        for notification in notifications:
            notification_status, created = NotificationStatus.objects.get_or_create(
                user=request.user,
                activity_log=notification,
                defaults={'is_read': True, 'read_at': timezone.now()}
            )
            
            if not created and not notification_status.is_read:
                notification_status.mark_as_read()
                updated_count += 1
            elif created:
                updated_count += 1
        
        return Response({
            'message': f'Marked {updated_count} notifications as read'
        })
# Add this to your logs/views.py

class NotificationDetailView(APIView):
    """Get detailed information about a specific notification"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, notification_id):
        try:
            notification = ActivityLog.objects.select_related(
                'user', 'subject__class_session__classroom'
            ).get(id=notification_id, is_notification=True)
            
            # Check permissions
            user = request.user
            if user.role in ['admin', 'principal']:
                # Admins and Principals can see all notifications
                pass
            elif user.role == 'student':
                # Students can only see notifications for their subjects
                from academics.models import StudentSession
                
                student_sessions = StudentSession.objects.filter(
                    student=user,
                    is_active=True
                ).values_list('class_session_id', flat=True)
                
                if not notification.subject or notification.subject.class_session_id not in student_sessions:
                    return Response(
                        {'error': 'You do not have permission to view this notification'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Check department filtering for SS classes
                if (notification.subject.class_session.classroom and 
                    notification.subject.class_session.classroom.name.startswith('S.S.S.') and 
                    notification.subject.department != 'General' and 
                    user.department != notification.subject.department):
                    return Response(
                        {'error': 'You do not have permission to view this notification'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                return Response(
                    {'error': 'Notifications not available for your role'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get content details
            content_details = None
            debug_info = {
                'has_content_id': bool(notification.content_id),
                'content_id_value': notification.content_id,
                'has_content_type': bool(notification.content_type),
                'content_type_value': notification.content_type
            }

            if notification.content_id and notification.content_type:
                try:
                    from academics.models import SubjectContent
                    from academics.serializers import StudentAssignmentListSerializer

                    # Get the content exactly like StudentAssignmentListView does
                    content = SubjectContent.objects.select_related(
                        'subject',
                        'subject__class_session',
                        'subject__class_session__classroom',
                        'subject__teacher'
                    ).prefetch_related('files').get(id=notification.content_id)

                    # Get file details with signed URLs
                    files = []
                    for file_obj in content.files.all():
                        files.append({
                            'id': file_obj.id,
                            'original_name': file_obj.original_name,
                            'file_url': file_obj.download_url,
                            'formatted_file_size': file_obj.formatted_file_size,
                            'file_extension': file_obj.file_extension if hasattr(file_obj, 'file_extension') else None
                        })

                    # Build content details
                    content_details = {
                        'id': content.id,
                        'title': content.title,
                        'description': content.description,
                        'created_at': content.created_at,
                        'due_date': content.due_date,
                        'max_score': content.max_score,
                        'files': files,
                        'files_count': len(files),
                        'teacher_name': f"{content.created_by.first_name} {content.created_by.last_name}" if content.created_by else "Unknown",
                        'subject_name': content.subject.name if content.subject else "Unknown",
                        'classroom_name': content.subject.class_session.classroom.name if content.subject and content.subject.class_session and content.subject.class_session.classroom else "Unknown"
                    }
                except SubjectContent.DoesNotExist:
                    # Content was deleted
                    content_details = {
                        'deleted': True,
                        'message': f'This content has been deleted (content_id: {notification.content_id})',
                        'debug': debug_info
                    }
                except Exception as e:
                    # Log error and return debug info
                    import logging
                    import traceback
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error fetching content details for notification {notification.id}: {str(e)}")
                    logger.error(traceback.format_exc())
                    content_details = {
                        'error': True,
                        'message': f'Error loading content: {str(e)}',
                        'debug': debug_info
                    }
            else:
                # No content_id or content_type - this might be an old notification
                content_details = {
                    'no_content_id': True,
                    'message': 'No content reference found in this notification',
                    'debug': debug_info
                }
            
            # Build response
            response_data = {
                'id': notification.id,
                'title': notification.content_title,
                'action': notification.action,
                'activity_type': notification.activity_type,
                'content_type': notification.content_type,
                'timestamp': notification.timestamp,
                'time_ago': self.get_time_ago(notification.timestamp),
                'teacher': {
                    'id': notification.user.id,
                    'name': f"{notification.user.first_name} {notification.user.last_name}",
                    'username': notification.user.username
                },
                'subject': {
                    'id': notification.subject.id,
                    'name': notification.subject.name,
                    'department': notification.subject.department,
                    'classroom': notification.subject.class_session.classroom.name if notification.subject.class_session.classroom else None,
                    'academic_year': notification.subject.class_session.academic_year if notification.subject.class_session else None,
                    'term': notification.subject.class_session.term if notification.subject.class_session else None
                } if notification.subject else None,
                'content_details': content_details,
                'extra_data': notification.extra_data
            }
            
            # Mark as read for students
            if user.role == 'student':
                notification_status, created = NotificationStatus.objects.get_or_create(
                    user=user,
                    activity_log=notification,
                    defaults={'is_read': True, 'read_at': timezone.now()}
                )
                
                if not created and not notification_status.is_read:
                    notification_status.mark_as_read()
                
                response_data['read_status'] = {
                    'is_read': True,
                    'read_at': notification_status.read_at
                }
            
            return Response(response_data)
            
        except ActivityLog.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def get_time_ago(self, timestamp):
        """Helper method to get human-readable time difference"""
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        diff = now - timestamp

        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            return f"{diff.seconds // 60} minutes ago"
        elif diff < timedelta(days=1):
            return f"{diff.seconds // 3600} hours ago"
        elif diff < timedelta(days=7):
            return f"{diff.days} days ago"
        else:
            return timestamp.strftime("%b %d, %Y at %I:%M %p")


class DirectNotificationsView(APIView):
    """Get direct notifications (Notification model) for the current user"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Notification

        # Get all notifications for the user first (without slicing)
        all_notifications = Notification.objects.filter(
            recipient=request.user
        ).order_by('-created_at')

        # Count unread before slicing
        unread_count = all_notifications.filter(is_read=False).count()

        # Now slice for display
        notifications = all_notifications[:50]

        notifications_data = []
        for notif in notifications:
            notifications_data.append({
                'id': notif.id,
                'title': notif.title,
                'message': notif.message,
                'notification_type': notif.notification_type,
                'priority': notif.priority,
                'is_read': notif.is_read,
                'is_popup_shown': notif.is_popup_shown,
                'created_at': notif.created_at,
                'read_at': notif.read_at,
                'extra_data': notif.extra_data
            })

        return Response({
            'notifications': notifications_data,
            'unread_count': unread_count
        })


class PendingPopupNotificationsView(APIView):
    """Get notifications that need to show popup (popup not yet shown)"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Notification

        # Get notifications that haven't been shown as popup yet
        pending_popups = Notification.objects.filter(
            recipient=request.user,
            is_popup_shown=False
        ).order_by('-created_at')

        notifications_data = []
        for notif in pending_popups:
            notifications_data.append({
                'id': notif.id,
                'title': notif.title,
                'message': notif.message,
                'notification_type': notif.notification_type,
                'priority': notif.priority,
                'created_at': notif.created_at,
                'extra_data': notif.extra_data
            })

        return Response({
            'notifications': notifications_data,
            'count': len(notifications_data)
        })


class MarkPopupShownView(APIView):
    """Mark a notification's popup as shown"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        from .models import Notification

        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient=request.user
            )
            notification.mark_popup_shown()

            return Response({
                'message': 'Popup marked as shown',
                'notification_id': notification_id
            })
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class MarkDirectNotificationReadView(APIView):
    """Mark a direct notification as read"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        from .models import Notification

        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient=request.user
            )
            notification.mark_as_read()

            return Response({
                'message': 'Notification marked as read',
                'notification_id': notification_id,
                'read_at': notification.read_at
            })
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )