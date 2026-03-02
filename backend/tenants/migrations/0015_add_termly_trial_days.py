from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0014_add_auto_debit_retry_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionplan',
            name='termly_trial_days',
            field=models.IntegerField(
                default=120,
                validators=[MinValueValidator(0)],
                help_text='Number of trial days for the termly free trial (approx. one full school term)',
            ),
        ),
    ]
