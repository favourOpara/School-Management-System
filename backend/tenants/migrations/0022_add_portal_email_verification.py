from django.db import migrations, models
import uuid


def mark_existing_portal_users_verified(apps, schema_editor):
    """
    Mark all existing PortalUsers as already verified so they aren't locked out.
    Only NEW registrations (after this migration) will go through email verification.
    """
    PortalUser = apps.get_model('tenants', 'PortalUser')
    PortalUser.objects.all().update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0021_add_staff_reply_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='portaluser',
            name='email_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='portaluser',
            name='email_verification_token',
            field=models.UUIDField(null=True, blank=True),
        ),
        migrations.RunPython(
            mark_existing_portal_users_verified,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
