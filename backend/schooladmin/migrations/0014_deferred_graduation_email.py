from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('schooladmin', '0013_alter_announcement_created_by_and_more'),
        ('tenants', '0019_create_support_ticket_model'),
        ('users', '0012_customuser_graduation_date_customuser_is_graduated'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DeferredGraduationEmail',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email_type', models.CharField(
                    choices=[
                        ('student', 'Student Graduation Email'),
                        ('parent_per_child', 'Parent — Per Graduating Child'),
                        ('parent_all_graduated', 'Parent — All Children Graduated'),
                    ],
                    max_length=30
                )),
                ('deactivation_date', models.DateTimeField()),
                ('login_url', models.CharField(max_length=500)),
                ('is_sent', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('school', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='deferred_graduation_emails',
                    to='tenants.school'
                )),
                ('recipient', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='deferred_graduation_emails',
                    to=settings.AUTH_USER_MODEL
                )),
                ('student', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='graduation_emails_as_graduant',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
