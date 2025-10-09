# signals.py
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from academics.models import SubjectContent
from .models import ActivityLog


@receiver(post_save, sender=SubjectContent)
def create_content_notification(sender, instance, created, **kwargs):
    """
    Create notification when teacher uploads/updates content
    """
    if created and instance.created_by:  # ADDED: Check if created_by exists
        print(f"Creating notification for new content: {instance.title}")
        ActivityLog.log_content_activity(
            user=instance.created_by,
            subject=instance.subject,
            content_type=instance.content_type,
            content_title=instance.title,
            content_id=instance.id,
            activity_type='content_created'
        )
        print(f"Notification created successfully for: {instance.title}")


@receiver(post_delete, sender=SubjectContent)
def create_content_deletion_notification(sender, instance, **kwargs):
    """
    Create notification when teacher deletes content
    Only log if created_by exists (content might have been created by deleted user)
    """
    if instance.created_by:  # ADDED: Check if created_by exists
        print(f"Creating deletion notification for: {instance.title}")
        ActivityLog.log_content_activity(
            user=instance.created_by,
            subject=instance.subject,
            content_type=instance.content_type,
            content_title=instance.title,
            content_id=instance.id,
            activity_type='content_deleted'
        )
    else:
        print(f"Skipping deletion notification for: {instance.title} (no creator found)")