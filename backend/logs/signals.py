# backend/logs/signals.py - DEBUG VERSION WITH EXTENSIVE LOGGING
# ============================================================================
# Replace your current signals.py with this to see exactly what's happening
# ============================================================================

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from academics.models import SubjectContent
from .models import ActivityLog, Notification, NotificationStatus
import logging

logger = logging.getLogger(__name__)

# Force logger to show all messages
logger.setLevel(logging.DEBUG)


@receiver(post_save, sender=SubjectContent)
def create_content_notification(sender, instance, created, **kwargs):
    """
    Create notification when teacher uploads/updates content
    """
    if created and instance.created_by:
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
    elif not created and instance.created_by:
        # Content was updated
        print(f"Creating update notification for: {instance.title}")
        ActivityLog.log_content_activity(
            user=instance.created_by,
            subject=instance.subject,
            content_type=instance.content_type,
            content_title=instance.title,
            content_id=instance.id,
            activity_type='content_updated'
        )
        print(f"Update notification created successfully for: {instance.title}")


@receiver(post_delete, sender=SubjectContent)
def create_content_deletion_notification(sender, instance, **kwargs):
    """
    Create notification when teacher deletes content
    """
    if instance.created_by:
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
    DEBUG VERSION - Prints everything to help debug
    """
    print("=" * 80)
    print(f"🔔 POST_SAVE SIGNAL TRIGGERED FOR NOTIFICATION")
    print(f"   Notification ID: {instance.id}")
    print(f"   Created: {created}")
    print(f"   Recipient: {instance.recipient.username}")
    print(f"   Email: {instance.recipient.email}")
    print(f"   Title: {instance.title}")
    print("=" * 80)
    
    logger.info(f"🔔 POST_SAVE signal triggered - ID: {instance.id}, Created: {created}")
    
    if created:
        logger.info(f"✅ NEW notification created for {instance.recipient.username}: {instance.title}")
        print(f"✅ This is a NEW notification - will attempt to send email")
        
        # Check if recipient has email
        if not instance.recipient.email:
            logger.warning(f"⚠️ User {instance.recipient.username} has NO email address!")
            print(f"⚠️ SKIPPING: User has NO email address")
            return
        
        print(f"📧 Recipient email: {instance.recipient.email}")
        
        # Try to import email service
        try:
            from .email_service import send_notification_email
            print(f"✅ Email service imported successfully")
            logger.info("✅ Email service imported successfully")
        except ImportError as e:
            print(f"❌ FAILED to import email_service: {e}")
            logger.error(f"❌ Failed to import email_service: {e}")
            return
        
        # Defer email sending until after transaction commits
        from django.db import transaction

        def send_email_after_commit():
            print(f"🚀 ATTEMPTING TO SEND EMAIL to {instance.recipient.email}")
            logger.info(f"🚀 Attempting to send email to {instance.recipient.email}")
            
            try:
                result = send_notification_email(
                    recipient_user=instance.recipient,
                    notification_title=instance.title,
                    notification_message=instance.message,
                    notification_type=instance.notification_type,
                    priority=instance.priority
                )
                
                if result:
                    print(f"✅ EMAIL SENT SUCCESSFULLY to {instance.recipient.email}")
                    logger.info(f"✅ Email sent successfully to {instance.recipient.email}")
                else:
                    print(f"❌ EMAIL SENDING RETURNED FALSE for {instance.recipient.email}")
                    logger.error(f"❌ Email sending returned False for {instance.recipient.email}")
                    
            except Exception as e:
                print(f"❌ EXCEPTION while sending email: {str(e)}")
                logger.error(f"❌ Failed to send email for notification {instance.id}: {str(e)}")
                logger.exception(e)

        print(f"⏳ Deferring email send until after database commit")
        transaction.on_commit(send_email_after_commit)
    else:
        print(f"ℹ️ This is an UPDATE to existing notification - NOT sending email")
        logger.info(f"ℹ️ Notification {instance.id} updated - not sending email")


@receiver(post_save, sender=NotificationStatus)
def send_activity_notification_email(sender, instance, created, **kwargs):
    """
    Send email when NotificationStatus is created (for teacher content uploads)
    """
    if created and instance.activity_log.is_notification:
        logger.info(f"Activity notification created for {instance.user.username}: {instance.activity_log.action}")

        from django.db import transaction

        def send_email_after_commit():
            try:
                from .email_service import send_notification_email
                
                activity = instance.activity_log

                title = f"New {activity.content_type}: {activity.content_title}"
                message = f"{activity.action}\n\n"

                if activity.subject:
                    message += f"Subject: {activity.subject.name}\n"
                    if activity.subject.class_session and activity.subject.class_session.classroom:
                        message += f"Class: {activity.subject.class_session.classroom.name}\n"
                    message += f"Academic Year: {activity.subject.class_session.academic_year}\n"
                    message += f"Term: {activity.subject.class_session.term}\n"

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