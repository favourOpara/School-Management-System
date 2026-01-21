"""
Management command to create initial subscription plans.
Run: python manage.py setup_subscription_plans
"""
from django.core.management.base import BaseCommand
from tenants.models import SubscriptionPlan


class Command(BaseCommand):
    help = 'Create initial subscription plans'

    def handle(self, *args, **options):
        plans = [
            {
                'name': 'free',
                'display_name': 'Free Trial',
                'description': 'Try all features free for 30 days',
                'monthly_price': 0,
                'annual_price': 0,
                'max_admin_accounts': 1,
                'max_daily_emails': 300,
                'has_import_feature': False,
                'trial_days': 30,
                'is_active': True,
                'is_public': True,
                'display_order': 0,
            },
            {
                'name': 'basic',
                'display_name': 'Basic',
                'description': 'For small schools getting started',
                'monthly_price': 1500000,  # 15,000 NGN
                'annual_price': 15000000,  # 150,000 NGN (2 months free)
                'max_admin_accounts': 1,
                'max_daily_emails': 300,
                'has_import_feature': False,
                'trial_days': 0,
                'is_active': True,
                'is_public': True,
                'display_order': 1,
            },
            {
                'name': 'standard',
                'display_name': 'Standard',
                'description': 'For growing schools with multiple admins',
                'monthly_price': 3000000,  # 30,000 NGN
                'annual_price': 30000000,  # 300,000 NGN (2 months free)
                'max_admin_accounts': 4,
                'max_daily_emails': 1000,
                'has_import_feature': False,
                'trial_days': 0,
                'is_active': True,
                'is_public': True,
                'display_order': 2,
            },
            {
                'name': 'premium',
                'display_name': 'Premium',
                'description': 'For large schools with full features',
                'monthly_price': 5000000,  # 50,000 NGN
                'annual_price': 50000000,  # 500,000 NGN (2 months free)
                'max_admin_accounts': 6,
                'max_daily_emails': 0,  # Unlimited
                'has_import_feature': True,
                'trial_days': 0,
                'is_active': True,
                'is_public': True,
                'display_order': 3,
            },
            {
                'name': 'custom',
                'display_name': 'Custom',
                'description': 'Enterprise solution with custom features',
                'monthly_price': 0,  # Contact sales
                'annual_price': 0,
                'max_admin_accounts': 999,  # Effectively unlimited
                'max_daily_emails': 0,  # Unlimited
                'has_import_feature': True,
                'trial_days': 0,
                'is_active': True,
                'is_public': False,  # Not shown on public pricing page
                'display_order': 4,
            },
        ]

        created_count = 0
        updated_count = 0

        for plan_data in plans:
            plan, created = SubscriptionPlan.objects.update_or_create(
                name=plan_data['name'],
                defaults=plan_data
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created plan: {plan.display_name}')
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'Updated plan: {plan.display_name}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone! Created {created_count} plans, updated {updated_count} plans.'
            )
        )
