import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0024_emailotp_sent'),
    ]

    operations = [
        migrations.AddField(
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
