import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0020_add_lesson_note_weeks_per_term'),
    ]

    operations = [
        migrations.CreateModel(
            name='StaffReply',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sent_by_admin', models.BooleanField(default=False)),
                ('sender_name', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('recipient_email', models.EmailField()),
                ('recipient_name', models.CharField(blank=True, max_length=255)),
                ('email_sent', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact_inquiry', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='replies', to='tenants.contactinquiry',
                )),
                ('onboarding_record', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='replies', to='tenants.onboardingrecord',
                )),
                ('sent_by_agent', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sent_replies', to='tenants.onboardingagent',
                )),
                ('support_ticket', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='replies', to='tenants.supportticket',
                )),
            ],
            options={
                'verbose_name': 'Staff Reply',
                'verbose_name_plural': 'Staff Replies',
                'ordering': ['created_at'],
            },
        ),
    ]
