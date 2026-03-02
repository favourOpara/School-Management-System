from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0012_remove_free_plan_update_defaults'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscription',
            name='auto_debit_enabled',
            field=models.BooleanField(
                default=False,
                help_text='Whether to automatically charge saved card on renewal',
            ),
        ),
        migrations.AddField(
            model_name='subscription',
            name='paystack_billing_email',
            field=models.CharField(
                blank=True,
                help_text='Customer email on file with Paystack for charge_authorization calls',
                max_length=255,
            ),
        ),
    ]
