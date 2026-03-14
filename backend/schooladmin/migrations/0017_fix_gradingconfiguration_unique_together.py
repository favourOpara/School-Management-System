from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('schooladmin', '0016_lesson_topic_plan'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='gradingconfiguration',
            unique_together={('school', 'academic_year', 'term')},
        ),
    ]
