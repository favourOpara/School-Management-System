import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0015_add_termly_trial_days'),
    ]

    operations = [
        migrations.CreateModel(
            name='OnboardingAgent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('password', models.CharField(max_length=128)),
                ('first_name', models.CharField(max_length=50)),
                ('last_name', models.CharField(max_length=50)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_login', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'Onboarding Agent',
                'verbose_name_plural': 'Onboarding Agents',
                'ordering': ['first_name', 'last_name'],
            },
        ),
        migrations.CreateModel(
            name='OnboardingRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('in_progress', 'In Progress'),
                        ('completed', 'Completed'),
                        ('skipped', 'Skipped'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('registration_type', models.CharField(blank=True, max_length=50)),
                ('students_imported', models.BooleanField(default=False)),
                ('teachers_added', models.BooleanField(default=False)),
                ('classes_setup', models.BooleanField(default=False)),
                ('subjects_setup', models.BooleanField(default=False)),
                ('parents_added', models.BooleanField(default=False)),
                ('attendance_configured', models.BooleanField(default=False)),
                ('grading_configured', models.BooleanField(default=False)),
                ('notes', models.TextField(blank=True)),
                ('assigned_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='onboarding',
                    to='tenants.school',
                )),
                ('agent', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='assigned_schools',
                    to='tenants.onboardingagent',
                )),
            ],
            options={
                'verbose_name': 'Onboarding Record',
                'verbose_name_plural': 'Onboarding Records',
                'ordering': ['-created_at'],
            },
        ),
    ]
