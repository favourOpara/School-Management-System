"""
Django signals for tenant-related events.
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta

from .models import School, Subscription, SubscriptionPlan


@receiver(post_save, sender=School)
def create_default_subscription(sender, instance, created, **kwargs):
    """
    Create a default trial subscription when a new school is created.

    This ensures every school has a subscription record.
    """
    if created and not hasattr(instance, 'subscription'):
        # Get the free trial plan
        free_plan = SubscriptionPlan.objects.filter(name='free').first()

        if free_plan:
            trial_end = timezone.now() + timedelta(days=free_plan.trial_days)

            Subscription.objects.create(
                school=instance,
                plan=free_plan,
                status='trial',
                billing_cycle='monthly',
                current_period_start=timezone.now(),
                current_period_end=trial_end,
            )


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
                elif instance.status == 'active' and old_instance.status == 'trial':
                    _handle_trial_to_active(instance)

        except Subscription.DoesNotExist:
            pass


def _handle_subscription_expired(subscription):
    """
    Handle actions when subscription expires.
    """
    # Optionally deactivate school or send notification
    try:
        from logs.email_service import send_notification_email
        from users.models import CustomUser

        admins = CustomUser.objects.filter(
            school=subscription.school,
            role='admin',
            is_active=True
        )

        for admin in admins:
            send_notification_email(
                recipient_user=admin,
                title="Subscription Expired",
                message=f"Your {subscription.plan.display_name} subscription has expired. "
                        f"Please renew to continue accessing all features.",
                notification_type='subscription_expired',
                priority='high'
            )
    except Exception:
        pass


def _handle_trial_to_active(subscription):
    """
    Handle conversion from trial to active subscription.
    """
    try:
        from logs.email_service import send_notification_email
        from users.models import CustomUser

        admins = CustomUser.objects.filter(
            school=subscription.school,
            role='admin',
            is_active=True
        )

        for admin in admins:
            send_notification_email(
                recipient_user=admin,
                title="Subscription Activated",
                message=f"Welcome to {subscription.plan.display_name}! "
                        f"Your subscription is now active. Thank you for choosing EduCare.",
                notification_type='subscription_activated',
                priority='medium'
            )
    except Exception:
        pass


@receiver(pre_save, sender=Subscription)
def reset_email_counter(sender, instance, **kwargs):
    """
    Reset daily email counter if date has changed.
    """
    today = timezone.now().date()

    if instance.email_counter_reset_date < today:
        instance.emails_sent_today = 0
        instance.email_counter_reset_date = today
