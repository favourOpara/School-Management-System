# admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count
from .models import ActivityLog, NotificationStatus, NotificationPreference


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_full_name', 'role', 'activity_type', 'content_type', 
        'content_title', 'subject_name', 'classroom_name', 'is_notification', 
        'timestamp', 'recipient_count'
    ]
    list_filter = [
        'activity_type', 'content_type', 'role', 'is_notification', 
        'timestamp', 'subject__department'
    ]
    search_fields = [
        'user__username', 'user__first_name', 'user__last_name',
        'action', 'content_title', 'subject__name'
    ]
    readonly_fields = [
        'user', 'role', 'timestamp', 'activity_type', 'action',
        'extra_data', 'recipient_count'
    ]
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']
    
    def user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else "Unknown"
    user_full_name.short_description = 'User'
    
    def subject_name(self, obj):
        return obj.subject.name if obj.subject else '-'
    subject_name.short_description = 'Subject'
    
    def classroom_name(self, obj):
        return obj.classroom_name or '-'
    classroom_name.short_description = 'Classroom'
    
    def recipient_count(self, obj):
        if obj.is_notification:
            count = NotificationStatus.objects.filter(activity_log=obj).count()
            return format_html('<span style="color: green;">{}</span>', count)
        return '-'
    recipient_count.short_description = 'Recipients'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'user', 'subject__class_session__classroom'
        )


@admin.register(NotificationStatus)
class NotificationStatusAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_full_name', 'notification_summary', 'is_read', 
        'read_at', 'created_at'
    ]
    list_filter = ['is_read', 'created_at', 'read_at']
    search_fields = [
        'user__username', 'user__first_name', 'user__last_name',
        'activity_log__content_title', 'activity_log__subject__name'
    ]
    readonly_fields = ['user', 'activity_log', 'created_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    actions = ['mark_as_read', 'mark_as_unread']
    
    def user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else "Unknown"
    user_full_name.short_description = 'Student'
    
    def notification_summary(self, obj):
        log = obj.activity_log
        return f"{log.content_type}: {log.content_title} ({log.subject.name if log.subject else 'No Subject'})"
    notification_summary.short_description = 'Notification'
    
    def mark_as_read(self, request, queryset):
        updated = 0
        for status in queryset:
            if not status.is_read:
                status.mark_as_read()
                updated += 1
        self.message_user(request, f'Marked {updated} notifications as read.')
    mark_as_read.short_description = 'Mark selected as read'
    
    def mark_as_unread(self, request, queryset):
        updated = queryset.filter(is_read=True).update(is_read=False, read_at=None)
        self.message_user(request, f'Marked {updated} notifications as unread.')
    mark_as_unread.short_description = 'Mark selected as unread'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'user', 'activity_log__subject'
        )


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_full_name', 'notification_type', 'is_enabled', 
        'email_notifications'
    ]
    list_filter = ['notification_type', 'is_enabled', 'email_notifications']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    ordering = ['user__first_name', 'user__last_name', 'notification_type']
    
    def user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else "Unknown"
    user_full_name.short_description = 'User'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')