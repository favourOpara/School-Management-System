import uuid
from django.db import migrations, models


def populate_scheduling_tokens(apps, schema_editor):
    OnboardingRecord = apps.get_model('tenants', 'OnboardingRecord')
    for record in OnboardingRecord.objects.all():
        record.scheduling_token = uuid.uuid4()
        record.save(update_fields=['scheduling_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0025_add_conversation_token_and_school_message'),
    ]

    operations = [
        # scheduling_token — same two-step pattern as conversation_token
        migrations.AddField(
            model_name='onboardingrecord',
            name='scheduling_token',
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(populate_scheduling_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='onboardingrecord',
            name='scheduling_token',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),

        # preferred_slots — JSON list of {"date", "time", "note"} dicts
        migrations.AddField(
            model_name='onboardingrecord',
            name='preferred_slots',
            field=models.JSONField(default=list, blank=True),
        ),

        # scheduling_submitted_at — set when the school submits their availability
        migrations.AddField(
            model_name='onboardingrecord',
            name='scheduling_submitted_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
