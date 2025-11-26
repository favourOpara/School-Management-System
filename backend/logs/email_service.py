"""
Email notification service for sending notifications to users
All notifications sent in-app will also be emailed to users
"""

from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import render_to_string
import logging

logger = logging.getLogger(__name__)


def send_notification_email(recipient_user, notification_title, notification_message, notification_type='general', priority='medium'):
    """
    Send email notification to a user

    Args:
        recipient_user: User object who will receive the email
        notification_title: Title of the notification
        notification_message: Message content
        notification_type: Type of notification (e.g., 'report_release', 'fee_reminder')
        priority: Priority level (low, medium, high)

    Returns:
        bool: True if email sent successfully, False otherwise
    """

    # Check if user has email
    if not recipient_user.email:
        logger.warning(f"User {recipient_user.username} has no email address. Cannot send notification.")
        return False

    try:
        # Create subject line based on priority and type
        priority_prefix = {
            'high': '[URGENT] ',
            'medium': '',
            'low': ''
        }.get(priority, '')

        subject = f"{priority_prefix}{notification_title}"

        # Create email body with HTML formatting
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
                    border-radius: 10px;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background-color: white;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .priority-high {{
                    border-left: 5px solid #f44336;
                    padding-left: 15px;
                }}
                .priority-medium {{
                    border-left: 5px solid #ff9800;
                    padding-left: 15px;
                }}
                .priority-low {{
                    border-left: 5px solid #2196F3;
                    padding-left: 15px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    color: #777;
                    font-size: 12px;
                }}
                .message {{
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }}
                .notification-type {{
                    display: inline-block;
                    background-color: #e0e0e0;
                    padding: 5px 10px;
                    border-radius: 5px;
                    font-size: 12px;
                    margin-bottom: 15px;
                    text-transform: uppercase;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Figil Schools</h1>
                    <p>School Management System</p>
                </div>
                <div class="content">
                    <div class="notification-type">{notification_type.replace('_', ' ')}</div>
                    <div class="priority-{priority}">
                        <h2>{notification_title}</h2>
                    </div>
                    <div class="message">
                        {notification_message}
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from Figil Schools.</p>
                        <p>Please log in to the school portal to view more details.</p>
                        <p>&copy; {settings.ACADEMIC_YEAR if hasattr(settings, 'ACADEMIC_YEAR') else '2024'} Figil Schools. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        # Plain text version for email clients that don't support HTML
        plain_message = f"""
        FIGIL SCHOOLS - {notification_type.replace('_', ' ').upper()}
        {'='*50}

        {notification_title}

        {notification_message}

        {'='*50}
        This is an automated notification from Figil Schools.
        Please log in to the school portal to view more details.

        © Figil Schools. All rights reserved.
        """

        # Create email
        email = EmailMessage(
            subject=subject,
            body=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_user.email],
        )

        # Attach HTML version
        email.content_subtype = "html"
        email.body = html_message

        # Send email
        email.send(fail_silently=False)

        logger.info(f"Email notification sent to {recipient_user.email} ({recipient_user.username}): {notification_title}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {recipient_user.email} ({recipient_user.username}): {str(e)}")
        return False


def send_bulk_notification_emails(recipients, notification_title, notification_message, notification_type='general', priority='medium'):
    """
    Send email notifications to multiple users

    Args:
        recipients: List of User objects
        notification_title: Title of the notification
        notification_message: Message content
        notification_type: Type of notification
        priority: Priority level

    Returns:
        dict: {'success': int, 'failed': int, 'total': int}
    """
    success_count = 0
    failed_count = 0

    for recipient in recipients:
        if send_notification_email(recipient, notification_title, notification_message, notification_type, priority):
            success_count += 1
        else:
            failed_count += 1

    result = {
        'success': success_count,
        'failed': failed_count,
        'total': len(recipients)
    }

    logger.info(f"Bulk email send completed: {success_count} sent, {failed_count} failed out of {len(recipients)} total")
    return result
