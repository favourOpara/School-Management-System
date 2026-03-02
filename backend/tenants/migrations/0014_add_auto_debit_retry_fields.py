from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0013_add_auto_debit_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscription',
            name='auto_debit_retry_count',
            field=models.IntegerField(default=0, help_text='Number of failed auto-debit attempts in the current renewal cycle'),
        ),
        migrations.AddField(
            model_name='subscription',
            name='auto_debit_next_retry',
            field=models.DateTimeField(blank=True, null=True, help_text='When to attempt the next auto-debit retry'),
        ),
    ]
