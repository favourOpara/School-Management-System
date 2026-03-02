"""
Management command to migrate existing Free Trial schools to the Basic plan.

Run after updating setup_subscription_plans to remove the 'free' plan:
    python manage.py migrate_free_trial_schools
    python manage.py migrate_free_trial_schools --dry-run
"""
from django.core.management.base import BaseCommand
from tenants.models import Subscription, SubscriptionPlan


class Command(BaseCommand):
    help = 'Migrate schools on the Free Trial plan to Basic plan'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without executing'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be made'))

        # Find the free plan
        try:
            free_plan = SubscriptionPlan.objects.get(name='free')
        except SubscriptionPlan.DoesNotExist:
            self.stdout.write(self.style.SUCCESS('No free plan found. Nothing to migrate.'))
            return

        # Find the basic plan
        try:
            basic_plan = SubscriptionPlan.objects.get(name='basic')
        except SubscriptionPlan.DoesNotExist:
            self.stdout.write(self.style.ERROR('Basic plan not found. Run setup_subscription_plans first.'))
            return

        # Find all subscriptions on the free plan
        free_subs = Subscription.objects.filter(plan=free_plan).select_related('school')
        count = free_subs.count()

        if count == 0:
            self.stdout.write('No schools on the free plan.')
        else:
            self.stdout.write(f'Found {count} school(s) on the free plan:')
            for sub in free_subs:
                self.stdout.write(f'  {sub.school.name} (status: {sub.status})')
                if not dry_run:
                    sub.plan = basic_plan
                    sub.save(update_fields=['plan'])

            if not dry_run:
                self.stdout.write(self.style.SUCCESS(f'Migrated {count} school(s) to Basic plan.'))

        # Deactivate the free plan
        if not dry_run:
            free_plan.is_active = False
            free_plan.is_public = False
            free_plan.save(update_fields=['is_active', 'is_public'])
            self.stdout.write(self.style.SUCCESS('Free plan deactivated.'))
        else:
            self.stdout.write(f'Would deactivate the free plan.')

        self.stdout.write(self.style.SUCCESS('Done.'))
