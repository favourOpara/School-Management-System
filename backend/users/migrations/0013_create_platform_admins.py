from django.db import migrations
from django.contrib.auth.hashers import make_password


PLATFORM_ADMINS = [
    {
        "username": "platform_admin1",
        "email": "admin1@insightwick.com",
        "first_name": "Platform",
        "last_name": "Admin",
        "password": "InsightWick@Plt#2026!",
    },
    {
        "username": "platform_admin2",
        "email": "admin2@insightwick.com",
        "first_name": "Operations",
        "last_name": "Lead",
        "password": "OpsLead@Plt#2026!",
    },
    {
        "username": "platform_admin3",
        "email": "admin3@insightwick.com",
        "first_name": "Support",
        "last_name": "Manager",
        "password": "SptMgr@Plt#2026!",
    },
]


def create_platform_admins(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    for acc in PLATFORM_ADMINS:
        if not CustomUser.objects.filter(username=acc['username']).exists():
            CustomUser.objects.create(
                username=acc['username'],
                email=acc['email'],
                first_name=acc['first_name'],
                last_name=acc['last_name'],
                password=make_password(acc['password']),
                role='admin',
                is_staff=True,
                is_superuser=True,
                is_active=True,
                school=None,
            )


def reverse_create_platform_admins(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    usernames = [acc['username'] for acc in PLATFORM_ADMINS]
    CustomUser.objects.filter(username__in=usernames, is_superuser=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0012_customuser_graduation_date_customuser_is_graduated'),
    ]

    operations = [
        migrations.RunPython(
            create_platform_admins,
            reverse_create_platform_admins,
        ),
    ]
