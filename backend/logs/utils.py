from .models import ActivityLog

def log_activity(user, action, extra_data=None):
    ActivityLog.objects.create(
        user=user,
        role=user.role,
        action=action,
        extra_data=extra_data or {}
    )
