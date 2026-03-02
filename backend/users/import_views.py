"""
Views for bulk import of students, teachers, and parents via XLSX.
"""
import re
import secrets
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import Class, ClassSession
from logs.models import ActivityLog
from tenants.permissions import check_import_feature
from users.models import CustomUser

import openpyxl


REQUIRED_COLUMNS = {'first_name', 'last_name', 'email', 'gender', 'class'}
OPTIONAL_COLUMNS = {'middle_name', 'phone_number', 'date_of_birth', 'department', 'username'}
VALID_GENDERS = {'Male', 'Female'}
VALID_DEPARTMENTS = {'Science', 'Arts', 'Commercial'}
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def _parse_xlsx(file):
    """Parse XLSX file and return list of row dicts."""
    wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []

    # Header row
    raw_headers = [str(h).strip().lower() if h else '' for h in rows[0]]
    headers = raw_headers

    data = []
    for i, row in enumerate(rows[1:], start=2):
        # Skip completely empty rows
        if all(cell is None or str(cell).strip() == '' for cell in row):
            continue
        row_dict = {'_row_number': i}
        for j, header in enumerate(headers):
            if header and j < len(row):
                val = row[j]
                if val is not None:
                    val = str(val).strip()
                else:
                    val = ''
                row_dict[header] = val
            elif header:
                row_dict[header] = ''
        data.append(row_dict)

    wb.close()
    return headers, data


def _generate_username(first_name, last_name, existing_usernames):
    """Generate username as firstname.lastname with number suffix if needed."""
    base = f"{first_name.lower().replace(' ', '')}.{last_name.lower().replace(' ', '')}"
    # Remove non-alphanumeric except dots
    base = re.sub(r'[^a-z0-9.]', '', base)
    if not base:
        base = 'student'

    username = base
    counter = 1
    while username in existing_usernames:
        username = f"{base}{counter}"
        counter += 1

    existing_usernames.add(username)
    return username


def _validate_date(date_str):
    """Validate date string in YYYY-MM-DD format."""
    if not date_str:
        return True, None
    try:
        # Handle Excel date formats
        if isinstance(date_str, str):
            parsed = datetime.strptime(date_str.split(' ')[0], '%Y-%m-%d')
            return True, parsed.date()
    except ValueError:
        pass
    return False, None


def _validate_rows(data, school, academic_year, term, username_mode):
    """Validate all rows and return results."""
    # Fetch school's classes
    classes = Class.objects.filter(school=school)
    class_map = {c.name: c for c in classes}
    class_names = set(class_map.keys())

    # Fetch existing emails in this school
    existing_emails = set(
        CustomUser.objects.filter(school=school)
        .values_list('email', flat=True)
    )

    # Fetch existing usernames globally
    existing_usernames = set(
        CustomUser.objects.values_list('username', flat=True)
    )

    # Track emails/usernames within the import itself for duplicate detection
    import_emails = set()
    import_usernames = set()

    results = []

    for row in data:
        errors = []
        row_num = row.get('_row_number', '?')

        # Required fields
        first_name = row.get('first_name', '').strip()
        last_name = row.get('last_name', '').strip()
        email = row.get('email', '').strip().lower()
        gender = row.get('gender', '').strip()
        class_name = row.get('class', '').strip()

        if not first_name:
            errors.append('first_name is required')
        if not last_name:
            errors.append('last_name is required')

        if not email:
            errors.append('email is required')
        elif not EMAIL_REGEX.match(email):
            errors.append(f'Invalid email format: {email}')
        elif email in existing_emails:
            errors.append(f'Email already exists: {email}')
        elif email in import_emails:
            errors.append(f'Duplicate email in file: {email}')

        if not gender:
            errors.append('gender is required')
        elif gender not in VALID_GENDERS:
            errors.append(f'Gender must be exactly "Male" or "Female", got: "{gender}"')

        if not class_name:
            errors.append('class is required')
        elif class_name not in class_names:
            # Try to suggest closest match
            suggestion = _suggest_class(class_name, class_names)
            msg = f'Class "{class_name}" not found on platform'
            if suggestion:
                msg += f'. Did you mean "{suggestion}"?'
            errors.append(msg)

        # Department validation
        department = row.get('department', '').strip()
        matched_class = class_map.get(class_name)
        if matched_class and matched_class.has_departments:
            if not department:
                errors.append(f'Department is required for class "{class_name}" (use: Science, Arts, or Commercial)')
            elif department not in VALID_DEPARTMENTS:
                errors.append(f'Department must be exactly "Science", "Arts", or "Commercial", got: "{department}"')
        elif department and matched_class and not matched_class.has_departments:
            # Department provided but class doesn't need it — just ignore, not an error
            pass

        # Username
        username = ''
        if username_mode == 'xlsx':
            username = row.get('username', '').strip()
            if not username:
                errors.append('username is required (username mode is set to "From XLSX")')
            elif username in existing_usernames or username in import_usernames:
                errors.append(f'Username already exists: {username}')
        else:
            if first_name and last_name:
                username = _generate_username(first_name, last_name, import_usernames)

        # Date of birth
        dob_str = row.get('date_of_birth', '').strip()
        dob_valid, dob_parsed = _validate_date(dob_str)
        if dob_str and not dob_valid:
            errors.append(f'Invalid date format: "{dob_str}". Use YYYY-MM-DD')

        # Optional fields
        middle_name = row.get('middle_name', '').strip()
        phone_number = row.get('phone_number', '').strip()

        # Track for duplicate detection
        if email and not errors:
            import_emails.add(email)
        if username_mode == 'xlsx' and username:
            import_usernames.add(username)

        results.append({
            'row': row_num,
            'first_name': first_name,
            'last_name': last_name,
            'middle_name': middle_name,
            'email': email,
            'gender': gender,
            'class': class_name,
            'department': department,
            'username': username,
            'phone_number': phone_number,
            'date_of_birth': dob_str,
            'valid': len(errors) == 0,
            'errors': errors,
        })

    return results


def _suggest_class(input_name, valid_names):
    """Simple fuzzy match: suggest a class name if one is close."""
    input_lower = input_name.lower().replace(' ', '').replace('.', '')
    for name in valid_names:
        name_lower = name.lower().replace(' ', '').replace('.', '')
        if input_lower == name_lower:
            return name
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def import_student_info(request):
    """
    GET /api/<school_slug>/users/import-students/info/
    Returns class names, department classes, and import availability.
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    has_import = check_import_feature(school)
    subscription = getattr(school, 'subscription', None)
    max_rows = subscription.plan.max_import_rows if subscription else 0

    classes = Class.objects.filter(school=school).order_by('name')
    class_list = [
        {'id': c.id, 'name': c.name, 'has_departments': c.has_departments}
        for c in classes
    ]

    return Response({
        'has_import': has_import,
        'max_import_rows': max_rows,
        'classes': class_list,
        'valid_genders': list(VALID_GENDERS),
        'valid_departments': list(VALID_DEPARTMENTS),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def validate_import(request):
    """
    POST /api/<school_slug>/users/import-students/validate/
    Dry-run validation of XLSX file. No users are created.
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if not check_import_feature(school):
        return Response(
            {'error': 'XLSX import is not available on your current plan. Please upgrade to Standard or Premium.'},
            status=status.HTTP_403_FORBIDDEN
        )

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    if not file.name.endswith(('.xlsx', '.xls')):
        return Response({'error': 'File must be an XLSX file'}, status=status.HTTP_400_BAD_REQUEST)

    academic_year = request.data.get('academic_year', '').strip()
    term = request.data.get('term', '').strip()
    username_mode = request.data.get('username_mode', 'auto').strip()

    if not academic_year:
        return Response({'error': 'Academic year is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not term:
        return Response({'error': 'Term is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        headers, data = _parse_xlsx(file)
    except Exception as e:
        return Response({'error': f'Failed to parse XLSX file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    if not data:
        return Response({'error': 'No data rows found in the file'}, status=status.HTTP_400_BAD_REQUEST)

    # Check row limit
    subscription = getattr(school, 'subscription', None)
    max_rows = subscription.plan.max_import_rows if subscription else 0
    if max_rows > 0 and len(data) > max_rows:
        return Response(
            {'error': f'Your plan allows a maximum of {max_rows} students per import. This file has {len(data)} rows.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check required columns exist
    header_set = set(headers)
    missing = REQUIRED_COLUMNS - header_set
    if username_mode == 'xlsx':
        missing = (REQUIRED_COLUMNS | {'username'}) - header_set
    if missing:
        return Response(
            {'error': f'Missing required columns: {", ".join(sorted(missing))}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = _validate_rows(data, school, academic_year, term, username_mode)

    valid_count = sum(1 for r in results if r['valid'])
    error_count = sum(1 for r in results if not r['valid'])

    return Response({
        'results': results,
        'valid_count': valid_count,
        'error_count': error_count,
        'total': len(results),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def confirm_import(request):
    """
    POST /api/<school_slug>/users/import-students/confirm/
    Re-validates then creates student accounts and sends verification emails.
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if not check_import_feature(school):
        return Response(
            {'error': 'XLSX import is not available on your current plan.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check student limit before importing
    from tenants.permissions import check_user_limit
    can_create, msg = check_user_limit(school, 'student')
    if not can_create:
        return Response({'error': msg}, status=status.HTTP_403_FORBIDDEN)

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    academic_year = request.data.get('academic_year', '').strip()
    term = request.data.get('term', '').strip()
    username_mode = request.data.get('username_mode', 'auto').strip()

    if not academic_year or not term:
        return Response({'error': 'Academic year and term are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        headers, data = _parse_xlsx(file)
    except Exception as e:
        return Response({'error': f'Failed to parse XLSX file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    if not data:
        return Response({'error': 'No data rows found'}, status=status.HTTP_400_BAD_REQUEST)

    # Re-validate
    results = _validate_rows(data, school, academic_year, term, username_mode)

    # Check if valid rows would exceed student limit
    valid_count = sum(1 for r in results if r['valid'])
    subscription = getattr(school, 'subscription', None)
    if subscription and subscription.plan.max_students > 0:
        current_students = CustomUser.objects.filter(school=school, role='student', is_active=True).count()
        remaining = subscription.plan.max_students - current_students
        if valid_count > remaining:
            return Response({
                'error': f'This import would create {valid_count} students, but you only have room for {remaining} more on your {subscription.plan.display_name} plan.'
            }, status=status.HTTP_403_FORBIDDEN)

    classes = Class.objects.filter(school=school)
    class_map = {c.name: c for c in classes}

    created = []
    failed = []

    from logs.email_service import send_verification_email

    for row in results:
        if not row['valid']:
            failed.append({'row': row['row'], 'errors': row['errors']})
            continue

        try:
            classroom = class_map.get(row['class'])

            user = CustomUser.objects.create_user(
                username=row['username'],
                password=secrets.token_urlsafe(12),
                first_name=row['first_name'],
                last_name=row['last_name'],
                middle_name=row['middle_name'],
                email=row['email'],
                gender=row['gender'],
                role='student',
                school=school,
                classroom=classroom,
                academic_year=academic_year,
                term=term,
                department=row['department'] if row['department'] else None,
                phone_number=row['phone_number'] if row['phone_number'] else None,
                must_change_password=True,
            )

            # Set date of birth if provided
            if row['date_of_birth']:
                valid, parsed = _validate_date(row['date_of_birth'])
                if valid and parsed:
                    user.date_of_birth = parsed
                    user.save(update_fields=['date_of_birth'])

            # Create StudentSession record
            if classroom:
                try:
                    class_session = ClassSession.objects.get(
                        classroom=classroom,
                        academic_year=academic_year,
                        term=term
                    )
                    from academics.models import StudentSession
                    StudentSession.objects.get_or_create(
                        student=user,
                        class_session=class_session,
                        defaults={'is_active': True}
                    )
                except ClassSession.DoesNotExist:
                    pass  # Session not created yet for this class

            # Send verification email
            if user.email:
                token = secrets.token_urlsafe(32)
                user.email_verification_token = token
                user.email_verification_sent_at = timezone.now()
                user.save(update_fields=['email_verification_token', 'email_verification_sent_at'])

                verification_url = f"{settings.FRONTEND_URL}/verify-email/{token}"
                try:
                    send_verification_email(user, verification_url)
                except Exception:
                    pass  # Don't fail import if email fails

            created.append({
                'row': row['row'],
                'username': user.username,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}",
            })

        except Exception as e:
            failed.append({'row': row['row'], 'errors': [str(e)]})

    # Log the import action
    ActivityLog.objects.create(
        user=request.user,
        role='admin',
        action=f"{request.user.username} imported {len(created)} students via XLSX ({len(failed)} failed)"
    )

    return Response({
        'created_count': len(created),
        'failed_count': len(failed),
        'created': created,
        'failed': failed,
    })


# ---------------------------------------------------------------------------
# TEACHER IMPORT
# ---------------------------------------------------------------------------

TEACHER_REQUIRED_COLUMNS = {'first_name', 'last_name', 'email', 'gender'}
TEACHER_OPTIONAL_COLUMNS = {'middle_name', 'phone_number', 'date_of_birth', 'username'}


def _validate_teacher_rows(data, school, username_mode):
    """Validate teacher import rows."""
    existing_emails = set(
        CustomUser.objects.filter(school=school).values_list('email', flat=True)
    )
    existing_usernames = set(CustomUser.objects.values_list('username', flat=True))

    import_emails = set()
    import_usernames = set()
    results = []

    for row in data:
        errors = []
        row_num = row.get('_row_number', '?')

        first_name = row.get('first_name', '').strip()
        last_name = row.get('last_name', '').strip()
        email = row.get('email', '').strip().lower()
        gender = row.get('gender', '').strip()

        if not first_name:
            errors.append('first_name is required')
        if not last_name:
            errors.append('last_name is required')

        if not email:
            errors.append('email is required')
        elif not EMAIL_REGEX.match(email):
            errors.append(f'Invalid email format: {email}')
        elif email in existing_emails:
            errors.append(f'Email already exists: {email}')
        elif email in import_emails:
            errors.append(f'Duplicate email in file: {email}')

        if not gender:
            errors.append('gender is required')
        elif gender not in VALID_GENDERS:
            errors.append(f'Gender must be exactly "Male" or "Female", got: "{gender}"')

        username = ''
        if username_mode == 'xlsx':
            username = row.get('username', '').strip()
            if not username:
                errors.append('username is required (username mode is set to "From XLSX")')
            elif username in existing_usernames or username in import_usernames:
                errors.append(f'Username already exists: {username}')
        else:
            if first_name and last_name:
                username = _generate_username(first_name, last_name, import_usernames)

        dob_str = row.get('date_of_birth', '').strip()
        dob_valid, _ = _validate_date(dob_str)
        if dob_str and not dob_valid:
            errors.append(f'Invalid date format: "{dob_str}". Use YYYY-MM-DD')

        middle_name = row.get('middle_name', '').strip()
        phone_number = row.get('phone_number', '').strip()

        if email and not errors:
            import_emails.add(email)
        if username_mode == 'xlsx' and username and username not in existing_usernames:
            import_usernames.add(username)

        results.append({
            'row': row_num,
            'first_name': first_name,
            'last_name': last_name,
            'middle_name': middle_name,
            'email': email,
            'gender': gender,
            'username': username,
            'phone_number': phone_number,
            'date_of_birth': dob_str,
            'valid': len(errors) == 0,
            'errors': errors,
        })

    return results


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def import_teacher_info(request):
    """GET /api/<school_slug>/users/import-teachers/info/"""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    has_import = check_import_feature(school)
    subscription = getattr(school, 'subscription', None)
    max_rows = subscription.plan.max_import_rows if subscription else 0

    return Response({
        'has_import': has_import,
        'max_import_rows': max_rows,
        'valid_genders': list(VALID_GENDERS),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def validate_import_teachers(request):
    """POST /api/<school_slug>/users/import-teachers/validate/"""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if not check_import_feature(school):
        return Response(
            {'error': 'XLSX import is not available on your current plan. Please upgrade to Standard or Premium.'},
            status=status.HTTP_403_FORBIDDEN
        )

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
    if not file.name.endswith(('.xlsx', '.xls')):
        return Response({'error': 'File must be an XLSX file'}, status=status.HTTP_400_BAD_REQUEST)

    username_mode = request.data.get('username_mode', 'auto').strip()

    try:
        headers, data = _parse_xlsx(file)
    except Exception as e:
        return Response({'error': f'Failed to parse XLSX file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    if not data:
        return Response({'error': 'No data rows found in the file'}, status=status.HTTP_400_BAD_REQUEST)

    subscription = getattr(school, 'subscription', None)
    max_rows = subscription.plan.max_import_rows if subscription else 0
    if max_rows > 0 and len(data) > max_rows:
        return Response(
            {'error': f'Your plan allows a maximum of {max_rows} rows per import. This file has {len(data)} rows.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    required = TEACHER_REQUIRED_COLUMNS
    if username_mode == 'xlsx':
        required = required | {'username'}
    missing = required - set(headers)
    if missing:
        return Response(
            {'error': f'Missing required columns: {", ".join(sorted(missing))}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = _validate_teacher_rows(data, school, username_mode)
    valid_count = sum(1 for r in results if r['valid'])
    error_count = sum(1 for r in results if not r['valid'])

    return Response({
        'results': results,
        'valid_count': valid_count,
        'error_count': error_count,
        'total': len(results),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def confirm_import_teachers(request):
    """POST /api/<school_slug>/users/import-teachers/confirm/"""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if not check_import_feature(school):
        return Response(
            {'error': 'XLSX import is not available on your current plan.'},
            status=status.HTTP_403_FORBIDDEN
        )

    from tenants.permissions import check_user_limit
    can_create, msg = check_user_limit(school, 'teacher')
    if not can_create:
        return Response({'error': msg}, status=status.HTTP_403_FORBIDDEN)

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    username_mode = request.data.get('username_mode', 'auto').strip()

    try:
        headers, data = _parse_xlsx(file)
    except Exception as e:
        return Response({'error': f'Failed to parse XLSX file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    if not data:
        return Response({'error': 'No data rows found'}, status=status.HTTP_400_BAD_REQUEST)

    results = _validate_teacher_rows(data, school, username_mode)

    valid_count = sum(1 for r in results if r['valid'])
    subscription = getattr(school, 'subscription', None)
    if subscription and subscription.plan.max_teachers > 0:
        current_teachers = CustomUser.objects.filter(school=school, role='teacher', is_active=True).count()
        remaining = subscription.plan.max_teachers - current_teachers
        if valid_count > remaining:
            return Response({
                'error': f'This import would create {valid_count} teachers, but you only have room for {remaining} more on your {subscription.plan.display_name} plan.'
            }, status=status.HTTP_403_FORBIDDEN)

    from logs.email_service import send_verification_email

    created = []
    failed = []

    for row in results:
        if not row['valid']:
            failed.append({'row': row['row'], 'errors': row['errors']})
            continue

        try:
            user = CustomUser.objects.create_user(
                username=row['username'],
                password=secrets.token_urlsafe(12),
                first_name=row['first_name'],
                last_name=row['last_name'],
                middle_name=row['middle_name'],
                email=row['email'],
                gender=row['gender'],
                role='teacher',
                school=school,
                phone_number=row['phone_number'] if row['phone_number'] else None,
                must_change_password=True,
            )

            if row['date_of_birth']:
                valid, parsed = _validate_date(row['date_of_birth'])
                if valid and parsed:
                    user.date_of_birth = parsed
                    user.save(update_fields=['date_of_birth'])

            if user.email:
                token = secrets.token_urlsafe(32)
                user.email_verification_token = token
                user.email_verification_sent_at = timezone.now()
                user.save(update_fields=['email_verification_token', 'email_verification_sent_at'])
                verification_url = f"{settings.FRONTEND_URL}/verify-email/{token}"
                try:
                    send_verification_email(user, verification_url)
                except Exception:
                    pass

            created.append({
                'row': row['row'],
                'username': user.username,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}",
            })

        except Exception as e:
            failed.append({'row': row['row'], 'errors': [str(e)]})

    ActivityLog.objects.create(
        user=request.user,
        role='admin',
        action=f"{request.user.username} imported {len(created)} teachers via XLSX ({len(failed)} failed)"
    )

    return Response({
        'created_count': len(created),
        'failed_count': len(failed),
        'created': created,
        'failed': failed,
    })


# ---------------------------------------------------------------------------
# PARENT IMPORT
# ---------------------------------------------------------------------------

PARENT_REQUIRED_COLUMNS = {'first_name', 'last_name', 'email', 'phone_number', 'gender'}
PARENT_OPTIONAL_COLUMNS = {'middle_name', 'date_of_birth', 'child_usernames', 'username'}


def _validate_parent_rows(data, school, username_mode):
    """Validate parent import rows. child_usernames is comma-separated student usernames."""
    existing_emails = set(
        CustomUser.objects.filter(school=school).values_list('email', flat=True)
    )
    existing_usernames = set(CustomUser.objects.values_list('username', flat=True))

    # Build a map of student username -> student for this school
    students_map = {
        u.username: u
        for u in CustomUser.objects.filter(school=school, role='student')
    }

    import_emails = set()
    import_usernames = set()
    results = []

    for row in data:
        errors = []
        row_num = row.get('_row_number', '?')

        first_name = row.get('first_name', '').strip()
        last_name = row.get('last_name', '').strip()
        email = row.get('email', '').strip().lower()
        phone_number = row.get('phone_number', '').strip()
        gender = row.get('gender', '').strip()

        if not first_name:
            errors.append('first_name is required')
        if not last_name:
            errors.append('last_name is required')

        if not email:
            errors.append('email is required')
        elif not EMAIL_REGEX.match(email):
            errors.append(f'Invalid email format: {email}')
        elif email in existing_emails:
            errors.append(f'Email already exists: {email}')
        elif email in import_emails:
            errors.append(f'Duplicate email in file: {email}')

        if not phone_number:
            errors.append('phone_number is required')

        if not gender:
            errors.append('gender is required')
        elif gender not in VALID_GENDERS:
            errors.append(f'Gender must be exactly "Male" or "Female", got: "{gender}"')

        username = ''
        if username_mode == 'xlsx':
            username = row.get('username', '').strip()
            if not username:
                errors.append('username is required (username mode is set to "From XLSX")')
            elif username in existing_usernames or username in import_usernames:
                errors.append(f'Username already exists: {username}')
        else:
            if first_name and last_name:
                username = _generate_username(first_name, last_name, import_usernames)

        dob_str = row.get('date_of_birth', '').strip()
        dob_valid, _ = _validate_date(dob_str)
        if dob_str and not dob_valid:
            errors.append(f'Invalid date format: "{dob_str}". Use YYYY-MM-DD')

        # Validate child usernames
        raw_children = row.get('child_usernames', '').strip()
        child_ids = []
        child_names = []
        if raw_children:
            parts = [p.strip() for p in raw_children.split(',') if p.strip()]
            for uname in parts:
                student = students_map.get(uname)
                if not student:
                    errors.append(f'Student username not found in this school: "{uname}"')
                else:
                    child_ids.append(student.id)
                    child_names.append(f"{student.first_name} {student.last_name}")

        middle_name = row.get('middle_name', '').strip()

        if email and not errors:
            import_emails.add(email)
        if username_mode == 'xlsx' and username and username not in existing_usernames:
            import_usernames.add(username)

        results.append({
            'row': row_num,
            'first_name': first_name,
            'last_name': last_name,
            'middle_name': middle_name,
            'email': email,
            'gender': gender,
            'phone_number': phone_number,
            'username': username,
            'date_of_birth': dob_str,
            'child_usernames': raw_children,
            'child_ids': child_ids,
            'child_names': child_names,
            'valid': len(errors) == 0,
            'errors': errors,
        })

    return results


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def import_parent_info(request):
    """GET /api/<school_slug>/users/import-parents/info/"""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    has_import = check_import_feature(school)
    subscription = getattr(school, 'subscription', None)
    max_rows = subscription.plan.max_import_rows if subscription else 0

    return Response({
        'has_import': has_import,
        'max_import_rows': max_rows,
        'valid_genders': list(VALID_GENDERS),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def validate_import_parents(request):
    """POST /api/<school_slug>/users/import-parents/validate/"""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if not check_import_feature(school):
        return Response(
            {'error': 'XLSX import is not available on your current plan. Please upgrade to Standard or Premium.'},
            status=status.HTTP_403_FORBIDDEN
        )

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
    if not file.name.endswith(('.xlsx', '.xls')):
        return Response({'error': 'File must be an XLSX file'}, status=status.HTTP_400_BAD_REQUEST)

    username_mode = request.data.get('username_mode', 'auto').strip()

    try:
        headers, data = _parse_xlsx(file)
    except Exception as e:
        return Response({'error': f'Failed to parse XLSX file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    if not data:
        return Response({'error': 'No data rows found in the file'}, status=status.HTTP_400_BAD_REQUEST)

    subscription = getattr(school, 'subscription', None)
    max_rows = subscription.plan.max_import_rows if subscription else 0
    if max_rows > 0 and len(data) > max_rows:
        return Response(
            {'error': f'Your plan allows a maximum of {max_rows} rows per import. This file has {len(data)} rows.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    required = PARENT_REQUIRED_COLUMNS
    if username_mode == 'xlsx':
        required = required | {'username'}
    missing = required - set(headers)
    if missing:
        return Response(
            {'error': f'Missing required columns: {", ".join(sorted(missing))}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = _validate_parent_rows(data, school, username_mode)
    valid_count = sum(1 for r in results if r['valid'])
    error_count = sum(1 for r in results if not r['valid'])

    return Response({
        'results': results,
        'valid_count': valid_count,
        'error_count': error_count,
        'total': len(results),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def confirm_import_parents(request):
    """POST /api/<school_slug>/users/import-parents/confirm/"""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if not check_import_feature(school):
        return Response(
            {'error': 'XLSX import is not available on your current plan.'},
            status=status.HTTP_403_FORBIDDEN
        )

    from tenants.permissions import check_user_limit
    can_create, msg = check_user_limit(school, 'parent')
    if not can_create:
        return Response({'error': msg}, status=status.HTTP_403_FORBIDDEN)

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    username_mode = request.data.get('username_mode', 'auto').strip()

    try:
        headers, data = _parse_xlsx(file)
    except Exception as e:
        return Response({'error': f'Failed to parse XLSX file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    if not data:
        return Response({'error': 'No data rows found'}, status=status.HTTP_400_BAD_REQUEST)

    results = _validate_parent_rows(data, school, username_mode)

    valid_count = sum(1 for r in results if r['valid'])
    subscription = getattr(school, 'subscription', None)
    if subscription and subscription.plan.max_parents > 0:
        current_parents = CustomUser.objects.filter(school=school, role='parent', is_active=True).count()
        remaining = subscription.plan.max_parents - current_parents
        if valid_count > remaining:
            return Response({
                'error': f'This import would create {valid_count} parents, but you only have room for {remaining} more on your {subscription.plan.display_name} plan.'
            }, status=status.HTTP_403_FORBIDDEN)

    from logs.email_service import send_verification_email

    created = []
    failed = []

    for row in results:
        if not row['valid']:
            failed.append({'row': row['row'], 'errors': row['errors']})
            continue

        try:
            user = CustomUser.objects.create_user(
                username=row['username'],
                password=secrets.token_urlsafe(12),
                first_name=row['first_name'],
                last_name=row['last_name'],
                middle_name=row['middle_name'],
                email=row['email'],
                gender=row['gender'],
                role='parent',
                school=school,
                phone_number=row['phone_number'] if row['phone_number'] else None,
                must_change_password=True,
            )

            if row['date_of_birth']:
                valid, parsed = _validate_date(row['date_of_birth'])
                if valid and parsed:
                    user.date_of_birth = parsed
                    user.save(update_fields=['date_of_birth'])

            # Link children
            if row['child_ids']:
                children = CustomUser.objects.filter(id__in=row['child_ids'], school=school, role='student')
                user.children.set(children)

            if user.email:
                token = secrets.token_urlsafe(32)
                user.email_verification_token = token
                user.email_verification_sent_at = timezone.now()
                user.save(update_fields=['email_verification_token', 'email_verification_sent_at'])
                verification_url = f"{settings.FRONTEND_URL}/verify-email/{token}"
                try:
                    send_verification_email(user, verification_url)
                except Exception:
                    pass

            created.append({
                'row': row['row'],
                'username': user.username,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}",
                'children': row['child_names'],
            })

        except Exception as e:
            failed.append({'row': row['row'], 'errors': [str(e)]})

    ActivityLog.objects.create(
        user=request.user,
        role='admin',
        action=f"{request.user.username} imported {len(created)} parents via XLSX ({len(failed)} failed)"
    )

    return Response({
        'created_count': len(created),
        'failed_count': len(failed),
        'created': created,
        'failed': failed,
    })
