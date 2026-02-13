# backend/logs/email_service.py
"""
Email service using Brevo Transactional Email API v3
Official API documentation: https://developers.brevo.com/reference/sendtransacemail
"""

from django.conf import settings
from django.core.mail import EmailMessage
import logging

logger = logging.getLogger(__name__)

DEFAULT_SENDER_EMAIL = 'office@figilschools.com'
DEFAULT_SENDER_NAME = 'EduCare'


def _get_sender(user=None):
    """Get email sender info based on the user's school settings."""
    info = {
        "name": DEFAULT_SENDER_NAME,
        "email": DEFAULT_SENDER_EMAIL,
        "logo": "",
        "accent_color": "#3b82f6",
    }
    if user and hasattr(user, 'school') and user.school:
        school = user.school
        if school.email_sender_name:
            info["name"] = school.email_sender_name
        elif school.name:
            info["name"] = school.name
        if school.logo:
            info["logo"] = school.logo.url if hasattr(school.logo, 'url') else str(school.logo)
        if school.accent_color:
            info["accent_color"] = school.accent_color
    return info


def _check_email_limit(user):
    """
    Check if the user's school can send another email today.
    If yes, increment the counter. If no, return False.
    Returns True if email can be sent.
    """
    if not user or not hasattr(user, 'school') or not user.school:
        return True  # No school context, allow (shouldn't happen in practice)

    subscription = getattr(user.school, 'subscription', None)
    if not subscription:
        return True  # No subscription, allow

    if not subscription.can_send_email():
        logger.warning(
            f"Email limit reached for {user.school.name}: "
            f"{subscription.emails_sent_today}/{subscription.plan.max_daily_emails}"
        )
        return False

    subscription.increment_email_count()
    return True


def _send_email(subject, html_content, recipient_email, recipient_name, sender_info):
    """Send email via Django SMTP backend (Brevo SMTP)."""
    from_email = f"{sender_info['name']} <{sender_info['email']}>"
    email = EmailMessage(
        subject=subject,
        body=html_content,
        from_email=from_email,
        to=[f"{recipient_name} <{recipient_email}>"],
    )
    email.content_subtype = 'html'
    email.send()
    return True


def send_notification_email(recipient_user, notification_title, notification_message, notification_type='general', priority='medium'):
    """
    Send notification email via Brevo Transactional Email API
    
    Args:
        recipient_user: User object to send email to
        notification_title: Title of the notification
        notification_message: Message content
        notification_type: Type of notification (announcement, assignment, etc.)
        priority: Priority level (low, medium, high)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    
    if not recipient_user.email:
        logger.warning(f"User {recipient_user.username} has no email address")
        return False

    if not _check_email_limit(recipient_user):
        return False

    try:
        sender = _get_sender(recipient_user)
        sender_name = sender["name"]
        accent = sender["accent_color"]
        logo_url = sender["logo"]
        subject = f"[{sender_name}] {notification_title}"

        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .priority-high {{ border-left: 4px solid #f44336; padding-left: 15px; }}
                .priority-medium {{ border-left: 4px solid #ff9800; padding-left: 15px; }}
                .priority-low {{ border-left: 4px solid #2196F3; padding-left: 15px; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: {accent}; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h1>{sender_name} Notification</h1>
                </div>
                <div class="content">
                    <div class="priority-{priority}">
                        <h2>{notification_title}</h2>
                        <p>{notification_message.replace(chr(10), '<br>')}</p>
                    </div>
                    <p style="margin-top: 30px;">
                        <a href="{settings.FRONTEND_URL}" class="button">View in Dashboard</a>
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated notification from {sender_name}.</p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        recipient_name = f"{recipient_user.first_name} {recipient_user.last_name}".strip() or recipient_user.username

        logger.info(f"Sending email to {recipient_user.email}")

        _send_email(subject, html_content, recipient_user.email, recipient_name, _get_sender(recipient_user))
        logger.info(f"Email sent successfully to {recipient_user.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {recipient_user.email}: {str(e)}")
        return False


def send_bulk_notification_emails(notifications):
    """
    Send multiple notification emails via Brevo API
    
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
        else:
            stats['failed'] += 1
    
    logger.info(f"Bulk email sending complete: {stats}")
    return stats


def send_verification_email(user, verification_url):
    """
    Send email verification with password change link

    Args:
        user: CustomUser object
        verification_url: Full URL for email verification

    Returns:
        bool: True if email sent successfully, False otherwise
    """

    if not user.email:
        logger.warning(f"User {user.username} has no email address")
        return False

    if not _check_email_limit(user):
        return False

    try:
        sender = _get_sender(user)
        sender_name = sender["name"]
        accent = sender["accent_color"]
        logo_url = sender["logo"]
        subject = f"[{sender_name}] Verify Your Email - Welcome!"

        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .credentials-box {{ background-color: #f5f5f5; border-left: 4px solid {accent}; padding: 15px; margin: 20px 0; }}
                .button {{ display: inline-block; padding: 15px 30px; background-color: {accent}; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }}
                .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h1>Welcome to {sender_name}!</h1>
                </div>
                <div class="content">
                    <h2>Hello {user.first_name} {user.last_name},</h2>

                    <p>Your account has been created successfully. To activate your account and set your password, please verify your email address.</p>

                    <div class="credentials-box">
                        <h3>Your Account Details:</h3>
                        <p><strong>Username:</strong> {user.username}</p>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Role:</strong> {user.get_role_display()}</p>
                    </div>

                    <div class="warning">
                        <p><strong>&#9888;&#65039; Important:</strong> You must verify your email and change your password before you can access the system.</p>
                    </div>

                    <p>Click the button below to verify your email and set your new password:</p>

                    <div style="text-align: center;">
                        <a href="{verification_url}" class="button">Verify Email &amp; Change Password</a>
                    </div>

                    <p style="margin-top: 20px; font-size: 12px; color: #666;">
                        Or copy and paste this link into your browser:<br>
                        <a href="{verification_url}">{verification_url}</a>
                    </p>

                    <div class="warning" style="margin-top: 30px;">
                        <p><strong>Security Notice:</strong></p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>This verification link will expire in 24 hours</li>
                            <li>You must change your password after verification</li>
                            <li>This email cannot be replied to</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p><strong>This is an automated email from {sender_name}.</strong></p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        recipient_name = f"{user.first_name} {user.last_name}".strip() or user.username

        logger.info(f"Sending verification email to {user.email}")
        _send_email(subject, html_content, user.email, recipient_name, _get_sender(user))
        logger.info(f"Verification email sent successfully to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send verification email to {user.email}: {str(e)}")
        return False


def send_password_reset_email(user, reset_url):
    """
    Send password reset email with reset link

    Args:
        user: CustomUser object
        reset_url: Full URL for password reset

    Returns:
        bool: True if email sent successfully, False otherwise
    """

    if not user.email:
        logger.warning(f"User {user.username} has no email address")
        return False

    if not _check_email_limit(user):
        return False

    try:
        sender = _get_sender(user)
        sender_name = sender["name"]
        accent = sender["accent_color"]
        logo_url = sender["logo"]
        subject = f"[{sender_name}] Password Reset Request"

        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .credentials-box {{ background-color: #f5f5f5; border-left: 4px solid {accent}; padding: 15px; margin: 20px 0; }}
                .button {{ display: inline-block; padding: 15px 30px; background-color: {accent}; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }}
                .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                    <h2>Hello {user.first_name} {user.last_name},</h2>

                    <p>We received a request to reset your password for your {sender_name} account.</p>

                    <div class="credentials-box">
                        <h3>Account Information:</h3>
                        <p><strong>Username:</strong> {user.username}</p>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Role:</strong> {user.get_role_display()}</p>
                    </div>

                    <p>Click the button below to reset your password:</p>

                    <div style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset Password</a>
                    </div>

                    <p style="margin-top: 20px; font-size: 12px; color: #666;">
                        Or copy and paste this link into your browser:<br>
                        <a href="{reset_url}">{reset_url}</a>
                    </p>

                    <div class="warning" style="margin-top: 30px;">
                        <p><strong>Security Notice:</strong></p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>This password reset link will expire in 1 hour</li>
                            <li>If you didn't request this, please ignore this email</li>
                            <li>Your password will not change until you click the link and set a new one</li>
                            <li>This email cannot be replied to</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p><strong>This is an automated email from {sender_name}.</strong></p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        recipient_name = f"{user.first_name} {user.last_name}".strip() or user.username

        logger.info(f"Sending password reset email to {user.email}")
        _send_email(subject, html_content, user.email, recipient_name, _get_sender(user))
        logger.info(f"Password reset email sent successfully to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email to {user.email}: {str(e)}")
        return False


def test_email_configuration():
    """
    Test email configuration by sending a test email via SMTP.

    Returns:
        bool: True if test email sent successfully, False otherwise
    """
    try:
        sender = _get_sender()
        _send_email(
            "Test Email - EduCare",
            "<html><body><h2>Test Email</h2><p>This is a test email.</p><p>If you receive this, email configuration is working!</p></body></html>",
            DEFAULT_SENDER_EMAIL,
            "Test",
            sender,
        )
        logger.info("Test email sent successfully")
        return True

    except Exception as e:
        logger.error(f"Test email failed: {str(e)}")
        return False