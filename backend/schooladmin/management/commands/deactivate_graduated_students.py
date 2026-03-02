"""
Django management command to deactivate student accounts after the 30-day graduation grace period.

Run automatically via APScheduler (daily). Can also be run manually:
    python manage.py deactivate_graduated_students
"""

import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from django.db.models import Max

logger = logging.getLogger(__name__)

STUDENT_GRACE_DAYS = 30
PARENT_GRACE_DAYS = 90


class Command(BaseCommand):
    help = (
        'Deactivates graduated student accounts past the 30-day grace period, '
        'and parent accounts whose all children graduated more than 90 days ago.'
    )

    def handle(self, *args, **options):
        from users.models import CustomUser

        now = timezone.now()

        # ── Students ────────────────────────────────────────────────────────
        student_cutoff = now - timedelta(days=STUDENT_GRACE_DAYS)
        students_qs = CustomUser.objects.filter(
            role='student',
            is_graduated=True,
            is_active=True,
            graduation_date__lte=student_cutoff
        )
        student_count = students_qs.count()
        if student_count:
            students_qs.update(is_active=False)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Deactivated {student_count} graduated student account(s) '
                    f'past the {STUDENT_GRACE_DAYS}-day grace period.'
                )
            )
            logger.info(
                f'deactivate_graduated_students: deactivated {student_count} student account(s) '
                f'with graduation_date <= {student_cutoff}'
            )
        else:
            self.stdout.write('No graduated students past the grace period to deactivate.')
            logger.info('deactivate_graduated_students: no student accounts to deactivate')

        # ── Parents ─────────────────────────────────────────────────────────
        parent_cutoff = now - timedelta(days=PARENT_GRACE_DAYS)

        # Find parents who are still active, have at least one child,
        # all children are graduated, and the most recent graduation is past the cutoff.
        parents_to_deactivate = []
        active_parents = CustomUser.objects.filter(role='parent', is_active=True)

        for parent in active_parents:
            children = parent.children.all()
            if not children.exists():
                continue  # No linked children — do not deactivate

            # Consistent with views.py: only active, non-graduated children block deactivation.
            # Dropped-out / manually-deactivated children (is_active=False, is_graduated=False)
            # are treated as "no longer enrolled" and do not block the parent's deactivation.
            if children.filter(is_graduated=False, is_active=True).exists():
                continue  # Still has active non-graduated children

            # All active children are graduated. Use only graduated children for the date check
            # (dropped-out children have graduation_date=None and should not influence the cutoff).
            graduated_children = children.filter(is_graduated=True)
            if not graduated_children.exists():
                continue  # No graduated children at all (e.g. all dropped out) — do not deactivate

            last_grad = graduated_children.aggregate(last=Max('graduation_date'))['last']
            if last_grad and last_grad <= parent_cutoff:
                parents_to_deactivate.append(parent.id)

        parent_count = len(parents_to_deactivate)
        if parent_count:
            CustomUser.objects.filter(id__in=parents_to_deactivate).update(is_active=False)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Deactivated {parent_count} parent account(s) whose all children graduated '
                    f'more than {PARENT_GRACE_DAYS} days ago.'
                )
            )
            logger.info(
                f'deactivate_graduated_students: deactivated {parent_count} parent account(s) '
                f'with all children graduation_date <= {parent_cutoff}'
            )
        else:
            self.stdout.write('No parent accounts past the 90-day grace period to deactivate.')
            logger.info('deactivate_graduated_students: no parent accounts to deactivate')
