from rest_framework import serializers
from django.utils import timezone
from django.utils.text import slugify
from django.contrib.auth import get_user_model
from datetime import timedelta
import re

from .models import School, SubscriptionPlan, Subscription, PaymentHistory, SchoolInvitation

User = get_user_model()


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
            'has_import_feature', 'trial_days', 'display_order'
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
        fields = ['id', 'name', 'slug', 'logo']


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
    """Serializer for new school registration."""
    # School info
    school_name = serializers.CharField(max_length=255)
    school_email = serializers.EmailField()
    school_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    school_address = serializers.CharField(required=False, allow_blank=True)

    # Admin user info
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
        """Check if admin email is already in use."""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "This email is already registered to another user."
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
        """Create school, subscription, and admin user."""
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

            # Create subscription
            subscription = Subscription.objects.create(
                school=school,
                plan=plan,
                status='trial',
                billing_cycle=validated_data.get('billing_cycle', 'monthly'),
                current_period_start=timezone.now(),
                current_period_end=timezone.now() + timedelta(days=plan.trial_days)
            )

            # Create admin user
            admin_user = User.objects.create_user(
                username=validated_data['admin_email'],
                email=validated_data['admin_email'],
                password=validated_data['admin_password'],
                first_name=validated_data['admin_first_name'],
                last_name=validated_data['admin_last_name'],
                role='admin',
                school=school,
                is_active=True,
                email_verified=False
            )

        return {
            'school': school,
            'subscription': subscription,
            'admin_user': admin_user
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
