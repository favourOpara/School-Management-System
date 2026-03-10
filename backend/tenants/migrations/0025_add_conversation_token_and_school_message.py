import uuid
from django.db import migrations, models
import django.db.models.deletion


def populate_conversation_tokens(apps, schema_editor):
    OnboardingRecord = apps.get_model('tenants', 'OnboardingRecord')
    for record in OnboardingRecord.objects.all():
        record.conversation_token = uuid.uuid4()
        record.save(update_fields=['conversation_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0024_emailotp_sent'),
    ]

    operations = [
        # Step 1: Add as nullable (no unique yet) so existing rows get null
        migrations.AddField(
            model_name='onboardingrecord',
            name='conversation_token',
            field=models.UUIDField(null=True, editable=False),
        ),
        # Step 2: Populate a unique UUID for every existing row
        migrations.RunPython(populate_conversation_tokens, migrations.RunPython.noop),
        # Step 3: Make it non-null and unique
        migrations.AlterField(
            model_name='onboardingrecord',
            name='conversation_token',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.CreateModel(
            name='SchoolMessage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sender_name', models.CharField(max_length=255)),
                ('sender_email', models.EmailField(blank=True)),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_read', models.BooleanField(default=False)),
                ('onboarding_record', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='school_messages',
                    to='tenants.onboardingrecord',
                )),
            ],
            options={
                'verbose_name': 'School Message',
                'verbose_name_plural': 'School Messages',
                'ordering': ['created_at'],
            },
        ),
    ]
