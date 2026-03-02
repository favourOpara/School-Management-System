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
                'name': 'basic',
                'display_name': 'Basic',
                'description': 'For small schools getting started',
                'monthly_price': 2000000,  # 20,000 NGN
                'annual_price': 20000000,  # 200,000 NGN (2 months free)
                'max_admin_accounts': 2,
                'max_daily_emails': 300,
                'max_students': 300,
                'max_parents': 300,
                'max_teachers': 20,
                'max_principals': 2,
                'max_proprietors': 0,
                'has_import_feature': False,
                'has_staff_management': False,
                'max_import_rows': 0,
                'trial_days': 30,
                'grace_period_days': 5,
                'is_active': True,
                'is_public': True,
                'display_order': 0,
            },
            {
                'name': 'standard',
                'display_name': 'Standard',
                'description': 'For growing schools with multiple admins',
                'monthly_price': 4000000,  # 40,000 NGN
                'annual_price': 40000000,  # 400,000 NGN
                'max_admin_accounts': 4,
                'max_daily_emails': 700,
                'max_students': 700,
                'max_parents': 700,
                'max_teachers': 70,
                'max_principals': 4,
                'max_proprietors': 1,
                'has_import_feature': True,
                'has_staff_management': False,
                'max_import_rows': 100,
                'trial_days': 30,
                'grace_period_days': 5,
                'is_active': True,
                'is_public': True,
                'display_order': 1,
            },
            {
                'name': 'premium',
                'display_name': 'Premium',
                'description': 'For large institutions with full features',
                'monthly_price': 7500000,  # 75,000 NGN
                'annual_price': 75000000,  # 750,000 NGN
                'max_admin_accounts': 7,
                'max_daily_emails': 2000,
                'max_students': 1000,
                'max_parents': 1000,
                'max_teachers': 150,
                'max_principals': 7,
                'max_proprietors': 2,
                'has_import_feature': True,
                'has_staff_management': True,
                'max_import_rows': 500,
                'trial_days': 30,
                'grace_period_days': 5,
                'is_active': True,
                'is_public': True,
                'display_order': 2,
            },
            {
                'name': 'custom',
                'display_name': 'Custom',
                'description': 'Enterprise solution with custom features',
                'monthly_price': 0,  # Contact sales
                'annual_price': 0,
                'max_admin_accounts': 999,  # Effectively unlimited
                'max_daily_emails': 0,  # Unlimited
                'max_proprietors': 999,
                'has_import_feature': True,
                'has_staff_management': True,
                'trial_days': 0,
                'grace_period_days': 10,
                'is_active': True,
                'is_public': False,  # Not shown on public pricing page
                'display_order': 3,
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
