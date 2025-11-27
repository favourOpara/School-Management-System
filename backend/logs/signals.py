# signals.py
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from academics.models import SubjectContent
from .models import ActivityLog, Notification, NotificationStatus
from .email_service import send_notification_email
import logging

logger = logging.getLogger(__name__)


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


@receiver(post_save, sender=Notification)
def send_notification_email_on_create(sender, instance, created, **kwargs):
    """
    Automatically send email notification when a Notification object is created
    This ensures all in-app notifications are also sent via email

    IMPORTANT: Email sending is deferred until AFTER the database transaction commits
    using transaction.on_commit(). This prevents emails from blocking the HTTP response.
    """
    if created:
        logger.info(f"New notification created for {instance.recipient.username}: {instance.title}")

        # Defer email sending until after the transaction commits
        # This prevents blocking the HTTP response while emails are being sent
        from django.db import transaction

        def send_email_after_commit():
            try:
                send_notification_email(
                    recipient_user=instance.recipient,
                    notification_title=instance.title,
                    notification_message=instance.message,
                    notification_type=instance.notification_type,
                    priority=instance.priority
                )
            except Exception as e:
                logger.error(f"Failed to send email for notification {instance.id}: {str(e)}")

        transaction.on_commit(send_email_after_commit)


@receiver(post_save, sender=NotificationStatus)
def send_activity_notification_email(sender, instance, created, **kwargs):
    """
    Send email when NotificationStatus is created (for teacher content uploads)
    These are notifications about new assignments, notes, etc.

    IMPORTANT: Email sending is deferred until AFTER the database transaction commits
    """
    if created and instance.activity_log.is_notification:
        logger.info(f"Activity notification created for {instance.user.username}: {instance.activity_log.action}")

        from django.db import transaction

        def send_email_after_commit():
            try:
                # Get the activity log details
                activity = instance.activity_log

                # Create notification title and message
                title = f"New {activity.content_type}: {activity.content_title}"
                message = f"{activity.action}\n\n"

                if activity.subject:
                    message += f"Subject: {activity.subject.name}\n"
                    if activity.subject.class_session and activity.subject.class_session.classroom:
                        message += f"Class: {activity.subject.class_session.classroom.name}\n"
                    message += f"Academic Year: {activity.subject.class_session.academic_year}\n"
                    message += f"Term: {activity.subject.class_session.term}\n"

                # Send email
                send_notification_email(
                    recipient_user=instance.user,
                    notification_title=title,
                    notification_message=message,
                    notification_type=activity.content_type if activity.content_type else 'general',
                    priority='medium'
                )
            except Exception as e:
                logger.error(f"Failed to send activity email for NotificationStatus {instance.id}: {str(e)}")

        transaction.on_commit(send_email_after_commit)