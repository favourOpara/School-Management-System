from django.urls import path
from .views import (
    ActivityLogListView, AdminNotificationsView, StudentNotificationsView,
    NotificationSummaryView, MarkNotificationReadView, MarkAllNotificationsReadView,
    StudentSubjectNotificationsView, NotificationPreferencesView,
    NotificationPreferenceDetailView, BulkMarkNotificationsReadView, NotificationDetailView,
    DirectNotificationsView, PendingPopupNotificationsView, MarkPopupShownView,
    MarkDirectNotificationReadView
)

urlpatterns = [
    # General activity logs (admin only)
    path('activities/', ActivityLogListView.as_view(), name='activity-log-list'),

    # Admin notifications
    path('admin/notifications/', AdminNotificationsView.as_view(), name='admin-notifications'),

    # Student notifications
    path('student/notifications/', StudentNotificationsView.as_view(), name='student-notifications'),
    path('student/notifications/subject/<int:subject_id>/', StudentSubjectNotificationsView.as_view(), name='student-subject-notifications'),

    # Notification summary for current user
    path('notifications/summary/', NotificationSummaryView.as_view(), name='notification-summary'),

    # Notification detail view
    path('notifications/<int:notification_id>/detail/', NotificationDetailView.as_view(), name='notification-detail'),

    # Mark notifications as read
    path('notifications/<int:notification_id>/read/', MarkNotificationReadView.as_view(), name='mark-notification-read'),
    path('notifications/read-all/', MarkAllNotificationsReadView.as_view(), name='mark-all-notifications-read'),
    path('notifications/bulk-read/', BulkMarkNotificationsReadView.as_view(), name='bulk-mark-notifications-read'),

    # Notification preferences
    path('notifications/preferences/', NotificationPreferencesView.as_view(), name='notification-preferences'),
    path('notifications/preferences/<int:pk>/', NotificationPreferenceDetailView.as_view(), name='notification-preference-detail'),

    # Direct notifications (Notification model)
    path('notifications/direct/', DirectNotificationsView.as_view(), name='direct-notifications'),
    path('notifications/pending-popups/', PendingPopupNotificationsView.as_view(), name='pending-popup-notifications'),
    path('notifications/<int:notification_id>/popup-shown/', MarkPopupShownView.as_view(), name='mark-popup-shown'),
    path('notifications/<int:notification_id>/read-direct/', MarkDirectNotificationReadView.as_view(), name='mark-direct-notification-read'),
]