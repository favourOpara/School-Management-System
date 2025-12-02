# backend/logs/email_service.py
"""
Email service for sending notification emails via Brevo SMTP
FIXED: Properly uses Django's email backend with connection management
"""

from django.core.mail import get_connection, EmailMultiAlternatives
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def send_notification_email(recipient_user, notification_title, notification_message, notification_type='general', priority='medium'):
    """
    Send notification email to a user using Django's email backend
    
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
        
        # Create plain text version
        plain_message = f"""
FIGIL Schools Notification

{notification_title}

{notification_message}

---
View this notification in your dashboard: https://figilschools.com

This is an automated notification from FIGIL Schools.
For inquiries, contact: {settings.DEFAULT_FROM_EMAIL}
        """
        
        # Create email message
        logger.info(f"Sending email to {recipient_user.email}: {subject}")
        print(f"📧 Sending to {recipient_user.email}...")
        
        # Use EmailMultiAlternatives for HTML email
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_user.email]
        )
        msg.attach_alternative(html_message, "text/html")
        
        # Send with explicit connection (timeout is set in settings)
        msg.send(fail_silently=False)
        
        logger.info(f"✅ Email sent successfully to {recipient_user.email}")
        print(f"✅ Email sent to {recipient_user.email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send email to {recipient_user.email}: {str(e)}")
        print(f"❌ Email failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def send_bulk_emails_with_connection(notifications):
    """
    Send multiple emails efficiently using a single SMTP connection
    This is MUCH faster for bulk emails
    """
    if not notifications:
        return {'total': 0, 'sent': 0, 'failed': 0, 'skipped': 0}
    
    stats = {'total': 0, 'sent': 0, 'failed': 0, 'skipped': 0}
    
    # Open a single connection for all emails
    try:
        connection = get_connection()
        connection.open()
        
        for notification in notifications:
            stats['total'] += 1
            
            if not notification.recipient.email:
                stats['skipped'] += 1
                continue
            
            try:
                # Prepare email
                subject = f"[FIGIL Schools] {notification.title}"
                
                html_content = f"""
                <html><body>
                <h2>{notification.title}</h2>
                <p>{notification.message.replace(chr(10), '<br>')}</p>
                <p><a href="https://figilschools.com">View in Dashboard</a></p>
                </body></html>
                """
                
                plain_content = f"{notification.title}\n\n{notification.message}\n\nView at: https://figilschools.com"
                
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=plain_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[notification.recipient.email],
                    connection=connection  # Reuse the same connection
                )
                msg.attach_alternative(html_content, "text/html")
                msg.send()
                
                stats['sent'] += 1
                print(f"✅ Sent to {notification.recipient.email}")
                
            except Exception as e:
                stats['failed'] += 1
                print(f"❌ Failed to send to {notification.recipient.email}: {e}")
                logger.error(f"Failed to send to {notification.recipient.email}: {e}")
        
        connection.close()
        
    except Exception as e:
        logger.error(f"Failed to open email connection: {e}")
        print(f"❌ Connection error: {e}")
    
    logger.info(f"Bulk email complete: {stats}")
    print(f"📊 Summary: {stats['sent']} sent, {stats['failed']} failed, {stats['skipped']} skipped")
    return stats


def test_email_configuration():
    """
    Test email configuration by sending a test email
    """
    try:
        from django.core.mail import send_mail
        
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