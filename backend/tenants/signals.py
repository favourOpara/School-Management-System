"""
Django signals for tenant-related events.
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta

from .models import School, Subscription, SubscriptionPlan, OnboardingRecord


@receiver(post_save, sender=School)
def create_default_subscription(sender, instance, created, **kwargs):
    """
    Create a default subscription when a new school is created outside
    the registration flow (e.g. via Django admin panel).

    Schools created via the registration API already get a subscription
    in the serializer's create() method, so this is a safety net only.
    """
    if created and not hasattr(instance, 'subscription'):
        # Default to Basic plan
        basic_plan = SubscriptionPlan.objects.filter(name='basic', is_active=True).first()

        if basic_plan:
            trial_end = timezone.now() + timedelta(days=basic_plan.trial_days)

            Subscription.objects.create(
                school=instance,
                plan=basic_plan,
                status='trial',
                billing_cycle='monthly',
                current_period_start=timezone.now(),
                current_period_end=trial_end,
            )

        # Ensure an onboarding record exists for every new school
        OnboardingRecord.objects.get_or_create(school=instance)


@receiver(pre_save, sender=Subscription)
def handle_subscription_status_change(sender, instance, **kwargs):
    """
    Handle subscription status changes.
    """
    if instance.pk:
        try:
            old_instance = Subscription.objects.get(pk=instance.pk)

            # Check if status changed
            if old_instance.status != instance.status:
                # Log status change
                from logs.models import ActivityLog

                ActivityLog.objects.create(
                    user=None,  # System action
                    action=f"Subscription status changed from {old_instance.status} to {instance.status}",
                    activity_type='subscription_status_change',
                    extra_data={
                        'school_id': str(instance.school.id),
                        'school_name': instance.school.name,
                        'old_status': old_instance.status,
                        'new_status': instance.status,
                        'plan': instance.plan.name,
                    }
                )

                # Handle specific status changes
                if instance.status == 'expired':
                    _handle_subscription_expired(instance)
                elif instance.status == 'grace_period':
                    _handle_grace_period_started(instance)
                elif instance.status == 'active' and old_instance.status in ('trial', 'grace_period', 'expired'):
                    _handle_trial_to_active(instance)

        except Subscription.DoesNotExist:
            pass


def _handle_subscription_expired(subscription):
    """
    Handle actions when subscription expires.
    Sends InsightWick-branded lockout notification.
    """
    try:
        from .insightwick_emails import send_expired_lockout_email
        send_expired_lockout_email(subscription)
    except Exception:
        pass


def _handle_grace_period_started(subscription):
    """
    Handle subscription entering grace period.
    Sends InsightWick-branded grace period start notification.
    """
    try:
        from .insightwick_emails import send_grace_period_start_email
        send_grace_period_start_email(subscription)
    except Exception:
        pass


def _handle_trial_to_active(subscription):
    """
    Handle conversion from trial/grace_period/expired to active subscription.
    Sends InsightWick-branded welcome email.
    """
    try:
        from .insightwick_emails import send_insightwick_welcome_email
        send_insightwick_welcome_email(subscription)
    except Exception:
        pass


@receiver(pre_save, sender=Subscription)
def reset_email_counter(sender, instance, **kwargs):
    """
    Reset daily email counter if date has changed.
    """
    today = timezone.now().date()

    # Handle case where email_counter_reset_date might be None or a datetime
    if instance.email_counter_reset_date:
        reset_date = instance.email_counter_reset_date
        # Convert datetime to date if needed
        if hasattr(reset_date, 'date'):
            reset_date = reset_date.date()

        if reset_date < today:
            instance.emails_sent_today = 0
            instance.email_counter_reset_date = today
    else:
        instance.email_counter_reset_date = today
