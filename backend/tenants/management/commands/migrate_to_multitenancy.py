"""
Management command to migrate existing data to multi-tenancy.
Run: python manage.py migrate_to_multitenancy

This command:
1. Creates the default school (Default School)
2. Creates a premium subscription for the default school
3. Associates all existing users with the default school
4. Associates all existing classes with the default school
5. Associates all existing grading configurations with the default school
6. Associates all existing announcements with the default school
7. Associates all existing attendance calendars with the default school
8. Associates all existing logs with the default school
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Migrate existing data to multi-tenancy structure'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without making changes',
        )
        parser.add_argument(
            '--school-name',
            type=str,
            default='My School',
            help='Name for the default school',
        )
        parser.add_argument(
            '--school-slug',
            type=str,
            default='myschool',
            help='URL slug for the default school',
        )
        parser.add_argument(
            '--school-email',
            type=str,
            default='admin@myschool.com',
            help='Email for the default school',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        school_name = options['school_name']
        school_slug = options['school_slug']
        school_email = options['school_email']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))

        self.stdout.write('Starting multi-tenancy migration...\n')

        try:
            with transaction.atomic():
                # Step 1: Create default school
                school = self._create_default_school(
                    school_name, school_slug, school_email, dry_run
                )

                if not school and not dry_run:
                    self.stdout.write(self.style.ERROR('Failed to create default school'))
                    return

                # Step 2: Create subscription for default school
                self._create_default_subscription(school, dry_run)

                # Step 3: Migrate users
                self._migrate_users(school, dry_run)

                # Step 4: Migrate classes
                self._migrate_classes(school, dry_run)

                # Step 5: Migrate fee structures
                self._migrate_fee_structures(school, dry_run)

                # Step 6: Migrate grading scales and configurations
                self._migrate_grading(school, dry_run)

                # Step 7: Migrate announcements
                self._migrate_announcements(school, dry_run)

                # Step 8: Migrate attendance calendars
                self._migrate_attendance(school, dry_run)

                # Step 9: Migrate activity logs
                self._migrate_logs(school, dry_run)

                if dry_run:
                    self.stdout.write(
                        self.style.WARNING('\nDRY RUN complete. No changes were made.')
                    )
                    raise Exception('Dry run - rolling back')

        except Exception as e:
            if 'Dry run' in str(e):
                pass
            else:
                self.stdout.write(self.style.ERROR(f'Error: {e}'))
                raise

        self.stdout.write(self.style.SUCCESS('\nMigration complete!'))

    def _create_default_school(self, name, slug, email, dry_run):
        from tenants.models import School

        if dry_run:
            self.stdout.write(f'Would create school: {name} ({slug})')
            return None

        school, created = School.objects.get_or_create(
            slug=slug,
            defaults={
                'name': name,
                'email': email,
                'is_active': True,
                'is_verified': True,
            }
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'Created school: {school.name}'))
        else:
            self.stdout.write(f'School already exists: {school.name}')

        return school

    def _create_default_subscription(self, school, dry_run):
        from tenants.models import SubscriptionPlan, Subscription

        if dry_run:
            self.stdout.write('Would create premium subscription for default school')
            return

        # Get premium plan (or create basic one if not exists)
        premium_plan = SubscriptionPlan.objects.filter(name='premium').first()

        if not premium_plan:
            self.stdout.write(
                self.style.WARNING('Premium plan not found. Run setup_subscription_plans first.')
            )
            return

        subscription, created = Subscription.objects.get_or_create(
            school=school,
            defaults={
                'plan': premium_plan,
                'status': 'active',
                'billing_cycle': 'annual',
                'current_period_start': timezone.now(),
                'current_period_end': timezone.now() + timedelta(days=365),
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created subscription: {subscription}')
            )
        else:
            self.stdout.write(f'Subscription already exists: {subscription}')

    def _migrate_users(self, school, dry_run):
        from users.models import CustomUser

        users_without_school = CustomUser.objects.filter(school__isnull=True)
        count = users_without_school.count()

        if dry_run:
            self.stdout.write(f'Would migrate {count} users to default school')
            return

        if count > 0:
            users_without_school.update(school=school)
            self.stdout.write(self.style.SUCCESS(f'Migrated {count} users'))
        else:
            self.stdout.write('No users to migrate')

    def _migrate_classes(self, school, dry_run):
        from academics.models import Class

        classes_without_school = Class.objects.filter(school__isnull=True)
        count = classes_without_school.count()

        if dry_run:
            self.stdout.write(f'Would migrate {count} classes to default school')
            return

        if count > 0:
            classes_without_school.update(school=school)
            self.stdout.write(self.style.SUCCESS(f'Migrated {count} classes'))
        else:
            self.stdout.write('No classes to migrate')

    def _migrate_fee_structures(self, school, dry_run):
        from schooladmin.models import FeeStructure

        fees_without_school = FeeStructure.objects.filter(school__isnull=True)
        count = fees_without_school.count()

        if dry_run:
            self.stdout.write(f'Would migrate {count} fee structures to default school')
            return

        if count > 0:
            fees_without_school.update(school=school)
            self.stdout.write(self.style.SUCCESS(f'Migrated {count} fee structures'))
        else:
            self.stdout.write('No fee structures to migrate')

    def _migrate_grading(self, school, dry_run):
        from schooladmin.models import GradingScale, GradingConfiguration

        # Migrate grading scales
        scales_without_school = GradingScale.objects.filter(school__isnull=True)
        scale_count = scales_without_school.count()

        # Migrate grading configurations
        configs_without_school = GradingConfiguration.objects.filter(school__isnull=True)
        config_count = configs_without_school.count()

        if dry_run:
            self.stdout.write(f'Would migrate {scale_count} grading scales')
            self.stdout.write(f'Would migrate {config_count} grading configurations')
            return

        if scale_count > 0:
            scales_without_school.update(school=school)
            self.stdout.write(self.style.SUCCESS(f'Migrated {scale_count} grading scales'))

        if config_count > 0:
            configs_without_school.update(school=school)
            self.stdout.write(
                self.style.SUCCESS(f'Migrated {config_count} grading configurations')
            )

    def _migrate_announcements(self, school, dry_run):
        from schooladmin.models import Announcement

        announcements_without_school = Announcement.objects.filter(school__isnull=True)
        count = announcements_without_school.count()

        if dry_run:
            self.stdout.write(f'Would migrate {count} announcements to default school')
            return

        if count > 0:
            announcements_without_school.update(school=school)
            self.stdout.write(self.style.SUCCESS(f'Migrated {count} announcements'))
        else:
            self.stdout.write('No announcements to migrate')

    def _migrate_attendance(self, school, dry_run):
        from attendance.models import AttendanceCalendar

        calendars_without_school = AttendanceCalendar.objects.filter(school__isnull=True)
        count = calendars_without_school.count()

        if dry_run:
            self.stdout.write(f'Would migrate {count} attendance calendars to default school')
            return

        if count > 0:
            calendars_without_school.update(school=school)
            self.stdout.write(
                self.style.SUCCESS(f'Migrated {count} attendance calendars')
            )
        else:
            self.stdout.write('No attendance calendars to migrate')

    def _migrate_logs(self, school, dry_run):
        from logs.models import ActivityLog, Notification

        # Migrate activity logs
        logs_without_school = ActivityLog.objects.filter(school__isnull=True)
        log_count = logs_without_school.count()

        # Migrate notifications
        notifications_without_school = Notification.objects.filter(school__isnull=True)
        notification_count = notifications_without_school.count()

        if dry_run:
            self.stdout.write(f'Would migrate {log_count} activity logs')
            self.stdout.write(f'Would migrate {notification_count} notifications')
            return

        if log_count > 0:
            logs_without_school.update(school=school)
            self.stdout.write(self.style.SUCCESS(f'Migrated {log_count} activity logs'))

        if notification_count > 0:
            notifications_without_school.update(school=school)
            self.stdout.write(
                self.style.SUCCESS(f'Migrated {notification_count} notifications')
            )
