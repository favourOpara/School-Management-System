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


def check_email_cap_for_count(school, emails_needed):
    """
    Check (without incrementing) whether sending `emails_needed` emails
    would exceed the school's daily cap.
    Returns a dict: {would_exceed, remaining, needed, daily_limit}
    """
    subscription = getattr(school, 'subscription', None)
    if not subscription:
        return {'would_exceed': False, 'remaining': None, 'needed': emails_needed, 'daily_limit': None}
    plan = getattr(subscription, 'plan', None)
    if not plan or plan.max_daily_emails == 0:
        return {'would_exceed': False, 'remaining': None, 'needed': emails_needed, 'daily_limit': None}

    from django.utils import timezone
    today = timezone.now().date()
    if subscription.email_counter_reset_date != today:
        emails_sent = 0
    else:
        emails_sent = subscription.emails_sent_today

    remaining = max(0, plan.max_daily_emails - emails_sent)
    return {
        'would_exceed': emails_needed > remaining,
        'remaining': remaining,
        'needed': emails_needed,
        'daily_limit': plan.max_daily_emails,
    }


def send_assessment_locked_student_email(student, school_ref_user, assessment_type_label, reason):
    """
    Notify a student that a test/exam was conducted but they couldn't access it.
    reason: 'absent' | 'unpaid' | 'both'
    school_ref_user: an admin/principal user from the school (for sender info + cap check)
    """
    if not student.email:
        return False
    if not _check_email_limit(school_ref_user):
        return False

    try:
        sender = _get_sender(school_ref_user)
        sender_name = sender['name']
        accent = sender['accent_color']
        logo_url = sender['logo']
        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''

        if reason == 'absent':
            reason_text = (
                f"Our records show that you were <strong>not present in school</strong> on the day the {assessment_type_label} was conducted. "
                f"As a result, you were unable to access it."
            )
            action_text = "Please contact the school administration to schedule a date to write the missed assessment."
        elif reason == 'unpaid':
            reason_text = (
                f"Our records indicate that your <strong>school fees are outstanding</strong>. "
                f"Access to the {assessment_type_label} requires payment of fees to be completed."
            )
            action_text = "Please settle your outstanding fees and contact the school administration to arrange access."
        else:  # both
            reason_text = (
                f"Our records show that you were <strong>not present in school</strong> on the day the {assessment_type_label} was conducted, "
                f"and your <strong>school fees are also outstanding</strong>."
            )
            action_text = "Please settle your outstanding fees and contact the school administration to schedule a date to write the missed assessment."

        subject = f"[{sender_name}] Missed {assessment_type_label.title()} — Action Required"
        student_name = f"{student.first_name} {student.last_name}".strip() or student.username

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .alert-box {{ border-left: 4px solid #f59e0b; background: #fffbeb; padding: 15px 20px; border-radius: 4px; margin: 16px 0; }}
                .action-box {{ border-left: 4px solid {accent}; background: #f0f9ff; padding: 15px 20px; border-radius: 4px; margin: 16px 0; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h2>Missed {assessment_type_label.title()} Notification</h2>
                </div>
                <div class="content">
                    <p>Dear <strong>{student_name}</strong>,</p>
                    <p>This is to inform you that a <strong>{assessment_type_label}</strong> was recently conducted at {sender_name}.</p>
                    <div class="alert-box">
                        <p>{reason_text}</p>
                    </div>
                    <div class="action-box">
                        <p><strong>What to do:</strong> {action_text}</p>
                    </div>
                    <p>Please do not ignore this notice. Early action will help ensure your academic records are complete.</p>
                </div>
                <div class="footer">
                    <p>This is an automated notification from {sender_name}. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        _send_email(subject, html_content, student.email, student_name, sender)
        return True
    except Exception as e:
        logger.error(f"Failed to send assessment locked email to student {student.email}: {e}")
        return False


def send_assessment_locked_parent_email(parent, student_name, school_ref_user, assessment_type_label, reason):
    """
    Notify a parent that their child missed a test/exam.
    reason: 'absent' | 'unpaid' | 'both'
    """
    if not parent.email:
        return False
    if not _check_email_limit(school_ref_user):
        return False

    try:
        sender = _get_sender(school_ref_user)
        sender_name = sender['name']
        accent = sender['accent_color']
        logo_url = sender['logo']
        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''

        if reason == 'absent':
            reason_text = (
                f"Our records indicate that <strong>{student_name}</strong> was <strong>not present in school</strong> "
                f"on the day the {assessment_type_label} was conducted and therefore could not access it."
            )
            action_text = f"Please contact the school administration to schedule a date for {student_name} to write the missed assessment."
        elif reason == 'unpaid':
            reason_text = (
                f"Our records indicate that <strong>{student_name}</strong>'s <strong>school fees are outstanding</strong>. "
                f"Access to the {assessment_type_label} requires payment of fees to be completed."
            )
            action_text = f"Please settle the outstanding fees and contact the school administration to arrange access for {student_name}."
        else:  # both
            reason_text = (
                f"Our records show that <strong>{student_name}</strong> was <strong>not present in school</strong> on the day the {assessment_type_label} was conducted, "
                f"and their <strong>school fees are also outstanding</strong>."
            )
            action_text = f"Please settle the outstanding fees and contact the school administration to schedule a date for {student_name} to write the missed assessment."

        subject = f"[{sender_name}] Your Child Missed a {assessment_type_label.title()} — Action Required"
        parent_name = f"{parent.first_name} {parent.last_name}".strip() or parent.username

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .alert-box {{ border-left: 4px solid #f59e0b; background: #fffbeb; padding: 15px 20px; border-radius: 4px; margin: 16px 0; }}
                .action-box {{ border-left: 4px solid {accent}; background: #f0f9ff; padding: 15px 20px; border-radius: 4px; margin: 16px 0; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h2>Student Missed {assessment_type_label.title()} Notification</h2>
                </div>
                <div class="content">
                    <p>Dear <strong>{parent_name}</strong>,</p>
                    <p>This is to inform you that a <strong>{assessment_type_label}</strong> was recently conducted at {sender_name}.</p>
                    <div class="alert-box">
                        <p>{reason_text}</p>
                    </div>
                    <div class="action-box">
                        <p><strong>What to do:</strong> {action_text}</p>
                    </div>
                    <p>Please act promptly to avoid any impact on {student_name}'s academic records.</p>
                </div>
                <div class="footer">
                    <p>This is an automated notification from {sender_name}. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        _send_email(subject, html_content, parent.email, parent_name, sender)
        return True
    except Exception as e:
        logger.error(f"Failed to send assessment locked email to parent {parent.email}: {e}")
        return False


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


def send_graduation_email_student(student, deactivation_date, login_url):
    """
    Send a graduation congratulations email to a student with grace period notice.

    Args:
        student: CustomUser object (student)
        deactivation_date: datetime — when the account will be deactivated (graduation_date + 30 days)
        login_url: URL string for the student portal login

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not student.email:
        logger.warning(f"Student {student.username} has no email address for graduation email")
        return False

    if not _check_email_limit(student):
        logger.warning(f"Email limit reached — skipping graduation email to {student.email}")
        return False

    try:
        sender = _get_sender(student)
        sender_name = sender["name"]
        accent = sender["accent_color"]
        logo_url = sender["logo"]
        subject = f"[{sender_name}] Congratulations on Your Graduation!"

        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''
        deactivation_str = deactivation_date.strftime('%B %d, %Y')

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .highlight-box {{ background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; }}
                .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }}
                .button {{ display: inline-block; padding: 15px 30px; background-color: {accent}; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
                ul {{ padding-left: 20px; }}
                li {{ margin-bottom: 6px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h1>&#127891; Congratulations, {student.first_name}!</h1>
                </div>
                <div class="content">
                    <h2>Dear {student.first_name} {student.last_name},</h2>

                    <div class="highlight-box">
                        <p><strong>You have successfully graduated from {sender_name}!</strong></p>
                        <p>This is a remarkable achievement and we are incredibly proud of everything you have accomplished. Congratulations on completing your education with us — we wish you all the best in your future endeavors.</p>
                    </div>

                    <div class="warning">
                        <p><strong>&#9888;&#65039; Important: Download Your Reports Before {deactivation_str}</strong></p>
                        <p>Your student account will remain active for <strong>30 days</strong> so you can download your report cards and academic records. After <strong>{deactivation_str}</strong>, your account will be deactivated and you will no longer be able to log in.</p>
                        <p>Please take this time to download:</p>
                        <ul>
                            <li>Your report cards for all terms</li>
                            <li>Your attendance reports</li>
                            <li>Any other academic records you may need</li>
                        </ul>
                    </div>

                    <div style="text-align: center;">
                        <a href="{login_url}" class="button">Log In &amp; Download Reports</a>
                    </div>

                    <p style="margin-top: 20px; font-size: 12px; color: #666;">
                        Or copy and paste this link into your browser:<br>
                        <a href="{login_url}">{login_url}</a>
                    </p>

                    <p style="margin-top: 30px;">Once again, congratulations on this wonderful achievement. We are proud to have been a part of your educational journey.</p>

                    <p>Warm regards,<br><strong>{sender_name} Team</strong></p>
                </div>
                <div class="footer">
                    <p><strong>This is an automated email from {sender_name}.</strong></p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        recipient_name = f"{student.first_name} {student.last_name}".strip() or student.username
        logger.info(f"Sending graduation email to student {student.email}")
        _send_email(subject, html_content, student.email, recipient_name, sender)
        logger.info(f"Graduation email sent successfully to student {student.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send graduation email to student {student.email}: {str(e)}")
        return False


def send_parent_all_children_graduated_email(parent, parent_deactivation_date, login_url):
    """
    Send a notice to a parent when ALL their children have graduated,
    informing them that their own account will be deactivated in 3 months.

    Args:
        parent: CustomUser object (parent)
        parent_deactivation_date: datetime — when the parent account will be deactivated
        login_url: URL string for the parent portal login

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not parent.email:
        logger.warning(f"Parent {parent.username} has no email address for all-children-graduated notice")
        return False

    if not _check_email_limit(parent):
        logger.warning(f"Email limit reached — skipping all-children-graduated email to {parent.email}")
        return False

    try:
        sender = _get_sender(parent)
        sender_name = sender["name"]
        accent = sender["accent_color"]
        logo_url = sender["logo"]
        subject = f"[{sender_name}] All Your Children Have Graduated — Account Notice"

        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''
        deactivation_str = parent_deactivation_date.strftime('%B %d, %Y')

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .highlight-box {{ background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; }}
                .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }}
                .button {{ display: inline-block; padding: 15px 30px; background-color: {accent}; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
                ul {{ padding-left: 20px; }}
                li {{ margin-bottom: 6px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h1>All Children Have Graduated</h1>
                </div>
                <div class="content">
                    <h2>Dear {parent.first_name} {parent.last_name},</h2>

                    <div class="highlight-box">
                        <p><strong>All of your children have now successfully graduated from {sender_name}.</strong></p>
                        <p>Congratulations on this wonderful milestone! We are proud to have been part of your family's educational journey.</p>
                    </div>

                    <div class="warning">
                        <p><strong>&#9888;&#65039; Important: Your Parent Account Will Be Deactivated on {deactivation_str}</strong></p>
                        <p>Since all of your children have completed their education with us, your parent account will remain active for <strong>3 months</strong> and will be automatically deactivated on <strong>{deactivation_str}</strong>.</p>
                        <p>Before that date, you may still log in to:</p>
                        <ul>
                            <li>View and download your children's report cards</li>
                            <li>Access historical attendance and grade records</li>
                            <li>Download any receipts or payment records</li>
                        </ul>
                        <p>If you have a new child enrolling in the future, please contact the school administration to reactivate your account or create a new one.</p>
                    </div>

                    <div style="text-align: center;">
                        <a href="{login_url}" class="button">Log In to Parent Portal</a>
                    </div>

                    <p style="margin-top: 20px; font-size: 12px; color: #666;">
                        Or copy and paste this link into your browser:<br>
                        <a href="{login_url}">{login_url}</a>
                    </p>

                    <p style="margin-top: 30px;">Thank you for being a valued part of our school community. We wish your family all the best!</p>

                    <p>Warm regards,<br><strong>{sender_name} Team</strong></p>
                </div>
                <div class="footer">
                    <p><strong>This is an automated email from {sender_name}.</strong></p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        recipient_name = f"{parent.first_name} {parent.last_name}".strip() or parent.username
        logger.info(f"Sending all-children-graduated notice to parent {parent.email}")
        _send_email(subject, html_content, parent.email, recipient_name, sender)
        logger.info(f"All-children-graduated notice sent successfully to parent {parent.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send all-children-graduated email to parent {parent.email}: {str(e)}")
        return False


def send_graduation_email_parent(parent, student, deactivation_date, login_url):
    """
    Send a graduation notification email to a parent with grace period notice.

    Args:
        parent: CustomUser object (parent)
        student: CustomUser object (the graduating student)
        deactivation_date: datetime — when the student's account will be deactivated
        login_url: URL string for the parent portal login

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not parent.email:
        logger.warning(f"Parent {parent.username} has no email address for graduation email")
        return False

    if not _check_email_limit(parent):
        logger.warning(f"Email limit reached — skipping graduation email to parent {parent.email}")
        return False

    try:
        sender = _get_sender(parent)
        sender_name = sender["name"]
        accent = sender["accent_color"]
        logo_url = sender["logo"]
        subject = f"[{sender_name}] {student.first_name} {student.last_name} Has Graduated!"

        logo_html = f'<img src="{logo_url}" alt="{sender_name}" style="max-width:80px;height:auto;margin-bottom:10px;">' if logo_url else ''
        deactivation_str = deactivation_date.strftime('%B %d, %Y')

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background-color: {accent}; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }}
                .highlight-box {{ background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; }}
                .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }}
                .button {{ display: inline-block; padding: 15px 30px; background-color: {accent}; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
                ul {{ padding-left: 20px; }}
                li {{ margin-bottom: 6px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {logo_html}
                    <h1>&#127891; Graduation Notice</h1>
                </div>
                <div class="content">
                    <h2>Dear {parent.first_name} {parent.last_name},</h2>

                    <div class="highlight-box">
                        <p><strong>Congratulations! Your child, {student.first_name} {student.last_name}, has successfully graduated from {sender_name}!</strong></p>
                        <p>We are pleased to inform you of this wonderful achievement. Please join us in celebrating this milestone and wishing {student.first_name} all the best in the next chapter of their life.</p>
                    </div>

                    <div class="warning">
                        <p><strong>&#9888;&#65039; Action Required: Download Reports Before {deactivation_str}</strong></p>
                        <p>Your child's student account will remain active for <strong>30 days</strong> to allow time to download academic records. After <strong>{deactivation_str}</strong>, the account will be deactivated.</p>
                        <p>Please remind {student.first_name} to download:</p>
                        <ul>
                            <li>Report cards for all completed terms</li>
                            <li>Attendance reports</li>
                            <li>Any other academic records needed for future reference</li>
                        </ul>
                    </div>

                    <div style="background-color: #f8f9fa; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0;">
                        <p><strong>&#8505;&#65039; Note About Your Parent Account</strong></p>
                        <p>Once all of your children have graduated, your parent account will also be deactivated <strong>3 months</strong> after the last graduation. You will receive a separate email with the exact deactivation date when that time comes.</p>
                    </div>

                    <p>You can log in to your parent account to access your child's historical records as well:</p>

                    <div style="text-align: center;">
                        <a href="{login_url}" class="button">Log In to Parent Portal</a>
                    </div>

                    <p style="margin-top: 20px; font-size: 12px; color: #666;">
                        Or copy and paste this link into your browser:<br>
                        <a href="{login_url}">{login_url}</a>
                    </p>

                    <p style="margin-top: 30px;">Thank you for entrusting us with {student.first_name}'s education. We wish your family all the best!</p>

                    <p>Warm regards,<br><strong>{sender_name} Team</strong></p>
                </div>
                <div class="footer">
                    <p><strong>This is an automated email from {sender_name}.</strong></p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        recipient_name = f"{parent.first_name} {parent.last_name}".strip() or parent.username
        logger.info(f"Sending graduation email to parent {parent.email}")
        _send_email(subject, html_content, parent.email, recipient_name, sender)
        logger.info(f"Graduation email sent successfully to parent {parent.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send graduation email to parent {parent.email}: {str(e)}")
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