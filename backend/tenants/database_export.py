"""
Database export utilities for downloading full school data.
Supports CSV (zipped), XLSX, and JSON formats.
"""
import csv
import json
import io
import zipfile
from datetime import datetime, date
from decimal import Decimal
from collections import OrderedDict

from openpyxl import Workbook


# Fields to always exclude from exports
GLOBAL_EXCLUDE = {'password', 'email_verification_token', 'password_reset_token',
                  'password_reset_expiry', 'avatar', 'profile_picture'}


def get_export_tables(school):
    """
    Returns an ordered dict of {table_name: (queryset, exclude_fields)}.
    All querysets are filtered to the given school.
    """
    from users.models import CustomUser
    from academics.models import (
        Department, Class, ClassSession, Subject, Topic,
        StudentSession, SubjectContent, ContentFile,
        AssignmentSubmission, SubmissionFile,
        Assessment, Question, QuestionOption, MatchingPair,
        AssessmentSubmission, StudentAnswer, AssessmentAccess,
    )
    from attendance.models import (
        AttendanceCalendar, AttendanceSchoolDay, AttendanceHolidayLabel,
    )
    from schooladmin.models import (
        FeeStructure, StudentFeeRecord, FeePaymentHistory, FeeReceipt,
        GradingScale, GradingConfiguration, GradeComponent,
        StudentGrade, GradeSummary, Announcement,
    )
    from logs.models import ActivityLog, Notification

    tables = OrderedDict()

    # Users
    tables['users'] = (
        CustomUser.objects.filter(school=school).order_by('id'),
        GLOBAL_EXCLUDE | {'last_login', 'groups', 'user_permissions'},
    )

    # Academics
    tables['departments'] = (
        Department.objects.filter(school=school).order_by('id'),
        set(),
    )
    tables['classes'] = (
        Class.objects.filter(school=school).order_by('id'),
        set(),
    )
    tables['class_sessions'] = (
        ClassSession.objects.filter(classroom__school=school).order_by('id'),
        set(),
    )
    tables['subjects'] = (
        Subject.objects.filter(class_session__classroom__school=school).order_by('id'),
        set(),
    )
    tables['topics'] = (
        Topic.objects.filter(subject__class_session__classroom__school=school).order_by('id'),
        set(),
    )
    tables['student_sessions'] = (
        StudentSession.objects.filter(student__school=school).order_by('id'),
        set(),
    )
    tables['subject_content'] = (
        SubjectContent.objects.filter(subject__class_session__classroom__school=school).order_by('id'),
        set(),
    )
    tables['assignment_submissions'] = (
        AssignmentSubmission.objects.filter(student__school=school).order_by('id'),
        set(),
    )
    tables['assessments'] = (
        Assessment.objects.filter(subject__class_session__classroom__school=school).order_by('id'),
        set(),
    )
    tables['questions'] = (
        Question.objects.filter(assessment__subject__class_session__classroom__school=school).order_by('id'),
        set(),
    )
    tables['question_options'] = (
        QuestionOption.objects.filter(question__assessment__subject__class_session__classroom__school=school).order_by('id'),
        set(),
    )
    tables['matching_pairs'] = (
        MatchingPair.objects.filter(question__assessment__subject__class_session__classroom__school=school).order_by('id'),
        set(),
    )
    tables['assessment_submissions'] = (
        AssessmentSubmission.objects.filter(student__school=school).order_by('id'),
        set(),
    )
    tables['student_answers'] = (
        StudentAnswer.objects.filter(submission__student__school=school).order_by('id'),
        set(),
    )

    # Attendance
    tables['attendance_calendars'] = (
        AttendanceCalendar.objects.filter(school=school).order_by('id'),
        set(),
    )
    tables['attendance_school_days'] = (
        AttendanceSchoolDay.objects.filter(calendar__school=school).order_by('id'),
        set(),
    )
    tables['attendance_holiday_labels'] = (
        AttendanceHolidayLabel.objects.filter(calendar__school=school).order_by('id'),
        set(),
    )

    # Fees & Grading
    tables['fee_structures'] = (
        FeeStructure.objects.filter(school=school).order_by('id'),
        set(),
    )
    tables['student_fee_records'] = (
        StudentFeeRecord.objects.filter(student__school=school).order_by('id'),
        set(),
    )
    tables['fee_payment_history'] = (
        FeePaymentHistory.objects.filter(fee_record__student__school=school).order_by('id'),
        set(),
    )
    tables['fee_receipts'] = (
        FeeReceipt.objects.filter(student__school=school).order_by('id'),
        {'pdf_file'},
    )
    tables['grading_scales'] = (
        GradingScale.objects.filter(school=school).order_by('id'),
        set(),
    )
    tables['grading_configurations'] = (
        GradingConfiguration.objects.filter(school=school).order_by('id'),
        set(),
    )
    tables['grade_components'] = (
        GradeComponent.objects.filter(grading_config__school=school).order_by('id'),
        set(),
    )
    tables['student_grades'] = (
        StudentGrade.objects.filter(student__school=school).order_by('id'),
        set(),
    )
    tables['grade_summaries'] = (
        GradeSummary.objects.filter(student__school=school).order_by('id'),
        set(),
    )

    # Announcements
    tables['announcements'] = (
        Announcement.objects.filter(school=school).order_by('id'),
        set(),
    )

    # Logs
    tables['activity_logs'] = (
        ActivityLog.objects.filter(school=school).order_by('id'),
        set(),
    )
    tables['notifications'] = (
        Notification.objects.filter(school=school).order_by('id'),
        set(),
    )

    return tables


def _serialize_value(value):
    """Convert a model field value to an export-safe type."""
    if value is None:
        return ''
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bool):
        return value
    if hasattr(value, 'pk'):
        # Foreign key — export the PK
        return value.pk
    return value


def queryset_to_rows(queryset, exclude_fields):
    """
    Convert a queryset to (headers, rows) tuple.
    Returns (list[str], list[list]).
    """
    if not queryset.exists():
        return [], []

    model = queryset.model
    fields = [
        f for f in model._meta.get_fields()
        if hasattr(f, 'column') and f.name not in exclude_fields
    ]

    headers = [f.name for f in fields]
    rows = []

    for obj in queryset.iterator(chunk_size=500):
        row = []
        for f in fields:
            val = getattr(obj, f.name, None)
            row.append(_serialize_value(val))
        rows.append(row)

    return headers, rows


def generate_database_export(school, format_type):
    """
    Main entry point. Returns (file_bytes, filename, content_type).
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    slug = school.slug

    if format_type == 'csv':
        return _export_csv(school, slug, timestamp)
    elif format_type == 'xlsx':
        return _export_xlsx(school, slug, timestamp)
    elif format_type == 'json':
        return _export_json(school, slug, timestamp)
    else:
        raise ValueError(f'Unsupported format: {format_type}')


def _export_csv(school, slug, timestamp):
    """Generate a ZIP of CSV files."""
    buf = io.BytesIO()
    tables = get_export_tables(school)

    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for table_name, (qs, exclude) in tables.items():
            headers, rows = queryset_to_rows(qs, exclude)
            if not headers:
                continue

            csv_buf = io.StringIO()
            writer = csv.writer(csv_buf)
            writer.writerow(headers)
            writer.writerows(rows)
            zf.writestr(f'{table_name}.csv', csv_buf.getvalue())

    filename = f'{slug}_database_{timestamp}.zip'
    return buf.getvalue(), filename, 'application/zip'


def _export_xlsx(school, slug, timestamp):
    """Generate a single XLSX with one sheet per table."""
    wb = Workbook()
    wb.remove(wb.active)
    tables = get_export_tables(school)

    for table_name, (qs, exclude) in tables.items():
        headers, rows = queryset_to_rows(qs, exclude)
        if not headers:
            continue

        # Excel sheet names max 31 chars
        sheet_name = table_name[:31]
        ws = wb.create_sheet(title=sheet_name)
        ws.append(headers)
        for row in rows:
            ws.append([str(v) if isinstance(v, (list, dict)) else v for v in row])

    xlsx_buf = io.BytesIO()
    wb.save(xlsx_buf)
    xlsx_buf.seek(0)

    filename = f'{slug}_database_{timestamp}.xlsx'
    return xlsx_buf.getvalue(), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def _export_json(school, slug, timestamp):
    """Generate structured JSON export with all data."""
    tables = get_export_tables(school)
    result = {
        'school': {
            'name': school.name,
            'slug': school.slug,
            'email': school.email,
            'export_date': datetime.now().isoformat(),
            'format_version': '1.0',
        },
        'tables': {},
    }

    for table_name, (qs, exclude) in tables.items():
        headers, rows = queryset_to_rows(qs, exclude)
        if not headers:
            result['tables'][table_name] = []
            continue

        table_data = []
        for row in rows:
            record = {}
            for i, header in enumerate(headers):
                val = row[i]
                # Convert non-serialisable types
                if isinstance(val, (Decimal,)):
                    val = str(val)
                record[header] = val
            table_data.append(record)

        result['tables'][table_name] = table_data

    json_bytes = json.dumps(result, indent=2, default=str, ensure_ascii=False).encode('utf-8')
    filename = f'{slug}_database_{timestamp}.json'
    return json_bytes, filename, 'application/json'
