from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0023_add_email_otp'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailotp',
            name='sent',
            field=models.BooleanField(default=False),
        ),
    ]
