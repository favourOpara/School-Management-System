from django.db import migrations
import uuid


PLANS = [
    {
        'id': uuid.UUID('00000000-0000-0000-0000-000000000001'),
        'name': 'basic',
        'display_name': 'Basic',
        'description': 'For small schools getting started',
        'monthly_price': 2000000,    # ₦20,000 in kobo
        'annual_price': 20000000,    # ₦200,000 in kobo
        'max_admin_accounts': 2,
        'max_daily_emails': 300,
        'has_import_feature': False,
        'has_staff_management': False,
        'max_import_rows': 0,
        'max_students': 300,
        'max_teachers': 20,
        'max_principals': 2,
        'max_parents': 300,
        'max_proprietors': 0,
        'trial_days': 30,
        'termly_trial_days': 120,
        'grace_period_days': 5,
        'is_active': True,
        'is_public': True,
        'display_order': 1,
    },
    {
        'id': uuid.UUID('00000000-0000-0000-0000-000000000002'),
        'name': 'standard',
        'display_name': 'Standard',
        'description': 'Most popular for growing schools',
        'monthly_price': 4000000,    # ₦40,000 in kobo
        'annual_price': 40000000,    # ₦400,000 in kobo
        'max_admin_accounts': 4,
        'max_daily_emails': 700,
        'has_import_feature': True,
        'has_staff_management': False,
        'max_import_rows': 100,
        'max_students': 700,
        'max_teachers': 70,
        'max_principals': 4,
        'max_parents': 700,
        'max_proprietors': 1,
        'trial_days': 30,
        'termly_trial_days': 120,
        'grace_period_days': 5,
        'is_active': True,
        'is_public': True,
        'display_order': 2,
    },
    {
        'id': uuid.UUID('00000000-0000-0000-0000-000000000003'),
        'name': 'premium',
        'display_name': 'Premium',
        'description': 'For large institutions',
        'monthly_price': 7500000,    # ₦75,000 in kobo
        'annual_price': 75000000,    # ₦750,000 in kobo
        'max_admin_accounts': 7,
        'max_daily_emails': 2000,
        'has_import_feature': True,
        'has_staff_management': True,
        'max_import_rows': 500,
        'max_students': 1000,
        'max_teachers': 150,
        'max_principals': 7,
        'max_parents': 1000,
        'max_proprietors': 2,
        'trial_days': 30,
        'termly_trial_days': 120,
        'grace_period_days': 5,
        'is_active': True,
        'is_public': True,
        'display_order': 3,
    },
]


def seed_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model('tenants', 'SubscriptionPlan')
    for plan in PLANS:
        SubscriptionPlan.objects.get_or_create(
            name=plan['name'],
            defaults={k: v for k, v in plan.items() if k != 'name'},
        )


def unseed_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model('tenants', 'SubscriptionPlan')
    SubscriptionPlan.objects.filter(name__in=[p['name'] for p in PLANS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0026_add_onboarding_scheduling_fields'),
    ]

    operations = [
        migrations.RunPython(seed_plans, unseed_plans),
    ]
