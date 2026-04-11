from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, RegexValidator
import uuid


class School(models.Model):
    """
    Represents a school/tenant in the multi-tenant system.
    Each school has its own isolated data and subscription.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="School name")
    slug = models.SlugField(
        max_length=100,
        unique=True,
        help_text="URL path identifier (e.g., 'greenwood-academy')",
        validators=[
            RegexValidator(
                regex=r'^[a-z0-9]+(?:-[a-z0-9]+)*$',
                message='Slug must contain only lowercase letters, numbers, and hyphens'
            )
        ]
    )
    email = models.EmailField(help_text="Primary contact email")
    phone = models.CharField(max_length=20, blank=True, help_text="Contact phone number")
    address = models.TextField(blank=True, help_text="School address")
    logo = models.ImageField(upload_to='school_logos/', blank=True, null=True)

    # Branding & Configuration
    accent_color = models.CharField(
        max_length=7,
        default='#2563eb',
        help_text="Primary accent color in hex format (e.g., #2563eb)"
    )
    secondary_color = models.CharField(
        max_length=7,
        default='#4f46e5',
        help_text="Secondary color in hex format"
    )
    email_sender_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Name to display as email sender (e.g., 'Greenwood Academy')"
    )
    tagline = models.CharField(
        max_length=200,
        blank=True,
        help_text="School tagline/motto"
    )
    website = models.URLField(blank=True, help_text="School website URL")

    # Academic Session Settings - Empty for new schools
    current_academic_year = models.CharField(
        max_length=9,
        blank=True,
        null=True,
        help_text="Current academic year (e.g., 2024/2025) - Set when first session is created"
    )
    current_term = models.CharField(
        max_length=20,
        choices=[
            ('First Term', 'First Term'),
            ('Second Term', 'Second Term'),
            ('Third Term', 'Third Term'),
        ],
        blank=True,
        null=True,
        help_text="Current term - Set when first session is created"
    )

    # Lesson notes setting
    lesson_note_weeks_per_term = models.PositiveSmallIntegerField(
        default=12,
        help_text="Number of weeks per term — sets how many lesson notes each teacher must submit per subject"
    )

    # School status
    is_active = models.BooleanField(default=True, help_text="Whether the school is active")
    is_verified = models.BooleanField(default=False, help_text="Whether the school has been verified")

    # Trial tracking
    trial_start_date = models.DateTimeField(null=True, blank=True)
    trial_end_date = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'School'
        verbose_name_plural = 'Schools'

    def __str__(self):
        return self.name

    def is_trial_active(self):
        """Check if the school is still in trial period."""
        if self.trial_end_date:
            return timezone.now() < self.trial_end_date
        return False

    def days_left_in_trial(self):
        """Get the number of days left in trial."""
        if self.trial_end_date:
            delta = self.trial_end_date - timezone.now()
            return max(0, delta.days)
        return 0


class SubscriptionPlan(models.Model):
    """
    Defines the subscription tiers available for schools.
    """
    PLAN_CHOICES = [
        ('basic', 'Basic'),
        ('standard', 'Standard'),
        ('premium', 'Premium'),
        ('custom', 'Custom'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, choices=PLAN_CHOICES, unique=True)
    display_name = models.CharField(max_length=100, help_text="Display name for the plan")
    description = models.TextField(blank=True, help_text="Plan description")

    # Pricing (in kobo for Paystack - 100 kobo = 1 NGN)
    monthly_price = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Monthly price in kobo"
    )
    annual_price = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Annual price in kobo (usually discounted)"
    )

    # Paystack plan codes (created via Paystack API)
    paystack_monthly_plan_code = models.CharField(max_length=100, blank=True)
    paystack_annual_plan_code = models.CharField(max_length=100, blank=True)

    # Feature limits
    max_admin_accounts = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Maximum admin accounts allowed"
    )
    max_daily_emails = models.IntegerField(
        default=300,
        validators=[MinValueValidator(0)],
        help_text="Maximum emails per day (0 = unlimited)"
    )
    has_import_feature = models.BooleanField(
        default=False,
        help_text="Whether CSV import is available"
    )
    has_staff_management = models.BooleanField(
        default=False,
        help_text="Whether staff management (Book On/Off) is available"
    )
    max_import_rows = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Maximum students per XLSX import (0 = not available)"
    )
    max_students = models.IntegerField(
        default=300,
        validators=[MinValueValidator(0)],
        help_text="Maximum student accounts (0 = unlimited)"
    )
    max_teachers = models.IntegerField(
        default=20,
        validators=[MinValueValidator(0)],
        help_text="Maximum teacher accounts (0 = unlimited)"
    )
    max_principals = models.IntegerField(
        default=1,
        validators=[MinValueValidator(0)],
        help_text="Maximum principal accounts (0 = unlimited)"
    )
    max_parents = models.IntegerField(
        default=300,
        validators=[MinValueValidator(0)],
        help_text="Maximum parent accounts (0 = unlimited)"
    )
    max_proprietors = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Maximum proprietor accounts (0 = not available)"
    )

    # Trial settings
    trial_days = models.IntegerField(
        default=30,
        validators=[MinValueValidator(0)],
        help_text="Number of trial days for new schools (standard free trial)"
    )
    termly_trial_days = models.IntegerField(
        default=120,
        validators=[MinValueValidator(0)],
        help_text="Number of trial days for the termly free trial (approx. one full school term)"
    )
    grace_period_days = models.IntegerField(
        default=5,
        validators=[MinValueValidator(0)],
        help_text="Number of grace days after expiry before full lockout (0 = no grace)"
    )

    # Status
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(
        default=True,
        help_text="Whether this plan is visible on pricing page"
    )

    # Order for display
    display_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'monthly_price']
        verbose_name = 'Subscription Plan'
        verbose_name_plural = 'Subscription Plans'

    def __str__(self):
        return self.display_name


class Subscription(models.Model):
    """
    Tracks a school's subscription status and billing information.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('trial', 'Trial'),
        ('active', 'Active'),
        ('grace_period', 'Grace Period'),
        ('past_due', 'Past Due'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]

    BILLING_CYCLE_CHOICES = [
        ('monthly', 'Monthly'),
        ('annual', 'Annual'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(
        School,
        on_delete=models.CASCADE,
        related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name='subscriptions'
    )

    # Subscription status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    billing_cycle = models.CharField(
        max_length=20,
        choices=BILLING_CYCLE_CHOICES,
        default='monthly'
    )

    # Paystack integration
    paystack_customer_code = models.CharField(max_length=100, blank=True)
    paystack_subscription_code = models.CharField(max_length=100, blank=True)
    paystack_email_token = models.CharField(
        max_length=100,
        blank=True,
        help_text="Token for managing subscription via email"
    )
    paystack_authorization_code = models.CharField(
        max_length=100,
        blank=True,
        help_text="Saved card authorization for recurring charges"
    )

    # Auto-debit (charge authorization) settings
    auto_debit_enabled = models.BooleanField(
        default=False,
        help_text="Whether to automatically charge saved card on renewal"
    )
    paystack_billing_email = models.CharField(
        max_length=255,
        blank=True,
        help_text="Customer email on file with Paystack for charge_authorization calls"
    )

    # Billing period
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    # Email rate limiting
    emails_sent_today = models.IntegerField(default=0)
    email_counter_reset_date = models.DateField(default=timezone.now)

    # Expiry warning tracking
    last_expiry_warning_sent = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Last expiry warning milestone sent (pre_7, pre_3, pre_1, grace_1, grace_2, grace_3, grace_4, grace_5)"
    )

    # Auto-debit retry tracking
    auto_debit_retry_count = models.IntegerField(
        default=0,
        help_text="Number of failed auto-debit attempts in the current renewal cycle"
    )
    auto_debit_next_retry = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When to attempt the next auto-debit retry"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Subscription'
        verbose_name_plural = 'Subscriptions'

    def __str__(self):
        return f"{self.school.name} - {self.plan.display_name} ({self.status})"

    def is_active_or_trial(self):
        """Check if subscription is in a usable state (including grace period)."""
        return self.status in ['trial', 'active', 'grace_period']

    def is_in_grace_period(self):
        """Check if subscription is currently in grace period."""
        return self.status == 'grace_period'

    def get_grace_period_end(self):
        """Calculate when grace period ends."""
        if self.current_period_end and self.plan:
            from datetime import timedelta
            return self.current_period_end + timedelta(days=self.plan.grace_period_days)
        return None

    def get_grace_days_remaining(self):
        """Get number of days remaining in grace period."""
        if not self.is_in_grace_period() or not self.current_period_end:
            return 0
        gp_end = self.get_grace_period_end()
        if gp_end:
            delta = gp_end - timezone.now()
            return max(0, delta.days)
        return 0

    def is_expired(self):
        """Check if subscription has expired."""
        if self.current_period_end:
            return timezone.now() > self.current_period_end
        return False

    def can_send_email(self):
        """Check if the school can send more emails today."""
        # Reset counter if it's a new day
        today = timezone.now().date()
        if self.email_counter_reset_date < today:
            self.emails_sent_today = 0
            self.email_counter_reset_date = today
            self.save(update_fields=['emails_sent_today', 'email_counter_reset_date'])

        # Check against limit (0 = unlimited)
        if self.plan.max_daily_emails == 0:
            return True
        return self.emails_sent_today < self.plan.max_daily_emails

    def increment_email_count(self):
        """Increment the daily email counter."""
        self.emails_sent_today += 1
        self.save(update_fields=['emails_sent_today'])

    def get_admin_count(self):
        """Get the current count of admin users for this school."""
        from users.models import CustomUser
        return CustomUser.objects.filter(
            school=self.school,
            role='admin',
            is_active=True
        ).count()

    def can_create_admin(self):
        """Check if more admin accounts can be created."""
        return self.get_admin_count() < self.plan.max_admin_accounts

    def get_proprietor_count(self):
        """Get the current count of proprietor users for this school."""
        from users.models import CustomUser
        return CustomUser.objects.filter(
            school=self.school,
            role='proprietor',
            is_active=True
        ).count()

    def can_create_proprietor(self):
        """Check if more proprietor accounts can be created."""
        if self.plan.max_proprietors == 0:
            return False
        return self.get_proprietor_count() < self.plan.max_proprietors


class PaymentHistory(models.Model):
    """
    Records all payment transactions for auditing and history.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.CASCADE,
        related_name='payments'
    )

    # Payment details
    paystack_reference = models.CharField(max_length=100, unique=True)
    paystack_transaction_id = models.CharField(max_length=100, blank=True)
    amount = models.IntegerField(help_text="Amount in kobo")
    currency = models.CharField(max_length=3, default='NGN')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Payment method details
    payment_method = models.CharField(max_length=50, blank=True, help_text="e.g., card, bank_transfer")
    card_type = models.CharField(max_length=20, blank=True, help_text="e.g., visa, mastercard")
    card_last4 = models.CharField(max_length=4, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)

    # Plan info at time of payment
    plan_name = models.CharField(max_length=100)
    billing_cycle = models.CharField(max_length=20)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Payment History'
        verbose_name_plural = 'Payment Histories'

    def __str__(self):
        return f"{self.subscription.school.name} - {self.amount/100} {self.currency} ({self.status})"

    def amount_in_naira(self):
        """Convert kobo amount to Naira."""
        return self.amount / 100


class PortalUser(models.Model):
    """
    Portal user for Admin Portal authentication.
    This is separate from the school management system users (CustomUser).

    Portal users are school owners who can:
    - Configure school branding
    - Manage subscription
    - Create/manage admin accounts for the school system
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='portal_users'
    )

    # Authentication
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)  # Hashed password

    # Profile
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    phone = models.CharField(max_length=20, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_primary = models.BooleanField(
        default=False,
        help_text="Primary portal user (school owner)"
    )

    # Email verification
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.UUIDField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-is_primary', 'created_at']
        verbose_name = 'Portal User'
        verbose_name_plural = 'Portal Users'

    def __str__(self):
        return f"{self.email} - {self.school.name}"

    def set_password(self, raw_password):
        """Hash and set the password."""
        from django.contrib.auth.hashers import make_password
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        """Check the password against the stored hash."""
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password)

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"


class EmailOTP(models.Model):
    """
    One-time passcode for verifying an email address during registration.
    Generated when a prospective school admin clicks "Send Code" in Step 2.
    Expires after 15 minutes.
    """
    email = models.EmailField(db_index=True)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    verified = models.BooleanField(default=False)
    sent = models.BooleanField(default=False)  # True only if email was delivered

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP for {self.email} ({'verified' if self.verified else 'pending'})"

    def is_expired(self):
        from django.utils import timezone
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(minutes=15)


class OnboardingAgent(models.Model):
    """
    InsightWick internal onboarding staff.
    These are InsightWick employees who help new schools get set up after registration.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Authentication
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)

    # Profile
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    phone = models.CharField(max_length=20, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['first_name', 'last_name']
        verbose_name = 'Onboarding Agent'
        verbose_name_plural = 'Onboarding Agents'

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password)

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class OnboardingRecord(models.Model):
    """
    Tracks onboarding progress for a school.
    Auto-created when a school registers so agents can claim and track setup tasks.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(
        School,
        on_delete=models.CASCADE,
        related_name='onboarding'
    )
    agent = models.ForeignKey(
        OnboardingAgent,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_schools'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Registration context
    registration_type = models.CharField(max_length=50, blank=True)

    # Onboarding checklist
    students_imported = models.BooleanField(default=False)
    teachers_added = models.BooleanField(default=False)
    classes_setup = models.BooleanField(default=False)
    subjects_setup = models.BooleanField(default=False)
    parents_added = models.BooleanField(default=False)
    attendance_configured = models.BooleanField(default=False)
    grading_configured = models.BooleanField(default=False)

    notes = models.TextField(blank=True)          # filled by onboarding staff
    admin_notes = models.TextField(blank=True)    # filled by platform admin on reassignment

    # Conversation link token — used by schools to reply via the web page
    conversation_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    assigned_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Onboarding Record'
        verbose_name_plural = 'Onboarding Records'

    def __str__(self):
        return f"Onboarding: {self.school.name} ({self.status})"

    def get_checklist_progress(self):
        """Returns (completed_count, total_count)."""
        fields = [
            self.students_imported, self.teachers_added, self.classes_setup,
            self.subjects_setup, self.parents_added,
            self.attendance_configured, self.grading_configured,
        ]
        return sum(1 for f in fields if f), len(fields)


class ContactInquiry(models.Model):
    """
    Stores contact/sales inquiries submitted from the landing page or any public form.
    Platform admin can view, assign to onboarding staff, and track resolution.
    """
    STATUS_CHOICES = [
        ('new', 'New'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Submitted form data
    school_name = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    message = models.TextField()
    expected_students = models.IntegerField(null=True, blank=True)
    expected_staff = models.IntegerField(null=True, blank=True)
    source = models.CharField(max_length=50, default='contact_sales')  # e.g. contact_sales, landing_page

    # Management
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    assigned_agent = models.ForeignKey(
        OnboardingAgent,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_contacts',
    )
    admin_notes = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Contact Inquiry'
        verbose_name_plural = 'Contact Inquiries'

    def __str__(self):
        return f"{self.school_name} — {self.contact_name} ({self.status})"


class SchoolInvitation(models.Model):
    """
    Tracks invitations sent to potential schools/admins.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    school_name = models.CharField(max_length=255)
    token = models.CharField(max_length=100, unique=True)

    # Status
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'School Invitation'
        verbose_name_plural = 'School Invitations'

    def __str__(self):
        return f"Invitation for {self.school_name} ({self.email})"

    def is_valid(self):
        """Check if the invitation is still valid."""
        return not self.is_used and timezone.now() < self.expires_at


class SupportTicket(models.Model):
    """
    Support requests submitted by school admins from within the school management system.
    Platform admin can view, assign to onboarding staff, and auto-distribute.
    """
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name='support_tickets'
    )

    # Snapshot of submitter at time of submission
    submitted_by_name = models.CharField(max_length=255)
    submitted_by_email = models.EmailField()

    subject = models.CharField(max_length=255)
    message = models.TextField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_agent = models.ForeignKey(
        OnboardingAgent,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='support_tickets',
    )

    # Notes (append-only via _append_note helper)
    agent_notes = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Support Ticket'
        verbose_name_plural = 'Support Tickets'

    def __str__(self):
        return f"{self.school.name} — {self.subject} ({self.status})"


class StaffReply(models.Model):
    """
    A reply sent from InsightWick staff (platform admin or onboarding agent) to a school.

    Links to exactly one of: SupportTicket, ContactInquiry, or OnboardingRecord.
    The reply is emailed to the school via send_insightwick_email() (bypasses school quotas).
    Both platform admin and onboarding agents can see and send replies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Link to parent record — only one should be set
    support_ticket = models.ForeignKey(
        SupportTicket, null=True, blank=True, on_delete=models.CASCADE, related_name='replies'
    )
    contact_inquiry = models.ForeignKey(
        ContactInquiry, null=True, blank=True, on_delete=models.CASCADE, related_name='replies'
    )
    onboarding_record = models.ForeignKey(
        OnboardingRecord, null=True, blank=True, on_delete=models.CASCADE, related_name='replies'
    )

    # Sender
    sent_by_agent = models.ForeignKey(
        OnboardingAgent, null=True, blank=True, on_delete=models.SET_NULL, related_name='sent_replies'
    )
    sent_by_admin = models.BooleanField(default=False)  # True when sent by platform admin
    sender_name = models.CharField(max_length=255)       # snapshot at send time

    # Content
    message = models.TextField()

    # Delivery
    recipient_email = models.EmailField()
    recipient_name = models.CharField(max_length=255, blank=True)
    email_sent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Staff Reply'
        verbose_name_plural = 'Staff Replies'

    def __str__(self):
        return f"Reply by {self.sender_name} at {self.created_at:%d %b %Y %H:%M}"


class SchoolMessage(models.Model):
    """
    An inbound message from a school, submitted via the conversation reply link.
    Paired with StaffReply to form a full two-way thread on an OnboardingRecord.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    onboarding_record = models.ForeignKey(
        OnboardingRecord,
        on_delete=models.CASCADE,
        related_name='school_messages',
    )
    sender_name = models.CharField(max_length=255)
    sender_email = models.EmailField(blank=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'School Message'
        verbose_name_plural = 'School Messages'

    def __str__(self):
        return f"Message from {self.sender_name} ({self.onboarding_record.school.name})"

