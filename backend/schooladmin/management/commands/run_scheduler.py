"""
Django management command to run the APScheduler for automated backups
This should be run as a background process on Railway

Usage:
    python manage.py run_scheduler
"""

import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
from django_apscheduler import util
from django.core.management import call_command

logger = logging.getLogger(__name__)


def send_scheduled_backup():
    """
    Job function to send automated database backups
    This will be called every BACKUP_INTERVAL_DAYS
    """
    try:
        backup_email = settings.BACKUP_EMAIL
        logger.info(f"Starting scheduled backup to {backup_email}...")

        # Call the backup_database command with email parameter
        call_command('backup_database', email=backup_email)

        logger.info(f"Scheduled backup completed and sent to {backup_email}")
    except Exception as e:
        logger.error(f"Error in scheduled backup: {str(e)}")


@util.close_old_connections
def delete_old_job_executions(max_age=604_800):
    """
    Delete APScheduler job execution logs older than max_age (default 7 days)
    Helps prevent database from filling up with old execution logs
    """
    DjangoJobExecution.objects.delete_old_job_executions(max_age)


class Command(BaseCommand):
    help = 'Runs APScheduler to handle automated database backups'

    def handle(self, *args, **options):
        scheduler = BlockingScheduler(timezone='UTC')
        scheduler.add_jobstore(DjangoJobStore(), "default")

        # Get backup interval from settings (default 5 days)
        backup_interval_days = getattr(settings, 'BACKUP_INTERVAL_DAYS', 5)

        # Add the scheduled backup job
        scheduler.add_job(
            send_scheduled_backup,
            trigger=IntervalTrigger(days=backup_interval_days),
            id='scheduled_database_backup',
            name='Send database backup every {} days'.format(backup_interval_days),
            replace_existing=True,
            max_instances=1,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'Added job: Send database backup every {backup_interval_days} days to {settings.BACKUP_EMAIL}'
            )
        )

        # Add job to delete old job executions (runs daily)
        scheduler.add_job(
            delete_old_job_executions,
            trigger=IntervalTrigger(days=1),
            id='delete_old_job_executions',
            name='Delete old APScheduler job executions',
            replace_existing=True,
            max_instances=1,
        )
        self.stdout.write(self.style.SUCCESS('Added job: Delete old job executions (daily)'))

        try:
            self.stdout.write(self.style.SUCCESS('Starting scheduler...'))
            self.stdout.write(self.style.WARNING('Press Ctrl+C to exit'))
            scheduler.start()
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('Stopping scheduler...'))
            scheduler.shutdown()
            self.stdout.write(self.style.SUCCESS('Scheduler shut down successfully!'))
