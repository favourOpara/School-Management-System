from rest_framework import serializers
from django.utils import timezone
from django.utils.text import slugify
from django.contrib.auth import get_user_model
from datetime import timedelta
import re
import secrets
import string

from .models import School, SubscriptionPlan, Subscription, PaymentHistory, SchoolInvitation, PortalUser

User = get_user_model()


def generate_admin_username(school_name):
    """Generate a unique admin username based on school name."""
    base = slugify(school_name).replace('-', '')[:15]
    username = f"{base}_admin"
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}_admin{counter}"
        counter += 1
    return username


def generate_random_password(length=12):
    """Generate a secure random password."""
    chars = string.ascii_letters + string.digits + "!@#$%"
    # Ensure at least one of each required type
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%"),
    ]
    password += [secrets.choice(chars) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Serializer for subscription plans (public view)."""
    monthly_price_naira = serializers.SerializerMethodField()
    annual_price_naira = serializers.SerializerMethodField()
    annual_savings = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'display_name', 'description',
            'monthly_price', 'annual_price', 'monthly_price_naira', 'annual_price_naira',
            'annual_savings', 'max_admin_accounts', 'max_daily_emails',
            'has_import_feature', 'has_staff_management', 'trial_days', 'display_order'
        ]

    def get_monthly_price_naira(self, obj):
        return obj.monthly_price / 100

    def get_annual_price_naira(self, obj):
        return obj.annual_price / 100

    def get_annual_savings(self, obj):
        """Calculate savings when paying annually."""
        if obj.monthly_price == 0:
            return 0
        yearly_monthly = obj.monthly_price * 12
        savings = yearly_monthly - obj.annual_price
        return savings / 100  # Return in Naira


class SchoolSerializer(serializers.ModelSerializer):
    """Serializer for school details."""
    subscription_status = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    days_left_in_trial = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'id', 'name', 'slug', 'email', 'phone', 'address', 'logo',
            'accent_color', 'secondary_color', 'email_sender_name', 'tagline', 'website',
            'current_academic_year', 'current_term',
            'is_active', 'is_verified', 'trial_start_date', 'trial_end_date',
            'subscription_status', 'plan_name', 'days_left_in_trial',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at']

    def get_subscription_status(self, obj):
        if hasattr(obj, 'subscription'):
            return obj.subscription.status
        return None

    def get_plan_name(self, obj):
        if hasattr(obj, 'subscription'):
            return obj.subscription.plan.display_name
        return None

    def get_days_left_in_trial(self, obj):
        return obj.days_left_in_trial()


class SchoolPublicSerializer(serializers.ModelSerializer):
    """Public serializer for school (minimal info for login page)."""

    class Meta:
        model = School
        fields = ['id', 'name', 'slug', 'logo', 'accent_color', 'secondary_color', 'tagline',
                  'current_academic_year', 'current_term']


class SchoolConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for school configuration/branding settings."""

    class Meta:
        model = School
        fields = [
            'name', 'email', 'phone', 'address', 'logo',
            'accent_color', 'secondary_color', 'email_sender_name', 'tagline', 'website',
        ]

    def validate_accent_color(self, value):
        """Validate hex color format."""
        import re
        if value and not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError("Invalid hex color format. Use format: #RRGGBB")
        return value

    def validate_secondary_color(self, value):
        """Validate hex color format."""
        import re
        if value and not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError("Invalid hex color format. Use format: #RRGGBB")
        return value



class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for subscription details."""
    plan = SubscriptionPlanSerializer(read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
    admin_count = serializers.SerializerMethodField()
    can_create_admin = serializers.SerializerMethodField()
    can_send_email = serializers.SerializerMethodField()
    emails_remaining_today = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = [
            'id', 'school_name', 'plan', 'status', 'billing_cycle',
            'current_period_start', 'current_period_end',
            'admin_count', 'can_create_admin', 'can_send_email',
            'emails_sent_today', 'emails_remaining_today',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_admin_count(self, obj):
        return obj.get_admin_count()

    def get_can_create_admin(self, obj):
        return obj.can_create_admin()

    def get_can_send_email(self, obj):
        return obj.can_send_email()

    def get_emails_remaining_today(self, obj):
        if obj.plan.max_daily_emails == 0:
            return -1  # Unlimited
        return max(0, obj.plan.max_daily_emails - obj.emails_sent_today)


class PaymentHistorySerializer(serializers.ModelSerializer):
    """Serializer for payment history."""
    amount_naira = serializers.SerializerMethodField()
    school_name = serializers.CharField(source='subscription.school.name', read_only=True)

    class Meta:
        model = PaymentHistory
        fields = [
            'id', 'school_name', 'paystack_reference', 'amount', 'amount_naira',
            'currency', 'status', 'payment_method', 'card_type', 'card_last4',
            'bank_name', 'plan_name', 'billing_cycle', 'created_at', 'paid_at'
        ]
        read_only_fields = ['id', 'created_at', 'paid_at']

    def get_amount_naira(self, obj):
        return obj.amount_in_naira()


class SchoolRegistrationSerializer(serializers.Serializer):
    """
    Serializer for new school registration.

    Creates:
    1. School - The tenant/school entity
    2. Subscription - The school's subscription
    3. PortalUser - For Admin Portal authentication (email/password)
    4. CustomUser (admin) - For School Management System authentication (username/password)
    """
    # School info
    school_name = serializers.CharField(max_length=255)
    school_email = serializers.EmailField()
    school_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    school_address = serializers.CharField(required=False, allow_blank=True)

    # Portal user info (for Admin Portal login)
    admin_first_name = serializers.CharField(max_length=150)
    admin_last_name = serializers.CharField(max_length=150)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(min_length=8, write_only=True)

    # Plan selection
    plan_id = serializers.UUIDField()
    billing_cycle = serializers.ChoiceField(
        choices=[('monthly', 'Monthly'), ('annual', 'Annual')],
        default='monthly'
    )

    def validate_school_name(self, value):
        """Generate and validate slug from school name."""
        slug = slugify(value)
        if School.objects.filter(slug=slug).exists():
            raise serializers.ValidationError(
                "A school with a similar name already exists. Please choose a different name."
            )
        return value

    def validate_school_email(self, value):
        """Check if school email is already registered."""
        if School.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "This email is already registered to another school."
            )
        return value

    def validate_admin_email(self, value):
        """Check if admin email is already in use for portal."""
        if PortalUser.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "This email is already registered to another portal account."
            )
        return value

    def validate_admin_password(self, value):
        """Validate password strength."""
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError("Password must contain at least one uppercase letter.")
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError("Password must contain at least one lowercase letter.")
        if not re.search(r'[0-9]', value):
            raise serializers.ValidationError("Password must contain at least one digit.")
        return value

    def validate_plan_id(self, value):
        """Validate that the plan exists and is active."""
        try:
            plan = SubscriptionPlan.objects.get(id=value, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive subscription plan.")
        return value

    def create(self, validated_data):
        """Create school, subscription, portal user, and initial admin user."""
        from django.db import transaction

        plan = SubscriptionPlan.objects.get(id=validated_data['plan_id'])

        with transaction.atomic():
            # Create school
            school = School.objects.create(
                name=validated_data['school_name'],
                slug=slugify(validated_data['school_name']),
                email=validated_data['school_email'],
                phone=validated_data.get('school_phone', ''),
                address=validated_data.get('school_address', ''),
                is_active=True,
                is_verified=False,
                trial_start_date=timezone.now(),
                trial_end_date=timezone.now() + timedelta(days=plan.trial_days)
            )

            # Create or update subscription (signal may have created a default one)
            subscription, _ = Subscription.objects.update_or_create(
                school=school,
                defaults={
                    'plan': plan,
                    'status': 'trial',
                    'billing_cycle': validated_data.get('billing_cycle', 'monthly'),
                    'current_period_start': timezone.now(),
                    'current_period_end': timezone.now() + timedelta(days=plan.trial_days if plan.trial_days > 0 else 30)
                }
            )

            # Create portal user (for Admin Portal authentication)
            portal_user = PortalUser.objects.create(
                school=school,
                email=validated_data['admin_email'],
                first_name=validated_data['admin_first_name'],
                last_name=validated_data['admin_last_name'],
                is_active=True,
                is_primary=True  # This is the primary portal user (school owner)
            )
            portal_user.set_password(validated_data['admin_password'])
            portal_user.save()

            # Generate username and password for school system admin account
            admin_username = generate_admin_username(validated_data['school_name'])
            admin_password = generate_random_password()

            # Create admin user for School Management System
            admin_user = User.objects.create_user(
                username=admin_username,
                email=validated_data['admin_email'],  # Same email for notifications
                password=admin_password,
                first_name=validated_data['admin_first_name'],
                last_name=validated_data['admin_last_name'],
                role='admin',
                school=school,
                is_active=True,
                email_verified=True,  # No verification needed, created by portal
                must_change_password=False
            )

        return {
            'school': school,
            'subscription': subscription,
            'portal_user': portal_user,
            'admin_user': admin_user,
            'admin_username': admin_username,
            'admin_password': admin_password  # Return for display in portal
        }


class SlugCheckSerializer(serializers.Serializer):
    """Serializer for checking slug availability."""
    slug = serializers.SlugField(max_length=100)

    def validate_slug(self, value):
        """Check if slug is available."""
        value = value.lower()
        if School.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This URL is already taken.")
        return value


class UpgradePlanSerializer(serializers.Serializer):
    """Serializer for upgrading subscription plan."""
    plan_id = serializers.UUIDField()
    billing_cycle = serializers.ChoiceField(
        choices=[('monthly', 'Monthly'), ('annual', 'Annual')],
        required=False
    )

    def validate_plan_id(self, value):
        """Validate the new plan."""
        try:
            plan = SubscriptionPlan.objects.get(id=value, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive subscription plan.")
        return value


class InitializePaymentSerializer(serializers.Serializer):
    """Serializer for initializing a payment."""
    plan_id = serializers.UUIDField()
    billing_cycle = serializers.ChoiceField(
        choices=[('monthly', 'Monthly'), ('annual', 'Annual')]
    )
    callback_url = serializers.URLField(required=False)

    def validate_plan_id(self, value):
        """Validate the plan."""
        try:
            plan = SubscriptionPlan.objects.get(id=value, is_active=True)
            if plan.monthly_price == 0:
                raise serializers.ValidationError("Cannot initiate payment for free plan.")
        except SubscriptionPlan.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive subscription plan.")
        return value


class ContactSalesSerializer(serializers.Serializer):
    """Serializer for custom plan inquiries."""
    school_name = serializers.CharField(max_length=255)
    contact_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    message = serializers.CharField()
    expected_students = serializers.IntegerField(required=False)
    expected_staff = serializers.IntegerField(required=False)


class PortalUserSerializer(serializers.ModelSerializer):
    """Serializer for portal user details."""
    school_name = serializers.CharField(source='school.name', read_only=True)
    school_slug = serializers.CharField(source='school.slug', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = PortalUser
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name', 'phone',
            'is_active', 'is_primary', 'school_name', 'school_slug',
            'created_at', 'last_login'
        ]
        read_only_fields = ['id', 'is_primary', 'created_at', 'last_login']

    def get_full_name(self, obj):
        return obj.get_full_name()


class SchoolAdminAccountSerializer(serializers.ModelSerializer):
    """
    Serializer for school system admin accounts.
    Used to view and manage admin accounts from the portal.
    """
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'date_joined', 'last_login', 'can_edit'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_can_edit(self, obj):
        """All admin accounts can be edited from the portal."""
        return True


class CreateSchoolAdminSerializer(serializers.Serializer):
    """Serializer for creating new school admin accounts."""
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=8, write_only=True, required=False)

    def validate_username(self, value):
        """Check username is unique."""
        school = self.context.get('school')
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        """Check email is unique if provided."""
        if value:
            school = self.context.get('school')
            if User.objects.filter(email=value, school=school).exists():
                raise serializers.ValidationError("This email is already in use for this school.")
        return value

    def create(self, validated_data):
        school = self.context.get('school')
        password = validated_data.pop('password', None) or generate_random_password()

        admin_user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role='admin',
            school=school,
            is_active=True,
            email_verified=True,
            must_change_password=False  # Portal-created accounts don't need password change
        )

        return {
            'admin_user': admin_user,
            'password': password
        }


class UpdateSchoolAdminSerializer(serializers.Serializer):
    """Serializer for updating school admin account credentials."""
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    password = serializers.CharField(min_length=8, write_only=True, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_username(self, value):
        """Check username is unique (excluding current user)."""
        admin_user = self.context.get('admin_user')
        if User.objects.filter(username=value).exclude(id=admin_user.id).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            instance.must_change_password = False

        instance.save()
        return instance


class SchoolProprietorAccountSerializer(serializers.ModelSerializer):
    """Serializer for school system proprietor accounts."""
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'date_joined', 'last_login', 'can_edit'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_can_edit(self, obj):
        return True


class CreateSchoolProprietorSerializer(serializers.Serializer):
    """Serializer for creating new school proprietor accounts."""
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=8, write_only=True, required=False)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        if value:
            school = self.context.get('school')
            if User.objects.filter(email=value, school=school).exists():
                raise serializers.ValidationError("This email is already in use for this school.")
        return value

    def create(self, validated_data):
        school = self.context.get('school')
        password = validated_data.pop('password', None) or generate_random_password()

        proprietor_user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role='proprietor',
            school=school,
            is_active=True,
            email_verified=True,
            must_change_password=False  # Portal-created accounts don't need password change
        )

        return {
            'proprietor_user': proprietor_user,
            'password': password
        }


class UpdateSchoolProprietorSerializer(serializers.Serializer):
    """Serializer for updating school proprietor account credentials."""
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    password = serializers.CharField(min_length=8, write_only=True, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_username(self, value):
        prop_user = self.context.get('prop_user')
        if User.objects.filter(username=value).exclude(id=prop_user.id).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            instance.must_change_password = False

        instance.save()
        return instance
