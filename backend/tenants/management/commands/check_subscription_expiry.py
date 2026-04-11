"""
Management command to check subscription expiry and send warning emails.

Should be run hourly via APScheduler or cron:
    python manage.py check_subscription_expiry
    python manage.py check_subscription_expiry --dry-run

Handles four phases:
1. Transition expired trial/active subscriptions to grace_period
   (with auto-debit attempt for eligible subscriptions)
2. Transition grace_period subscriptions past grace end to expired
3. Send pre-expiry warning emails (7, 3, 1 day before)
   (auto-debit users get "we'll charge your card" email instead)
4. Send daily grace period reminder emails (days 2, 3, 4, 5)
"""
import logging
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from tenants.models import Subscription, PaymentHistory

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Check subscription expiry, transition statuses, and send warning emails'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview actions without executing'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        now = timezone.now()

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be made'))

        # Phase 1: Transition expired trial/active → grace_period
        count = self._handle_new_expirations(now, dry_run)
        self.stdout.write(f'Phase 1: {count} subscription(s) transitioned to grace_period')

        # Phase 2: Transition grace_period → expired (grace elapsed)
        count = self._handle_grace_period_expirations(now, dry_run)
        self.stdout.write(f'Phase 2: {count} subscription(s) transitioned to expired')

        # Phase 3: Send pre-expiry warnings
        count = self._send_pre_expiry_warnings(now, dry_run)
        self.stdout.write(f'Phase 3: {count} pre-expiry warning(s) sent')

        # Phase 4: Send grace period reminders
        count = self._send_grace_period_reminders(now, dry_run)
        self.stdout.write(f'Phase 4: {count} grace period reminder(s) sent')

        self.stdout.write(self.style.SUCCESS('Subscription expiry check complete'))

    MAX_AUTO_DEBIT_RETRIES = 3

    def _handle_new_expirations(self, now, dry_run):
        """Transition trial/active subscriptions past current_period_end to grace_period.

        For subscriptions with auto-debit enabled, attempt a charge first.
        Failed charges are retried up to MAX_AUTO_DEBIT_RETRIES times (once per day)
        before falling through to grace period.
        """
        from tenants.insightwick_emails import (
            send_grace_period_start_email,
            send_expired_lockout_email,
            send_auto_debit_retry_email,
            send_auto_debit_failed_email,
        )

        expired_subs = Subscription.objects.filter(
            status__in=['trial', 'active'],
            current_period_end__lt=now
        ).select_related('school', 'plan')

        count = 0
        for sub in expired_subs:
            school_name = sub.school.name

            # Auto-debit eligible
            if (
                sub.auto_debit_enabled
                and sub.paystack_authorization_code
                and sub.paystack_billing_email
            ):
                # Still inside a retry cooldown — skip, keep subscription active
                if sub.auto_debit_next_retry and sub.auto_debit_next_retry > now:
                    self.stdout.write(f'  {school_name}: retry scheduled for {sub.auto_debit_next_retry.strftime("%Y-%m-%d %H:%M")} — skipping')
                    continue

                self.stdout.write(f'  {school_name}: auto-debit attempt {sub.auto_debit_retry_count + 1}/{self.MAX_AUTO_DEBIT_RETRIES}')

                if dry_run:
                    self.stdout.write(f'    [DRY RUN] Would attempt charge for {school_name}')
                    count += 1
                    continue

                charged = self._attempt_auto_charge(sub, now)

                if charged:
                    self.stdout.write(self.style.SUCCESS(f'    {school_name}: charged — subscription extended'))
                    count += 1
                    continue

                # Charge failed — decide retry or give up
                new_retry_count = sub.auto_debit_retry_count + 1

                if new_retry_count < self.MAX_AUTO_DEBIT_RETRIES:
                    # Schedule another attempt tomorrow, keep subscription active
                    next_retry = now + timedelta(days=1)
                    sub.auto_debit_retry_count = new_retry_count
                    sub.auto_debit_next_retry = next_retry
                    sub.save(update_fields=['auto_debit_retry_count', 'auto_debit_next_retry'])
                    self.stdout.write(self.style.WARNING(
                        f'    {school_name}: charge failed (attempt {new_retry_count}/{self.MAX_AUTO_DEBIT_RETRIES}) — retry scheduled for {next_retry.strftime("%Y-%m-%d")}'
                    ))
                    try:
                        send_auto_debit_retry_email(sub, new_retry_count, next_retry)
                    except Exception as e:
                        logger.error(f"Failed to send retry email for {school_name}: {e}")
                    count += 1
                    continue  # Keep subscription active, don't move to grace yet
                else:
                    # All retries exhausted — disable auto-debit, fall through to grace
                    sub.auto_debit_enabled = False
                    sub.auto_debit_retry_count = 0
                    sub.auto_debit_next_retry = None
                    sub.save(update_fields=['auto_debit_enabled', 'auto_debit_retry_count', 'auto_debit_next_retry'])
                    self.stdout.write(self.style.WARNING(f'    {school_name}: all {self.MAX_AUTO_DEBIT_RETRIES} attempts failed — auto-debit disabled, moving to grace'))
                    try:
                        send_auto_debit_failed_email(sub)
                    except Exception as e:
                        logger.error(f"Failed to send auto-debit failed email for {school_name}: {e}")
                    # Fall through to grace period logic below

            if sub.plan.grace_period_days > 0:
                self.stdout.write(f'  {school_name}: trial/active → grace_period ({sub.plan.grace_period_days} days)')
                if not dry_run:
                    sub.status = 'grace_period'
                    sub.last_expiry_warning_sent = 'grace_1'
                    sub.save(update_fields=['status', 'last_expiry_warning_sent'])
                    try:
                        send_grace_period_start_email(sub)
                    except Exception as e:
                        logger.error(f"Failed to send grace start email for {school_name}: {e}")
            else:
                self.stdout.write(f'  {school_name}: trial/active → expired (no grace period)')
                if not dry_run:
                    sub.status = 'expired'
                    sub.last_expiry_warning_sent = 'expired'
                    sub.save(update_fields=['status', 'last_expiry_warning_sent'])
                    try:
                        send_expired_lockout_email(sub)
                    except Exception as e:
                        logger.error(f"Failed to send lockout email for {school_name}: {e}")
            count += 1

        return count

    def _attempt_auto_charge(self, subscription, now):
        """
        Attempt to charge the saved card for subscription renewal.

        Creates a PaymentHistory record before charging so the webhook
        handler finds it and doesn't double-process.

        Returns True on successful charge, False on failure.
        Retry/disable logic lives in the caller (_handle_new_expirations).
        """
        from tenants.paystack import charge_authorization
        from tenants.insightwick_emails import send_insightwick_payment_confirmation

        billing_cycle = subscription.billing_cycle
        amount = (
            subscription.plan.annual_price
            if billing_cycle == 'annual'
            else subscription.plan.monthly_price
        )
        reference = f'auto_{subscription.school.slug}_{uuid.uuid4().hex[:8]}'

        # Create pending record first — makes webhook idempotent
        payment = PaymentHistory.objects.create(
            subscription=subscription,
            paystack_reference=reference,
            amount=amount,
            status='pending',
            plan_name=subscription.plan.display_name,
            billing_cycle=billing_cycle,
            metadata={
                'auto_debit': True,
                'school_id': str(subscription.school.id),
                'plan': subscription.plan.name,
            },
        )

        try:
            result = charge_authorization(
                authorization_code=subscription.paystack_authorization_code,
                email=subscription.paystack_billing_email,
                amount=amount,
                reference=reference,
                metadata={
                    'auto_debit': True,
                    'school_id': str(subscription.school.id),
                    'plan': subscription.plan.name,
                },
            )
        except Exception as e:
            logger.error(f"charge_authorization raised exception for {subscription.school.name}: {e}")
            result = {'success': False}

        if result.get('success') and result.get('data', {}).get('status') == 'success':
            # Extend subscription and reset retry state
            subscription.status = 'active'
            subscription.current_period_start = now
            subscription.current_period_end = now + timedelta(
                days=365 if billing_cycle == 'annual' else 30
            )
            subscription.last_expiry_warning_sent = ''
            subscription.auto_debit_retry_count = 0
            subscription.auto_debit_next_retry = None
            subscription.save()

            # Mark payment as successful
            payment.status = 'success'
            payment.paid_at = now
            payment.payment_method = result['data'].get('channel', 'card')
            payment.card_type = result['data'].get('card_type', '')
            payment.card_last4 = result['data'].get('last4', '')
            payment.save()

            try:
                send_insightwick_payment_confirmation(subscription, payment)
            except Exception as e:
                logger.error(f"Failed to send auto-debit confirmation for {subscription.school.name}: {e}")

            return True
        else:
            payment.status = 'failed'
            payment.save()
            return False

    def _handle_grace_period_expirations(self, now, dry_run):
        """Expire subscriptions whose grace period has fully elapsed."""
        from tenants.insightwick_emails import send_expired_lockout_email

        grace_subs = Subscription.objects.filter(
            status='grace_period'
        ).select_related('school', 'plan')

        count = 0
        for sub in grace_subs:
            grace_end = sub.get_grace_period_end()
            if grace_end and now > grace_end:
                school_name = sub.school.name
                self.stdout.write(f'  {school_name}: grace_period → expired')
                if not dry_run:
                    sub.status = 'expired'
                    sub.last_expiry_warning_sent = 'expired'
                    sub.save(update_fields=['status', 'last_expiry_warning_sent'])
                    try:
                        send_expired_lockout_email(sub)
                    except Exception as e:
                        logger.error(f"Failed to send lockout email for {school_name}: {e}")
                count += 1

        return count

    def _send_pre_expiry_warnings(self, now, dry_run):
        """Send 7-day, 3-day, and 1-day warnings for upcoming expirations.

        Auto-debit users get a "we'll charge your card" notice instead of
        the standard "please renew" warning.
        """
        from tenants.insightwick_emails import send_expiry_warning_email, send_auto_debit_warning_email

        active_subs = Subscription.objects.filter(
            status__in=['trial', 'active'],
            current_period_end__isnull=False
        ).select_related('school', 'plan')

        count = 0
        for sub in active_subs:
            days_until = (sub.current_period_end - now).total_seconds() / 86400
            school_name = sub.school.name
            last = sub.last_expiry_warning_sent

            milestone = None
            days_label = None

            if days_until <= 1 and last != 'pre_1':
                milestone = 'pre_1'
                days_label = 1
            elif days_until <= 3 and last not in ('pre_1', 'pre_3'):
                milestone = 'pre_3'
                days_label = 3
            elif days_until <= 7 and last not in ('pre_1', 'pre_3', 'pre_7'):
                milestone = 'pre_7'
                days_label = 7

            if milestone:
                email_type = 'auto-debit notice' if sub.auto_debit_enabled else f'{days_label}-day warning'
                self.stdout.write(f'  {school_name}: sending {email_type}')
                if not dry_run:
                    try:
                        if sub.auto_debit_enabled:
                            send_auto_debit_warning_email(sub, days_label)
                        else:
                            send_expiry_warning_email(sub, days_label)
                    except Exception as e:
                        logger.error(f"Failed to send expiry warning for {school_name}: {e}")
                    sub.last_expiry_warning_sent = milestone
                    sub.save(update_fields=['last_expiry_warning_sent'])
                count += 1

        return count

    def _send_grace_period_reminders(self, now, dry_run):
        """Send daily grace period reminders (days 2-5)."""
        from tenants.insightwick_emails import send_grace_period_reminder_email

        grace_subs = Subscription.objects.filter(
            status='grace_period',
            current_period_end__isnull=False
        ).select_related('school', 'plan')

        count = 0
        for sub in grace_subs:
            days_in_grace = (now - sub.current_period_end).total_seconds() / 86400
            school_name = sub.school.name
            last = sub.last_expiry_warning_sent

            milestone = None
            grace_day = None

            # Check milestones in reverse order (highest first)
            if days_in_grace >= 5 and last != 'grace_5':
                milestone = 'grace_5'
                grace_day = 5
            elif days_in_grace >= 4 and last not in ('grace_4', 'grace_5'):
                milestone = 'grace_4'
                grace_day = 4
            elif days_in_grace >= 3 and last not in ('grace_3', 'grace_4', 'grace_5'):
                milestone = 'grace_3'
                grace_day = 3
            elif days_in_grace >= 2 and last not in ('grace_2', 'grace_3', 'grace_4', 'grace_5'):
                milestone = 'grace_2'
                grace_day = 2

            if milestone:
                self.stdout.write(f'  {school_name}: sending grace day-{grace_day} reminder')
                if not dry_run:
                    try:
                        send_grace_period_reminder_email(sub, grace_day)
                    except Exception as e:
                        logger.error(f"Failed to send grace reminder for {school_name}: {e}")
                    sub.last_expiry_warning_sent = milestone
                    sub.save(update_fields=['last_expiry_warning_sent'])
                count += 1

        return count
