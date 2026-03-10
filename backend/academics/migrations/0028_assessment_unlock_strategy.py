from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0027_populate_class_progression'),
    ]

    operations = [
        migrations.AddField(
            model_name='assessment',
            name='unlock_strategy',
            field=models.CharField(
                blank=True,
                choices=[
                    ('paid', 'Paid Fees'),
                    ('attendance', 'Attendance Today'),
                    ('both', 'Paid + Present Today'),
                ],
                max_length=20,
                help_text='Strategy used when unlocking access for this assessment',
            ),
        ),
    ]
