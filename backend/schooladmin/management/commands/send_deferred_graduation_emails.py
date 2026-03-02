"""
Django management command to send deferred graduation emails.

When a school's daily email quota couldn't cover all graduation emails at the time
of session transition, the remaining emails are stored as DeferredGraduationEmail
records. This command processes those records once the quota has reset (next day).

Run automatically via APScheduler (daily). Can also be run manually:
    python manage.py send_deferred_graduation_emails
"""

import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sends deferred graduation emails that could not be sent due to daily quota limits.'

    def handle(self, *args, **options):
        from schooladmin.models import DeferredGraduationEmail
        from logs.email_service import (
            send_graduation_email_student,
            send_graduation_email_parent,
            send_parent_all_children_graduated_email,
        )
        from logs.models import Notification

        pending = DeferredGraduationEmail.objects.filter(is_sent=False).select_related(
            'school', 'recipient', 'student', 'school__subscription', 'school__subscription__plan'
        ).order_by('school_id', 'created_at')

        if not pending.exists():
            self.stdout.write('No deferred graduation emails to send.')
            logger.info('send_deferred_graduation_emails: nothing pending')
            return

        sent_total = 0
        still_deferred_total = 0

        # Group by school so we respect per-school quota
        from itertools import groupby
        for school, school_emails_iter in groupby(pending, key=lambda e: e.school):
            subscription = getattr(school, 'subscription', None)
            plan = getattr(subscription, 'plan', None)
            max_daily = getattr(plan, 'max_daily_emails', 0) if plan else 0
            is_unlimited = (max_daily == 0)

            if not is_unlimited and subscription:
                # Reset counter if it's a new day
                today = timezone.now().date()
                if subscription.email_counter_reset_date < today:
                    subscription.emails_sent_today = 0
                    subscription.email_counter_reset_date = today
                    subscription.save(update_fields=['emails_sent_today', 'email_counter_reset_date'])
                quota_left = max_daily - subscription.emails_sent_today
            else:
                quota_left = -1  # unlimited

            school_sent = 0
            school_still_deferred = 0

            for deferred in school_emails_iter:
                if not is_unlimited and quota_left <= 0:
                    school_still_deferred += 1
                    continue

                try:
                    email_type = deferred.email_type
                    recipient = deferred.recipient
                    student = deferred.student
                    deactivation_date = deferred.deactivation_date
                    login_url = deferred.login_url

                    if email_type == DeferredGraduationEmail.EMAIL_TYPE_STUDENT:
                        send_graduation_email_student(recipient, deactivation_date, login_url)
                    elif email_type == DeferredGraduationEmail.EMAIL_TYPE_PARENT_PER_CHILD:
                        if student:
                            send_graduation_email_parent(recipient, student, deactivation_date, login_url)
                    elif email_type == DeferredGraduationEmail.EMAIL_TYPE_PARENT_ALL_GRADUATED:
                        send_parent_all_children_graduated_email(recipient, deactivation_date, login_url)

                    deferred.is_sent = True
                    deferred.sent_at = timezone.now()
                    deferred.save(update_fields=['is_sent', 'sent_at'])
                    school_sent += 1

                    if not is_unlimited:
                        quota_left -= 1
                        if subscription:
                            subscription.increment_email_count()

                except Exception as exc:
                    logger.error(
                        f'send_deferred_graduation_emails: failed for deferred id={deferred.id} '
                        f'recipient={deferred.recipient_id}: {exc}'
                    )

            sent_total += school_sent
            still_deferred_total += school_still_deferred

            # Notify this school's admins about the deferred email batch result
            if school_sent > 0:
                if school_still_deferred > 0:
                    title = 'Queued Graduation Emails — Partially Sent'
                    message = (
                        f'{school_sent} queued graduation email{" was" if school_sent == 1 else "s were"} '
                        f'sent today. {school_still_deferred} email{" is" if school_still_deferred == 1 else "s are"} '
                        f'still queued and will be sent automatically tomorrow when your quota resets.'
                    )
                else:
                    title = 'Queued Graduation Emails — All Sent'
                    message = (
                        f'All {school_sent} queued graduation email{" has" if school_sent == 1 else "s have"} '
                        f'now been delivered. No graduation emails remain in the queue.'
                    )

                for admin_user in school.users.filter(role='admin', is_active=True):
                    Notification.objects.create(
                        recipient=admin_user,
                        school=school,
                        notification_type='system',
                        priority='normal',
                        title=title,
                        message=message,
                        is_read=False,
                        is_popup_shown=False,
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f'Deferred graduation emails: {sent_total} sent, {still_deferred_total} still queued (quota).'
            )
        )
        logger.info(
            f'send_deferred_graduation_emails: sent={sent_total}, still_deferred={still_deferred_total}'
        )
