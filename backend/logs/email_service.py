# backend/logs/email_service.py
"""
Email service for sending notification emails via Brevo SMTP
This service is called by signals when notifications are created
"""

from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


def send_notification_email(recipient_user, notification_title, notification_message, notification_type='general', priority='medium'):
    """
    Send notification email to a user
    
    Args:
        recipient_user: User object to send email to
        notification_title: Title of the notification
        notification_message: Message content
        notification_type: Type of notification (announcement, assignment, etc.)
        priority: Priority level (low, medium, high)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    
    # Check if user has an email address
    if not recipient_user.email:
        logger.warning(f"User {recipient_user.username} has no email address. Skipping email.")
        return False
    
    # Check if user wants email notifications (if preference exists)
    try:
        from .models import NotificationPreference
        pref = NotificationPreference.objects.filter(
            user=recipient_user,
            notification_type=notification_type,
            email_notifications=True
        ).first()
        
        # If user has explicitly disabled email for this type, skip
        if pref and not pref.email_notifications:
            logger.info(f"User {recipient_user.username} has disabled email notifications for {notification_type}")
            return False
            
    except Exception as e:
        # If no preference set, send email by default
        logger.debug(f"No notification preference found for {recipient_user.username}, sending email by default")
    
    try:
        # Prepare email content
        subject = f"[FIGIL Schools] {notification_title}"
        
        # Create HTML email body
        html_message = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: white;
                    padding: 30px;
                    border-radius: 0 0 5px 5px;
                }}
                .priority-high {{
                    border-left: 4px solid #f44336;
                    padding-left: 15px;
                }}
                .priority-medium {{
                    border-left: 4px solid #ff9800;
                    padding-left: 15px;
                }}
                .priority-low {{
                    border-left: 4px solid #2196F3;
                    padding-left: 15px;
                }}
                .footer {{
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #4CAF50;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin-top: 15px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>FIGIL Schools Notification</h1>
                </div>
                <div class="content">
                    <div class="priority-{priority}">
                        <h2>{notification_title}</h2>
                        <p>{notification_message.replace(chr(10), '<br>')}</p>
                    </div>
                    
                    <p style="margin-top: 30px;">
                        <a href="https://figilschools.com" class="button">View in Dashboard</a>
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated notification from FIGIL Schools.</p>
                    <p>Please do not reply to this email.</p>
                    <p>For inquiries, contact: {settings.DEFAULT_FROM_EMAIL}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create plain text version (fallback for email clients that don't support HTML)
        plain_message = f"""
        FIGIL Schools Notification
        
        {notification_title}
        
        {notification_message}
        
        ---
        View this notification in your dashboard: https://figilschools.com
        
        This is an automated notification from FIGIL Schools.
        For inquiries, contact: {settings.DEFAULT_FROM_EMAIL}
        """
        
        # Send the email
        logger.info(f"Sending email to {recipient_user.email}: {subject}")
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"✅ Email sent successfully to {recipient_user.email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send email to {recipient_user.email}: {str(e)}")
        logger.exception(e)  # Log full traceback
        return False


def send_bulk_notification_emails(notifications):
    """
    Send multiple notification emails efficiently
    
    Args:
        notifications: QuerySet or list of Notification objects
    
    Returns:
        dict: Statistics about emails sent
    """
    stats = {
        'total': 0,
        'sent': 0,
        'failed': 0,
        'skipped': 0
    }
    
    for notification in notifications:
        stats['total'] += 1
        
        result = send_notification_email(
            recipient_user=notification.recipient,
            notification_title=notification.title,
            notification_message=notification.message,
            notification_type=notification.notification_type,
            priority=notification.priority
        )
        
        if result:
            stats['sent'] += 1
        elif result is False:
            stats['failed'] += 1
        else:
            stats['skipped'] += 1
    
    logger.info(f"Bulk email sending complete: {stats}")
    return stats


def test_email_configuration():
    """
    Test email configuration by sending a test email
    Returns True if successful, False otherwise
    """
    try:
        send_mail(
            subject='Test Email - FIGIL Schools',
            message='This is a test email to verify SMTP configuration.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.DEFAULT_FROM_EMAIL],
            fail_silently=False,
        )
        logger.info("✅ Test email sent successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Test email failed: {str(e)}")
        logger.exception(e)
        return False