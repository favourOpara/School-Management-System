"""
InsightWick platform email service.

Sends branded emails from the InsightWick platform (NOT from individual schools).
These emails are NOT subject to school daily email quotas.

Used for subscription lifecycle emails:
- Pre-expiry warnings (7, 3, 1 day before)
- Grace period notifications (day 1, 3, 5)
- Expired/lockout notifications
- Welcome emails (trial → active)
- Payment confirmations
"""
import logging
from django.conf import settings
from django.core.mail import EmailMessage

logger = logging.getLogger(__name__)

INSIGHTWICK_SENDER_NAME = 'InsightWick'
INSIGHTWICK_SENDER_EMAIL = 'office@insightwick.com'
INSIGHTWICK_ACCENT_COLOR = '#3b82f6'
INSIGHTWICK_FRONTEND_URL = getattr(settings, 'FRONTEND_URL', 'https://insightwick.com')


def _build_insightwick_html(heading, body_html, cta_text=None, cta_url=None):
    """Build a professional InsightWick-branded HTML email."""
    cta_block = ''
    if cta_text and cta_url:
        cta_block = f'''
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="{cta_url}" style="display: inline-block; padding: 14px 32px;
                           background-color: {INSIGHTWICK_ACCENT_COLOR}; color: #ffffff;
                           text-decoration: none; border-radius: 6px; font-weight: 600;
                           font-size: 16px;">{cta_text}</a>
                    </div>'''

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0f4f8; color: #1a202c;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, {INSIGHTWICK_ACCENT_COLOR}, #1d4ed8); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
            <!-- InsightWick logo (inline SVG — no external image dependency, no whitespace) -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80" width="252" height="56" style="display:inline-block; margin-bottom: 8px;" role="img" aria-label="InsightWick">
              <defs>
                <linearGradient id="ec-ig" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#93c5fd"/>
                  <stop offset="100%" stop-color="#3b82f6"/>
                </linearGradient>
                <linearGradient id="ec-sh" x1="0" y1="0" x2="0" y2="72" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#ffffff" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <rect x="0" y="4" width="72" height="72" rx="16" fill="url(#ec-ig)"/>
              <rect x="0" y="4" width="72" height="36" rx="16" fill="url(#ec-sh)"/>
              <polygon points="36,19 62,31 36,43 10,31" fill="white"/>
              <rect x="23" y="41" width="26" height="17" rx="4" fill="white" opacity="0.82"/>
              <rect x="23" y="41" width="26" height="5" rx="2" fill="white"/>
              <line x1="62" y1="31" x2="62" y2="50" stroke="white" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
              <circle cx="62" cy="54" r="4" fill="white" opacity="0.9"/>
              <text x="88" y="46" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" letter-spacing="-0.5">
                <tspan fill="#ffffff">Insight</tspan><tspan fill="#bfdbfe">Wick</tspan>
              </text>
              <text x="91" y="63" font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="600" fill="rgba(255,255,255,0.65)" letter-spacing="3.2">SCHOOL MANAGEMENT</text>
            </svg>
        </div>

        <!-- Body -->
        <div style="background-color: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 22px; font-weight: 600;">{heading}</h2>
            <div style="color: #4a5568; font-size: 15px; line-height: 1.7;">
                {body_html}
            </div>
            {cta_block}
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px 0; color: #a0aec0; font-size: 12px;">
            <p style="margin: 0 0 4px;">This is an official email from InsightWick.</p>
            <p style="margin: 0 0 4px;">Please do not reply to this email.</p>
            <p style="margin: 0;">&copy; InsightWick School Management Platform</p>
        </div>
    </div>
</body>
</html>'''


def send_insightwick_email(recipient_email, recipient_name, subject, heading, body_html, cta_text=None, cta_url=None):
    """
    Send a branded InsightWick platform email.

    This bypasses school branding and email quotas.
    """
    try:
        html_content = _build_insightwick_html(heading, body_html, cta_text, cta_url)
        from_email = f"{INSIGHTWICK_SENDER_NAME} <{INSIGHTWICK_SENDER_EMAIL}>"
        email = EmailMessage(
            subject=f"[InsightWick] {subject}",
            body=html_content,
            from_email=from_email,
            to=[f"{recipient_name} <{recipient_email}>"],
        )
        email.content_subtype = 'html'
        email.send()
        logger.info(f"InsightWick email sent to {recipient_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send InsightWick email to {recipient_email}: {e}")
        return False


def _get_subscription_recipients(subscription):
    """
    Get all email recipients for subscription notifications.
    Collects PortalUser (school owners) + admin CustomUser, deduplicates by email.
    """
    from .models import PortalUser
    from users.models import CustomUser

    recipients = []
    seen_emails = set()

    # Portal users (school owners) — these are the primary recipients
    for pu in PortalUser.objects.filter(school=subscription.school, is_active=True):
        if pu.email and pu.email not in seen_emails:
            recipients.append({'email': pu.email, 'name': pu.get_full_name()})
            seen_emails.add(pu.email)

    # Admin users in the school system
    for admin in CustomUser.objects.filter(school=subscription.school, role='admin', is_active=True):
        if admin.email and admin.email not in seen_emails:
            name = f"{admin.first_name} {admin.last_name}".strip() or admin.username
            recipients.append({'email': admin.email, 'name': name})
            seen_emails.add(admin.email)

    return recipients


def _get_dashboard_url(subscription):
    """Get the dashboard URL for the school."""
    return f"{INSIGHTWICK_FRONTEND_URL}/{subscription.school.slug}/admin/dashboard"


def _get_pricing_url():
    """Get the pricing page URL."""
    return f"{INSIGHTWICK_FRONTEND_URL}/pricing"


# ---------------------------------------------------------------------------
# Email Verification
# ---------------------------------------------------------------------------

def send_otp_email(email, otp, first_name='there'):
    """
    Send a 6-digit OTP to verify an email address during registration (Step 2).
    """
    body_html = f'''
        <p>Hi {first_name},</p>
        <p>Use the code below to verify your email address for your InsightWick school registration.</p>
        <div style="text-align:center; margin:28px 0;">
            <div style="display:inline-block; background:#f0f9ff; border:2px solid #bae6fd;
                        border-radius:12px; padding:18px 36px;">
                <span style="font-size:36px; font-weight:800; letter-spacing:10px;
                             color:#0369a1; font-family:monospace;">{otp}</span>
            </div>
        </div>
        <p style="color:#6b7280; font-size:14px;">
            This code expires in <strong>15 minutes</strong>.
            If you did not request this, you can safely ignore this email.
        </p>
    '''

    send_insightwick_email(
        recipient_email=email,
        recipient_name=first_name,
        subject='Your InsightWick verification code',
        heading='Email Verification Code',
        body_html=body_html,
    )


def send_verification_email(portal_user):
    """
    Send an email verification link to a newly registered portal user.
    Called immediately after school registration.
    """
    verify_url = f"{INSIGHTWICK_FRONTEND_URL}/portal/verify-email?token={portal_user.email_verification_token}"
    first_name = portal_user.first_name or 'there'

    body_html = f'''
        <p>Hi {first_name},</p>
        <p>Thank you for registering your school on <strong>InsightWick</strong>!</p>
        <p>Before you can log in to your Admin Portal, please verify your email address by clicking the button below.</p>
        <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:16px 20px;
                    border-radius:0 8px 8px 0; margin:24px 0;">
            <p style="margin:0; color:#374151; font-size:14px;">
                This verification link will expire in <strong>24 hours</strong>.
                If you did not register for InsightWick, you can safely ignore this email.
            </p>
        </div>
    '''

    send_insightwick_email(
        recipient_email=portal_user.email,
        recipient_name=portal_user.get_full_name(),
        subject='Verify your InsightWick email address',
        heading='Verify Your Email Address',
        body_html=body_html,
        cta_text='Verify Email Address',
        cta_url=verify_url,
    )


# ---------------------------------------------------------------------------
# Onboarding Email
# ---------------------------------------------------------------------------

def send_onboarding_welcome_email(subscription, registration_type='trial'):
    """
    Send an onboarding welcome email immediately after a school registers or subscribes.
    Informs them that a dedicated onboarding expert will reach out within 24 hours.
    Includes a personalised link for the school to submit their available date/time slots.
    Sent for all registration types: trial, termly_trial, and subscribe.
    """
    recipients = _get_subscription_recipients(subscription)
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    portal_url = f"{INSIGHTWICK_FRONTEND_URL}/portal"

    # Build the scheduling link from the school's OnboardingRecord
    scheduling_url = None
    try:
        onboarding_record = subscription.school.onboarding
        scheduling_url = f"{INSIGHTWICK_FRONTEND_URL}/schedule-onboarding/{onboarding_record.scheduling_token}"
    except Exception:
        pass

    if registration_type in ('trial', 'termly_trial'):
        trial_label = '4-month termly free trial' if registration_type == 'termly_trial' else '30-day free trial'
        intro = (
            f"Your <strong>{plan_name}</strong> {trial_label} is now active and your school is ready to use. "
            f"We want to make sure you get the most out of it — so we're sending a real person to help."
        )
    else:
        intro = (
            f"Your <strong>{plan_name}</strong> subscription is now active. "
            f"Welcome to the InsightWick family! To make sure your school is set up for success, "
            f"we're assigning you a dedicated onboarding expert."
        )

    onboarding_items = [
        ('Students', 'Add student profiles, import from spreadsheets, assign to classes'),
        ('Teachers', 'Create teacher accounts and assign subjects'),
        ('Classes & Arms', 'Set up class structure, arms, and academic sessions'),
        ('Parents', 'Invite parents and link them to their children'),
        ('Attendance', 'Configure attendance tracking and notification settings'),
        ('Subjects & Grading', 'Add subjects and set up your grading scales'),
    ]

    items_html = ''.join(
        f'''<div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
              <div style="min-width:28px; height:28px; background:#dbeafe; border-radius:50%;
                          display:flex; align-items:center; justify-content:center; margin-top:2px;">
                <span style="color:#2563eb; font-weight:700; font-size:13px;">✓</span>
              </div>
              <div>
                <strong style="color:#1e3a5f;">{label}</strong>
                <span style="color:#6b7280;"> — {desc}</span>
              </div>
            </div>'''
        for label, desc in onboarding_items
    )

    scheduling_block = ''
    if scheduling_url:
        scheduling_block = f'''
        <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px;
                    padding:18px 20px; margin:20px 0;">
            <p style="margin:0 0 8px; font-weight:700; font-size:15px; color:#166534;">
                📅 Tell us when you're free
            </p>
            <p style="margin:0 0 14px; color:#374151; font-size:14px; line-height:1.6;">
                Speed up your onboarding by letting us know your available dates and times.
                Your expert will reach out at a time that works for you.
            </p>
            <a href="{scheduling_url}"
               style="display:inline-block; background:#16a34a; color:#fff; font-weight:600;
                      font-size:14px; padding:10px 20px; border-radius:7px; text-decoration:none;">
                Pick My Availability
            </a>
        </div>'''

    body_html = f'''
        <p>Hi there,</p>
        <p>{intro}</p>

        <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:18px 20px;
                    border-radius:0 8px 8px 0; margin:24px 0;">
            <p style="margin:0 0 4px; font-weight:700; font-size:17px; color:#1e40af;">
                📞 An onboarding expert will contact you within 24 hours
            </p>
            <p style="margin:0; color:#374151; font-size:14px;">
                This is a free, included service for all InsightWick schools — no extra charge, no strings attached.
            </p>
        </div>

        {scheduling_block}

        <p><strong>Here's what your onboarding expert will help you set up:</strong></p>
        <div style="margin:16px 0;">{items_html}</div>

        <p>
            You don't have to figure this out alone. Our team has onboarded hundreds of schools
            and we know exactly how to get you up and running smoothly.
        </p>
        <p style="color:#6b7280; font-size:14px;">
            In the meantime, feel free to explore your Admin Portal. If you have any urgent questions,
            you can reach us at <a href="mailto:{INSIGHTWICK_SENDER_EMAIL}" style="color:#2563eb;">{INSIGHTWICK_SENDER_EMAIL}</a>.
        </p>
    '''

    for recipient in recipients:
        first_name = recipient['name'].split()[0] if recipient['name'] else 'there'
        personalised_body = body_html.replace('Hi there,', f'Hi {first_name},')
        send_insightwick_email(
            recipient_email=recipient['email'],
            recipient_name=recipient['name'],
            subject=f'Welcome to InsightWick — Your Onboarding Expert Will Reach Out Within 24 Hours',
            heading=f'Welcome to InsightWick, {school_name}! 🎓',
            body_html=personalised_body,
            cta_text='Go to Your Admin Portal',
            cta_url=portal_url,
        )


# ---------------------------------------------------------------------------
# Subscription Lifecycle Emails
# ---------------------------------------------------------------------------

def send_expiry_warning_email(subscription, days_remaining):
    """Send pre-expiry warning email (7, 3, or 1 day before expiry)."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    end_date = subscription.current_period_end.strftime('%B %d, %Y') if subscription.current_period_end else 'soon'

    if days_remaining <= 1:
        urgency = "expires tomorrow"
        tone = "This is your final reminder."
    elif days_remaining <= 3:
        urgency = f"expires in {days_remaining} days"
        tone = "Please take action soon to avoid any disruption."
    else:
        urgency = f"expires in {days_remaining} days"
        tone = "We wanted to give you advance notice so you can plan accordingly."

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Your <strong>{plan_name}</strong> subscription <strong>{urgency}</strong> (on {end_date}).</p>
        <p>{tone}</p>
        <p>To ensure uninterrupted access to all features, please renew your subscription before it expires.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>What happens if you don't renew?</strong>
            <p style="margin: 8px 0 0;">After expiry, you'll have a grace period of {subscription.plan.grace_period_days} days to renew.
            After that, access to your school's data will be temporarily suspended until you resubscribe.</p>
        </div>
    '''

    subject = f"Your {plan_name} subscription {urgency}"
    heading = f"Subscription Expiring Soon"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Renew Now", cta_url=_get_dashboard_url(subscription)
        )


def send_grace_period_start_email(subscription):
    """Send email when subscription enters grace period (day 1)."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    grace_days = subscription.plan.grace_period_days

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Your <strong>{plan_name}</strong> subscription has expired.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>Grace Period: {grace_days} days remaining</strong>
            <p style="margin: 8px 0 0;">Your school can continue operating normally for the next <strong>{grace_days} days</strong>.
            After that, all access will be suspended until you renew.</p>
        </div>
        <p>Please renew as soon as possible to avoid any disruption to your school's operations.</p>
    '''

    subject = f"Your subscription has expired — {grace_days}-day grace period started"
    heading = "Subscription Expired — Grace Period Active"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Renew Now", cta_url=_get_dashboard_url(subscription)
        )


def send_grace_period_reminder_email(subscription, grace_day):
    """Send grace period reminder email (day 3 or day 5)."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    grace_days = subscription.plan.grace_period_days
    days_left = max(0, grace_days - grace_day)

    if days_left <= 0:
        urgency_text = "today"
        urgency_note = "This is your <strong>final warning</strong>. Access will be suspended at the end of today."
    elif days_left == 1:
        urgency_text = "tomorrow"
        urgency_note = "You have <strong>1 day</strong> left before access is suspended."
    else:
        urgency_text = f"in {days_left} days"
        urgency_note = f"You have <strong>{days_left} days</strong> left before access is suspended."

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Your <strong>{plan_name}</strong> subscription is still expired and your grace period ends <strong>{urgency_text}</strong>.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>URGENT: Grace period ending {urgency_text}</strong>
            <p style="margin: 8px 0 0;">{urgency_note}</p>
        </div>
        <p>Once suspended, teachers, students, and parents will lose access until you resubscribe.
        Your data will be preserved and restored when you renew.</p>
    '''

    subject = f"URGENT: Grace period ends {urgency_text} — renew now"
    heading = "Grace Period Ending — Action Required"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Renew Now", cta_url=_get_dashboard_url(subscription)
        )


def send_expired_lockout_email(subscription):
    """Send final lockout notification when grace period ends."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Your <strong>{plan_name}</strong> subscription and grace period have ended.
        Access to your school on InsightWick has been <strong>suspended</strong>.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>What this means:</strong>
            <ul style="margin: 8px 0 0; padding-left: 20px;">
                <li>Teachers, students, and parents can no longer log in</li>
                <li>All school data is safely preserved</li>
                <li>Access will be fully restored once you resubscribe</li>
            </ul>
        </div>
        <p>To restore access, simply renew your subscription. All your data — grades, attendance records,
        fee history, and more — will be exactly as you left it.</p>
    '''

    subject = f"Access suspended — please renew to restore your school"
    heading = "Subscription Suspended"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Resubscribe Now", cta_url=_get_pricing_url()
        )


def send_insightwick_welcome_email(subscription):
    """Send welcome email when subscription is activated (trial → active)."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Welcome to <strong>{plan_name}</strong>! Your subscription is now active. Thank you for choosing InsightWick.</p>
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>Your plan includes:</strong>
            <ul style="margin: 8px 0 0; padding-left: 20px;">
                <li>Up to {subscription.plan.max_students} students ({"unlimited" if subscription.plan.max_students == 0 else subscription.plan.max_students})</li>
                <li>Up to {subscription.plan.max_teachers} teachers ({"unlimited" if subscription.plan.max_teachers == 0 else subscription.plan.max_teachers})</li>
                <li>{subscription.plan.max_daily_emails} emails/day ({"unlimited" if subscription.plan.max_daily_emails == 0 else subscription.plan.max_daily_emails})</li>
                <li>{"CSV Import" if subscription.plan.has_import_feature else "Standard features"}</li>
            </ul>
        </div>
        <p>If you have any questions, don't hesitate to reach out to our support team.</p>
    '''

    subject = f"Welcome to {plan_name} — your subscription is active!"
    heading = "Welcome to InsightWick!"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Go to Dashboard", cta_url=_get_dashboard_url(subscription)
        )


def send_insightwick_payment_confirmation(subscription, payment):
    """Send payment confirmation from InsightWick branding."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    amount = payment.amount_in_naira()
    end_date = subscription.current_period_end.strftime('%B %d, %Y') if subscription.current_period_end else 'N/A'

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Your payment has been confirmed. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #718096;">Plan</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">{plan_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #718096;">Amount</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">\u20a6{amount:,.2f}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #718096;">Billing Cycle</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">{subscription.billing_cycle.title()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #718096;">Reference</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">{payment.paystack_reference}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #718096;">Active Until</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">{end_date}</td>
            </tr>
        </table>
        <p>Your subscription is now active. Thank you for your continued trust in InsightWick.</p>
    '''

    subject = f"Payment confirmed — \u20a6{amount:,.2f} for {plan_name}"
    heading = "Payment Confirmed"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="View Dashboard", cta_url=_get_dashboard_url(subscription)
        )


def send_insightwick_cancellation_email(subscription):
    """Send subscription cancellation confirmation."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    end_date = subscription.current_period_end.strftime('%B %d, %Y') if subscription.current_period_end else 'N/A'

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Your <strong>{plan_name}</strong> subscription has been cancelled.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>You still have access until {end_date}</strong>
            <p style="margin: 8px 0 0;">Your school can continue operating normally until the end of your current billing period.
            After that, a grace period will apply before access is suspended.</p>
        </div>
        <p>Changed your mind? You can resubscribe at any time to continue using InsightWick.</p>
    '''

    subject = f"Subscription cancelled — access until {end_date}"
    heading = "Subscription Cancelled"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Resubscribe", cta_url=_get_pricing_url()
        )


def send_insightwick_payment_failed_email(subscription):
    """Send payment failed notification."""
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>We were unable to process the recurring payment for your <strong>{plan_name}</strong> subscription.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>Action required</strong>
            <p style="margin: 8px 0 0;">Please update your payment method or make a manual payment to avoid service interruption.</p>
        </div>
        <p>If you believe this is an error, please contact our support team.</p>
    '''

    subject = f"Payment failed — please update your payment method"
    heading = "Payment Failed"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Update Payment", cta_url=_get_dashboard_url(subscription)
        )


# ---------------------------------------------------------------------------
# Auto-Debit Emails
# ---------------------------------------------------------------------------

def send_auto_debit_warning_email(subscription, days_remaining):
    """
    Send pre-renewal notice for schools with auto-debit enabled.
    Replaces the standard expiry warning email for auto-debit users.
    """
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    billing_cycle = subscription.billing_cycle

    if billing_cycle == 'annual':
        amount = subscription.plan.annual_price
    else:
        amount = subscription.plan.monthly_price
    amount_naira = amount / 100

    charge_date = subscription.current_period_end.strftime('%B %d, %Y') if subscription.current_period_end else 'soon'

    if days_remaining <= 1:
        notice = "tomorrow"
    else:
        notice = f"in {days_remaining} days"

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>Your <strong>{plan_name}</strong> subscription renews <strong>{notice}</strong> (on {charge_date}).</p>
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>Auto-renewal is active</strong>
            <p style="margin: 8px 0 0;">We will automatically charge <strong>&#8358;{amount_naira:,.2f}</strong> to your saved card
            on {charge_date}. No action is needed — your access will continue without interruption.</p>
        </div>
        <p>If you would like to cancel auto-renewal or update your payment method, please visit your billing settings
        before the charge date.</p>
    '''

    subject = f"Your {plan_name} subscription renews {notice} — we'll handle it automatically"
    heading = "Upcoming Auto-Renewal"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Manage Auto-Renewal", cta_url=_get_dashboard_url(subscription)
        )


def send_auto_debit_retry_email(subscription, attempt_number, next_retry_date):
    """
    Send notification after a failed auto-debit attempt when retries remain.
    Tells the school we'll try again tomorrow.
    """
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    billing_cycle = subscription.billing_cycle
    amount_kobo = subscription.plan.annual_price if billing_cycle == 'annual' else subscription.plan.monthly_price
    amount_naira = amount_kobo / 100
    retry_date = next_retry_date.strftime('%B %d, %Y')
    attempts_left = 3 - attempt_number

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>We attempted to automatically renew your <strong>{plan_name}</strong> subscription but were unable
        to charge your saved card.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #718096;">Plan</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">{plan_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #718096;">Amount</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">&#8358;{amount_naira:,.2f}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #718096;">Attempt</td>
                <td style="padding: 10px 0; font-weight: 600; text-align: right;">{attempt_number} of 3</td>
            </tr>
        </table>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>We will try again on {retry_date}</strong>
            <p style="margin: 8px 0 0;">Your school access remains active while we retry.
            We have <strong>{attempts_left} attempt{"s" if attempts_left != 1 else ""} remaining</strong>.
            If all attempts fail, auto-renewal will be disabled and you will need to renew manually.</p>
        </div>
        <p>To avoid any disruption, you can update your payment method or make a manual payment now.
        Common reasons for charge failure include an expired card, insufficient funds, or card restrictions.</p>
    '''

    subject = f"Auto-renewal unsuccessful — we'll retry on {retry_date}"
    heading = "Auto-Renewal Unsuccessful"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Update Payment Method", cta_url=_get_dashboard_url(subscription)
        )


def send_auto_debit_failed_email(subscription):
    """
    Send notification when all 3 auto-debit attempts have failed.
    Auto-debit is disabled after this — user must renew manually.
    """
    school_name = subscription.school.name
    plan_name = subscription.plan.display_name
    billing_cycle = subscription.billing_cycle
    amount_kobo = subscription.plan.annual_price if billing_cycle == 'annual' else subscription.plan.monthly_price
    amount_naira = amount_kobo / 100
    grace_end = subscription.get_grace_period_end()
    grace_date = grace_end.strftime('%B %d, %Y') if grace_end else 'soon'

    body = f'''
        <p>Dear <strong>{school_name}</strong> team,</p>
        <p>We made <strong>3 attempts</strong> to automatically renew your <strong>{plan_name}</strong>
        subscription (&#8358;{amount_naira:,.2f}) but were unable to charge your saved card on any of them.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>Manual renewal required</strong>
            <p style="margin: 8px 0 0;">Your subscription has entered a grace period. To avoid losing access,
            please renew manually before <strong>{grace_date}</strong>. Auto-renewal has been disabled — you can
            re-enable it in your billing settings after updating your payment method.</p>
        </div>
        <p>Common reasons for charge failure include: expired card, insufficient funds, or card restrictions.
        If you believe this is an error, please contact your bank or our support team.</p>
    '''

    subject = f"Auto-renewal failed after 3 attempts — please renew {plan_name} manually"
    heading = "Auto-Renewal Failed"

    recipients = _get_subscription_recipients(subscription)
    for r in recipients:
        send_insightwick_email(
            r['email'], r['name'], subject, heading, body,
            cta_text="Renew Now", cta_url=_get_pricing_url()
        )
