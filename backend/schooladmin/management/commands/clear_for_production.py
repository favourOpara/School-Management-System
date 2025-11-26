"""
Django management command to clear database for production deployment
Removes all test/demo data while keeping essential structure

Usage:
    python manage.py clear_for_production --preview  # See what will be deleted
    python manage.py clear_for_production            # Actually delete (requires confirmation)
    python manage.py clear_for_production --keep-admins  # Keep admin accounts
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.apps import apps
from datetime import datetime
import os


class Command(BaseCommand):
    help = 'Clear database for production deployment (removes all test/demo data)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--preview',
            action='store_true',
            help='Preview what will be deleted without actually deleting',
        )
        parser.add_argument(
            '--keep-admins',
            action='store_true',
            help='Keep admin accounts (recommended)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompts',
        )

    def handle(self, *args, **options):
        is_preview = options['preview']
        keep_admins = options.get('keep_admins', True)  # Default to keeping admins
        force = options['force']

        self.stdout.write(self.style.WARNING('=' * 70))
        if is_preview:
            self.stdout.write(self.style.WARNING('DATABASE CLEAR - PREVIEW MODE'))
        else:
            self.stdout.write(self.style.ERROR('DATABASE CLEAR - PRODUCTION MODE'))
        self.stdout.write(self.style.WARNING('=' * 70))

        # Get counts before deletion
        deletion_plan = self.get_deletion_plan(keep_admins)

        # Show what will be kept
        self.show_what_will_be_kept()

        # Show what will be deleted
        self.show_deletion_plan(deletion_plan)

        if is_preview:
            self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
            self.stdout.write(self.style.SUCCESS('PREVIEW COMPLETE - No data was deleted'))
            self.stdout.write(self.style.SUCCESS('=' * 70))
            self.stdout.write('\nTo actually clear the database, run:')
            self.stdout.write(self.style.WARNING('  python manage.py clear_for_production'))
            return

        # Confirmation
        if not force:
            self.stdout.write(self.style.ERROR('\n⚠️  WARNING: This will PERMANENTLY delete all the data shown above!'))
            self.stdout.write(self.style.WARNING('\nMake sure you have a backup before proceeding.'))
            self.stdout.write(f'\nBackup location: /Users/newuser/Downloads/School-Management-System/backups/')

            confirmation = input('\nType "DELETE ALL DATA" to confirm: ')
            if confirmation != "DELETE ALL DATA":
                self.stdout.write(self.style.ERROR('\n✗ Deletion cancelled.'))
                return

        # Execute deletion
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
        self.stdout.write(self.style.SUCCESS('STARTING DATABASE CLEAR...'))
        self.stdout.write(self.style.SUCCESS('=' * 70 + '\n'))

        deleted_counts = self.execute_deletion(deletion_plan, keep_admins)

        # Show summary
        self.show_deletion_summary(deleted_counts)

    def get_deletion_plan(self, keep_admins):
        """Calculate what will be deleted"""
        from users.models import CustomUser
        from academics.models import (
            Class, ClassSession, Subject, Topic, StudentSession,
            SubjectContent, ContentFile, StudentContentView,
            AssignmentSubmission, SubmissionFile,
            Assessment, Question, QuestionOption, MatchingPair,
            AssessmentSubmission, StudentAnswer
        )
        from schooladmin.models import (
            FeeStructure, StudentFeeRecord, FeePaymentHistory, FeeReceipt,
            GradingScale, GradingConfiguration, GradeComponent,
            StudentGrade, AttendanceRecord, GradeSummary,
            ConfigurationTemplate, Announcement
        )
        from attendance.models import (
            SessionCalendar, AttendanceCalendar, SchoolDay, HolidayLabel,
            AttendanceSchoolDay, AttendanceHolidayLabel
        )
        from logs.models import ActivityLog, Notification, NotificationStatus, NotificationPreference

        plan = {}

        # Users
        if keep_admins:
            plan['Students'] = CustomUser.objects.filter(role='student').count()
            plan['Teachers'] = CustomUser.objects.filter(role='teacher').count()
            plan['Parents'] = CustomUser.objects.filter(role='parent').count()
            plan['Admins (kept)'] = CustomUser.objects.filter(role='admin').count()
        else:
            plan['All Users (except superusers)'] = CustomUser.objects.filter(is_superuser=False).count()

        # Academics
        plan['Classes'] = Class.objects.count()
        plan['Class Sessions'] = ClassSession.objects.count()
        plan['Subjects'] = Subject.objects.count()
        plan['Topics'] = Topic.objects.count()
        plan['Student Sessions (enrollments)'] = StudentSession.objects.count()

        # Content
        plan['Assignments/Notes/Announcements'] = SubjectContent.objects.count()
        plan['Content Files'] = ContentFile.objects.count()
        plan['Student Content Views'] = StudentContentView.objects.count()
        plan['Assignment Submissions'] = AssignmentSubmission.objects.count()
        plan['Submission Files'] = SubmissionFile.objects.count()

        # Assessments
        plan['Exams/Tests'] = Assessment.objects.count()
        plan['Questions'] = Question.objects.count()
        plan['Question Options'] = QuestionOption.objects.count()
        plan['Matching Pairs'] = MatchingPair.objects.count()
        plan['Assessment Submissions'] = AssessmentSubmission.objects.count()
        plan['Student Answers'] = StudentAnswer.objects.count()

        # Fees
        plan['Fee Structures'] = FeeStructure.objects.count()
        plan['Student Fee Records'] = StudentFeeRecord.objects.count()
        plan['Fee Payment History'] = FeePaymentHistory.objects.count()
        plan['Fee Receipts'] = FeeReceipt.objects.count()

        # Grading
        plan['Grading Scales'] = GradingScale.objects.count()
        plan['Grading Configurations'] = GradingConfiguration.objects.count()
        plan['Grade Components'] = GradeComponent.objects.count()
        plan['Student Grades'] = StudentGrade.objects.count()
        plan['Grade Summaries'] = GradeSummary.objects.count()
        plan['Attendance Records (grading)'] = AttendanceRecord.objects.count()
        plan['Configuration Templates'] = ConfigurationTemplate.objects.count()

        # Attendance Calendar
        try:
            plan['Session Calendars'] = SessionCalendar.objects.count()
            plan['Attendance Calendars'] = AttendanceCalendar.objects.count()
            plan['School Days'] = SchoolDay.objects.count()
            plan['Holiday Labels'] = HolidayLabel.objects.count()
            plan['Attendance School Days'] = AttendanceSchoolDay.objects.count()
            plan['Attendance Holiday Labels'] = AttendanceHolidayLabel.objects.count()
            plan['Attendance Records (calendar)'] = AttendanceRecord.objects.count()
        except:
            pass

        # Announcements
        plan['Announcements'] = Announcement.objects.count()

        # Logs
        plan['Activity Logs'] = ActivityLog.objects.count()
        plan['Notifications'] = Notification.objects.count()
        plan['Notification Statuses'] = NotificationStatus.objects.count()
        plan['Notification Preferences'] = NotificationPreference.objects.count()

        return plan

    def show_what_will_be_kept(self):
        """Show what will NOT be deleted"""
        self.stdout.write(self.style.SUCCESS('\n✓ WHAT WILL BE KEPT:'))
        self.stdout.write('-' * 70)

        kept_items = [
            'Departments (Science, Arts, Commercial) - 4 records',
            'User role definitions (admin, teacher, student, parent)',
            'Gender choices (Male, Female)',
            'Term definitions (First, Second, Third Term)',
            'Assessment types (test_1, test_2, mid_term, final_exam)',
            'All model structures and database schema',
            'All migrations',
            'Admin accounts (if --keep-admins is used)',
        ]

        for item in kept_items:
            self.stdout.write(f'  ✓ {item}')

    def show_deletion_plan(self, plan):
        """Display what will be deleted"""
        self.stdout.write(self.style.ERROR('\n✗ WHAT WILL BE DELETED:'))
        self.stdout.write('-' * 70)

        total = 0
        for category, count in plan.items():
            if count > 0:
                if '(kept)' in category:
                    self.stdout.write(self.style.SUCCESS(f'  ✓ {category:<45} {count:>6} records'))
                else:
                    self.stdout.write(self.style.ERROR(f'  ✗ {category:<45} {count:>6} records'))
                    total += count

        self.stdout.write('-' * 70)
        self.stdout.write(self.style.ERROR(f'  {"TOTAL RECORDS TO DELETE":<45} {total:>6} records'))

    def execute_deletion(self, plan, keep_admins):
        """Actually delete the data"""
        from users.models import CustomUser
        from academics.models import (
            Class, ClassSession, Subject, Topic, StudentSession,
            SubjectContent, ContentFile, StudentContentView,
            AssignmentSubmission, SubmissionFile,
            Assessment, Question, QuestionOption, MatchingPair,
            AssessmentSubmission, StudentAnswer, Department
        )
        from schooladmin.models import (
            FeeStructure, StudentFeeRecord, FeePaymentHistory, FeeReceipt,
            GradingScale, GradingConfiguration, GradeComponent,
            StudentGrade, AttendanceRecord, GradeSummary,
            ConfigurationTemplate, Announcement
        )
        from attendance.models import (
            SessionCalendar, AttendanceCalendar, SchoolDay, HolidayLabel,
            AttendanceSchoolDay, AttendanceHolidayLabel
        )
        from logs.models import ActivityLog, Notification, NotificationStatus, NotificationPreference

        deleted = {}

        with transaction.atomic():
            # Order matters - delete children before parents to avoid FK constraints

            # 1. Logs (no dependencies)
            self.stdout.write('[1/15] Clearing logs and notifications...')
            deleted['NotificationStatus'] = NotificationStatus.objects.all().delete()[0]
            deleted['Notification'] = Notification.objects.all().delete()[0]
            deleted['ActivityLog'] = ActivityLog.objects.all().delete()[0]
            deleted['NotificationPreference'] = NotificationPreference.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Logs cleared\n'))

            # 2. Announcements
            self.stdout.write('[2/15] Clearing announcements...')
            deleted['Announcement'] = Announcement.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Announcements cleared\n'))

            # 3. Attendance Calendar
            self.stdout.write('[3/15] Clearing attendance calendars...')
            try:
                deleted['AttendanceHolidayLabel'] = AttendanceHolidayLabel.objects.all().delete()[0]
                deleted['AttendanceSchoolDay'] = AttendanceSchoolDay.objects.all().delete()[0]
                deleted['HolidayLabel'] = HolidayLabel.objects.all().delete()[0]
                deleted['SchoolDay'] = SchoolDay.objects.all().delete()[0]
                deleted['AttendanceCalendar'] = AttendanceCalendar.objects.all().delete()[0]
                deleted['SessionCalendar'] = SessionCalendar.objects.all().delete()[0]
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  ⚠ Some attendance calendar items not found: {e}'))
            self.stdout.write(self.style.SUCCESS('  ✓ Attendance calendars cleared\n'))

            # 4. Grading System
            self.stdout.write('[4/15] Clearing grading system...')
            deleted['GradeSummary'] = GradeSummary.objects.all().delete()[0]
            deleted['StudentGrade'] = StudentGrade.objects.all().delete()[0]
            deleted['AttendanceRecord'] = AttendanceRecord.objects.all().delete()[0]
            deleted['GradeComponent'] = GradeComponent.objects.all().delete()[0]
            deleted['GradingConfiguration'] = GradingConfiguration.objects.all().delete()[0]
            deleted['GradingScale'] = GradingScale.objects.all().delete()[0]
            deleted['ConfigurationTemplate'] = ConfigurationTemplate.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Grading system cleared\n'))

            # 5. Fees
            self.stdout.write('[5/15] Clearing fee records...')
            deleted['FeeReceipt'] = FeeReceipt.objects.all().delete()[0]
            deleted['FeePaymentHistory'] = FeePaymentHistory.objects.all().delete()[0]
            deleted['StudentFeeRecord'] = StudentFeeRecord.objects.all().delete()[0]
            deleted['FeeStructure'] = FeeStructure.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Fee records cleared\n'))

            # 6. Assessment Submissions
            self.stdout.write('[6/15] Clearing assessment submissions...')
            deleted['StudentAnswer'] = StudentAnswer.objects.all().delete()[0]
            deleted['AssessmentSubmission'] = AssessmentSubmission.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Assessment submissions cleared\n'))

            # 7. Assessments
            self.stdout.write('[7/15] Clearing assessments and questions...')
            deleted['MatchingPair'] = MatchingPair.objects.all().delete()[0]
            deleted['QuestionOption'] = QuestionOption.objects.all().delete()[0]
            deleted['Question'] = Question.objects.all().delete()[0]
            deleted['Assessment'] = Assessment.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Assessments cleared\n'))

            # 8. Assignment Submissions
            self.stdout.write('[8/15] Clearing assignment submissions...')
            deleted['SubmissionFile'] = SubmissionFile.objects.all().delete()[0]
            deleted['AssignmentSubmission'] = AssignmentSubmission.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Assignment submissions cleared\n'))

            # 9. Subject Content
            self.stdout.write('[9/15] Clearing subject content...')
            deleted['StudentContentView'] = StudentContentView.objects.all().delete()[0]
            deleted['ContentFile'] = ContentFile.objects.all().delete()[0]
            deleted['SubjectContent'] = SubjectContent.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Subject content cleared\n'))

            # 10. Student Sessions & Topics
            self.stdout.write('[10/15] Clearing student enrollments...')
            deleted['StudentSession'] = StudentSession.objects.all().delete()[0]
            deleted['Topic'] = Topic.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Student enrollments cleared\n'))

            # 11. Subjects
            self.stdout.write('[11/15] Clearing subjects...')
            deleted['Subject'] = Subject.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Subjects cleared\n'))

            # 12. Class Sessions
            self.stdout.write('[12/15] Clearing class sessions...')
            deleted['ClassSession'] = ClassSession.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Class sessions cleared\n'))

            # 13. Classes
            self.stdout.write('[13/15] Clearing classes...')
            deleted['Class'] = Class.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS('  ✓ Classes cleared\n'))

            # 14. Users (keeping admins if requested)
            self.stdout.write('[14/15] Clearing users...')
            if keep_admins:
                deleted['Students'] = CustomUser.objects.filter(role='student').delete()[0]
                deleted['Teachers'] = CustomUser.objects.filter(role='teacher').delete()[0]
                deleted['Parents'] = CustomUser.objects.filter(role='parent').delete()[0]
                admin_count = CustomUser.objects.filter(role='admin').count()
                self.stdout.write(self.style.SUCCESS(f'  ✓ Users cleared (kept {admin_count} admin accounts)\n'))
            else:
                deleted['Users'] = CustomUser.objects.filter(is_superuser=False).delete()[0]
                self.stdout.write(self.style.SUCCESS('  ✓ All non-superuser accounts cleared\n'))

            # 15. Note about departments (we keep them)
            self.stdout.write('[15/15] Checking departments...')
            dept_count = Department.objects.count()
            self.stdout.write(self.style.SUCCESS(f'  ✓ Departments preserved ({dept_count} records kept)\n'))

        return deleted

    def show_deletion_summary(self, deleted):
        """Show summary of what was deleted"""
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
        self.stdout.write(self.style.SUCCESS('DATABASE CLEARED SUCCESSFULLY'))
        self.stdout.write(self.style.SUCCESS('=' * 70 + '\n'))

        self.stdout.write('DELETION SUMMARY:')
        self.stdout.write('-' * 70)

        total = 0
        for model, count in sorted(deleted.items()):
            if count > 0:
                self.stdout.write(f'  ✓ {model:<45} {count:>6} deleted')
                total += count

        self.stdout.write('-' * 70)
        self.stdout.write(self.style.SUCCESS(f'  {"TOTAL DELETED":<45} {total:>6} records\n'))

        # Show current state
        from users.models import CustomUser
        from academics.models import Department

        remaining_users = CustomUser.objects.count()
        remaining_admins = CustomUser.objects.filter(role='admin').count()
        remaining_depts = Department.objects.count()

        self.stdout.write('\nCURRENT DATABASE STATE:')
        self.stdout.write('-' * 70)
        self.stdout.write(f'  Users remaining: {remaining_users} ({remaining_admins} admins)')
        self.stdout.write(f'  Departments: {remaining_depts}')
        self.stdout.write('-' * 70)

        self.stdout.write(self.style.SUCCESS('\n✓ Your database is now ready for production!'))
        self.stdout.write('\nNext steps:')
        self.stdout.write('  1. Start adding real school data (classes, students, teachers)')
        self.stdout.write('  2. Configure academic sessions')
        self.stdout.write('  3. Set up fee structures')
        self.stdout.write('  4. Configure grading system\n')
