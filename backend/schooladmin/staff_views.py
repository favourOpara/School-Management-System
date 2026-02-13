"""
Views for Staff Management / Book On-Off feature.
Premium/Custom tier only.
"""
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework import status

from schooladmin.models import (
    StaffScheduleGroup, StaffScheduleAssignment,
    StaffAttendanceRecord, StaffManagementSettings,
)
from users.views import IsAdminRole
from tenants.permissions import HasStaffManagement


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'teacher'


# ============================================================================
# ADMIN: SCHEDULE GROUP CRUD
# ============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def manage_schedule_groups(request):
    """GET: List all schedule groups. POST: Create a new one."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        groups = StaffScheduleGroup.objects.filter(school=school)
        data = [{
            'id': g.id,
            'name': g.name,
            'days': g.days,
            'start_time': g.start_time.strftime('%H:%M'),
            'end_time': g.end_time.strftime('%H:%M'),
            'grace_period_minutes': g.grace_period_minutes,
            'is_active': g.is_active,
            'teacher_count': g.assignments.filter(is_active=True).count(),
            'created_at': g.created_at,
        } for g in groups]
        return Response(data, status=status.HTTP_200_OK)

    # POST: Create
    name = request.data.get('name', '').strip()
    days = request.data.get('days', [])
    start_time_str = request.data.get('start_time')
    end_time_str = request.data.get('end_time')
    grace_period = request.data.get('grace_period_minutes', 30)

    if not name or not days or not start_time_str or not end_time_str:
        return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)

    if not isinstance(days, list) or not all(isinstance(d, int) and 0 <= d <= 6 for d in days):
        return Response({'error': 'Days must be a list of integers 0-6'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        start_t = datetime.strptime(start_time_str, '%H:%M').time()
        end_t = datetime.strptime(end_time_str, '%H:%M').time()
    except ValueError:
        return Response({'error': 'Invalid time format. Use HH:MM'}, status=status.HTTP_400_BAD_REQUEST)

    if StaffScheduleGroup.objects.filter(school=school, name=name).exists():
        return Response(
            {'error': 'A schedule group with this name already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )

    group = StaffScheduleGroup.objects.create(
        school=school,
        name=name,
        days=days,
        start_time=start_t,
        end_time=end_t,
        grace_period_minutes=grace_period,
    )
    return Response({'id': group.id, 'message': 'Schedule group created'}, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def schedule_group_detail(request, group_id):
    """PUT: Update. DELETE: Delete."""
    school = getattr(request, 'school', None)
    try:
        group = StaffScheduleGroup.objects.get(id=group_id, school=school)
    except StaffScheduleGroup.DoesNotExist:
        return Response({'error': 'Schedule group not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        group.delete()
        return Response({'message': 'Schedule group deleted'}, status=status.HTTP_200_OK)

    # PUT: Update
    if 'name' in request.data:
        new_name = request.data['name'].strip()
        if StaffScheduleGroup.objects.filter(school=school, name=new_name).exclude(id=group.id).exists():
            return Response({'error': 'A schedule group with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
        group.name = new_name
    if 'days' in request.data:
        days = request.data['days']
        if not isinstance(days, list) or not all(isinstance(d, int) and 0 <= d <= 6 for d in days):
            return Response({'error': 'Days must be a list of integers 0-6'}, status=status.HTTP_400_BAD_REQUEST)
        group.days = days
    if 'start_time' in request.data:
        try:
            group.start_time = datetime.strptime(request.data['start_time'], '%H:%M').time()
        except ValueError:
            return Response({'error': 'Invalid start_time format. Use HH:MM'}, status=status.HTTP_400_BAD_REQUEST)
    if 'end_time' in request.data:
        try:
            group.end_time = datetime.strptime(request.data['end_time'], '%H:%M').time()
        except ValueError:
            return Response({'error': 'Invalid end_time format. Use HH:MM'}, status=status.HTTP_400_BAD_REQUEST)
    if 'grace_period_minutes' in request.data:
        group.grace_period_minutes = request.data['grace_period_minutes']
    if 'is_active' in request.data:
        group.is_active = request.data['is_active']

    group.save()
    return Response({'message': 'Schedule group updated'}, status=status.HTTP_200_OK)


# ============================================================================
# ADMIN: TEACHER-GROUP ASSIGNMENTS
# ============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def manage_assignments(request):
    """GET: List assignments. POST: Create assignment."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        assignments = StaffScheduleAssignment.objects.filter(
            school=school
        ).select_related('teacher', 'schedule_group')
        data = [{
            'id': a.id,
            'teacher_id': a.teacher.id,
            'teacher_name': f"{a.teacher.first_name} {a.teacher.last_name}",
            'schedule_group_id': a.schedule_group.id,
            'schedule_group_name': a.schedule_group.name,
            'effective_from': a.effective_from,
            'is_active': a.is_active,
        } for a in assignments]
        return Response(data, status=status.HTTP_200_OK)

    # POST: Create
    teacher_id = request.data.get('teacher_id')
    group_id = request.data.get('schedule_group_id')
    effective_from = request.data.get('effective_from', str(timezone.localtime(timezone.now()).date()))

    if not teacher_id or not group_id:
        return Response({'error': 'teacher_id and schedule_group_id are required'}, status=status.HTTP_400_BAD_REQUEST)

    from users.models import CustomUser
    try:
        teacher = CustomUser.objects.get(id=teacher_id, school=school, role='teacher')
    except CustomUser.DoesNotExist:
        return Response({'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        group = StaffScheduleGroup.objects.get(id=group_id, school=school)
    except StaffScheduleGroup.DoesNotExist:
        return Response({'error': 'Schedule group not found'}, status=status.HTTP_404_NOT_FOUND)

    # Deactivate any existing active assignment for this teacher
    StaffScheduleAssignment.objects.filter(
        teacher=teacher, school=school, is_active=True
    ).update(is_active=False)

    assignment = StaffScheduleAssignment.objects.create(
        school=school,
        teacher=teacher,
        schedule_group=group,
        effective_from=effective_from,
    )
    return Response({'id': assignment.id, 'message': 'Teacher assigned to schedule group'}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def delete_assignment(request, assignment_id):
    """Delete a teacher-group assignment."""
    school = getattr(request, 'school', None)
    try:
        assignment = StaffScheduleAssignment.objects.get(id=assignment_id, school=school)
    except StaffScheduleAssignment.DoesNotExist:
        return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
    assignment.delete()
    return Response({'message': 'Assignment deleted'}, status=status.HTTP_200_OK)


# ============================================================================
# ADMIN: STAFF RECORDS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def list_staff_records(request):
    """List all staff attendance records with optional filters."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    records = StaffAttendanceRecord.objects.filter(
        school=school
    ).select_related('teacher', 'schedule_group')

    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')
    teacher_id = request.query_params.get('teacher_id')
    group_id = request.query_params.get('schedule_group_id')

    if date_from:
        records = records.filter(date__gte=date_from)
    if date_to:
        records = records.filter(date__lte=date_to)
    if teacher_id:
        records = records.filter(teacher_id=teacher_id)
    if group_id:
        records = records.filter(schedule_group_id=group_id)

    data = [{
        'id': r.id,
        'teacher_id': r.teacher.id,
        'teacher_name': f"{r.teacher.first_name} {r.teacher.last_name}",
        'date': r.date,
        'schedule_group_name': r.schedule_group.name if r.schedule_group else 'N/A',
        'scheduled_start': r.scheduled_start.strftime('%H:%M') if r.scheduled_start else None,
        'scheduled_end': r.scheduled_end.strftime('%H:%M') if r.scheduled_end else None,
        'book_on_time': timezone.localtime(r.book_on_time).strftime('%H:%M:%S') if r.book_on_time else None,
        'book_off_time': timezone.localtime(r.book_off_time).strftime('%H:%M:%S') if r.book_off_time else None,
        'book_on_status': r.book_on_status,
        'book_off_status': r.book_off_status,
    } for r in records]

    return Response(data, status=status.HTTP_200_OK)


# ============================================================================
# ADMIN: SETTINGS
# ============================================================================

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def manage_staff_settings(request):
    """GET/PUT: Staff management settings."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj, _ = StaffManagementSettings.objects.get_or_create(school=school)

    if request.method == 'GET':
        return Response({
            'allow_late_booking': settings_obj.allow_late_booking,
        }, status=status.HTTP_200_OK)

    # PUT
    if 'allow_late_booking' in request.data:
        settings_obj.allow_late_booking = request.data['allow_late_booking']
        settings_obj.save()
    return Response({'message': 'Settings updated'}, status=status.HTTP_200_OK)


# ============================================================================
# ADMIN: DASHBOARD STATS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def staff_dashboard_stats(request):
    """Summary stats for admin staff management view."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    today = timezone.localtime(timezone.now()).date()

    total_teachers = StaffScheduleAssignment.objects.filter(
        school=school, is_active=True
    ).values('teacher').distinct().count()

    today_records = StaffAttendanceRecord.objects.filter(school=school, date=today)
    booked_on = today_records.filter(book_on_time__isnull=False).count()
    booked_off = today_records.filter(book_off_time__isnull=False).count()
    late_count = today_records.filter(
        Q(book_on_status='LATE') | Q(book_off_status='LATE')
    ).count()

    return Response({
        'total_assigned_teachers': total_teachers,
        'today_booked_on': booked_on,
        'today_booked_off': booked_off,
        'today_late': late_count,
        'today_no_record': total_teachers - booked_on,
        'date': today,
    }, status=status.HTTP_200_OK)


# ============================================================================
# ADMIN: UNASSIGNED TEACHERS LIST
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole, HasStaffManagement])
def unassigned_teachers(request):
    """List teachers not assigned to any active schedule group."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    from users.models import CustomUser
    assigned_ids = StaffScheduleAssignment.objects.filter(
        school=school, is_active=True
    ).values_list('teacher_id', flat=True)

    teachers = CustomUser.objects.filter(
        school=school, role='teacher', is_active=True
    ).exclude(id__in=assigned_ids).order_by('last_name', 'first_name')

    data = [{
        'id': t.id,
        'name': f"{t.first_name} {t.last_name}",
        'username': t.username,
    } for t in teachers]

    return Response(data, status=status.HTTP_200_OK)


# ============================================================================
# TEACHER: BOOK ON / BOOK OFF
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacher, HasStaffManagement])
def book_on(request):
    """
    Teacher books on. Server captures exact timestamp.
    Request body should be EMPTY — no time field accepted.
    """
    school = getattr(request, 'school', None)
    teacher = request.user
    now = timezone.now()
    today = timezone.localtime(now).date()
    current_time = timezone.localtime(now).time()

    # Get teacher's active schedule assignment
    assignment = StaffScheduleAssignment.objects.filter(
        teacher=teacher, school=school, is_active=True
    ).select_related('schedule_group').first()

    if not assignment:
        return Response(
            {'error': 'You are not assigned to any schedule group'},
            status=status.HTTP_400_BAD_REQUEST
        )

    group = assignment.schedule_group

    # Check if today is a scheduled day
    weekday = today.weekday()
    if weekday not in group.days:
        return Response(
            {'error': 'Today is not a scheduled work day for your group'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Calculate booking window
    grace = timedelta(minutes=group.grace_period_minutes)
    window_start = (datetime.combine(today, group.start_time) - grace).time()
    window_end = (datetime.combine(today, group.start_time) + grace).time()

    # Check window hasn't started yet
    if current_time < window_start:
        return Response(
            {'error': f'Booking window opens at {window_start.strftime("%H:%M")}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Determine status
    if current_time <= group.start_time:
        booking_status = 'ON_TIME'
    elif current_time <= window_end:
        booking_status = 'LATE'
    else:
        # Past the grace window entirely
        settings_obj = StaffManagementSettings.objects.filter(school=school).first()
        allow_late = settings_obj.allow_late_booking if settings_obj else True
        if not allow_late:
            return Response(
                {'error': 'Booking window has closed. Late booking is not allowed.'},
                status=status.HTTP_403_FORBIDDEN
            )
        booking_status = 'LATE'

    # Check for existing record
    existing = StaffAttendanceRecord.objects.filter(teacher=teacher, date=today).first()
    if existing and existing.book_on_time:
        return Response(
            {'error': 'You have already booked on today'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if existing:
        existing.book_on_time = now
        existing.book_on_status = booking_status
        existing.save()
    else:
        StaffAttendanceRecord.objects.create(
            school=school,
            teacher=teacher,
            date=today,
            schedule_group=group,
            scheduled_start=group.start_time,
            scheduled_end=group.end_time,
            book_on_time=now,
            book_on_status=booking_status,
        )

    return Response({
        'message': f'Booked on successfully ({booking_status.replace("_", " ").title()})',
        'book_on_time': timezone.localtime(now).strftime('%H:%M:%S'),
        'status': booking_status,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacher, HasStaffManagement])
def book_off(request):
    """
    Teacher books off. Server captures exact timestamp.
    Request body should be EMPTY — no time field accepted.
    """
    school = getattr(request, 'school', None)
    teacher = request.user
    now = timezone.now()
    today = timezone.localtime(now).date()
    current_time = timezone.localtime(now).time()

    record = StaffAttendanceRecord.objects.filter(teacher=teacher, date=today).first()
    if not record:
        return Response(
            {'error': 'You have not booked on today'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if record.book_off_time:
        return Response(
            {'error': 'You have already booked off today'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not record.book_on_time:
        return Response(
            {'error': 'You must book on before booking off'},
            status=status.HTTP_400_BAD_REQUEST
        )

    group = record.schedule_group
    if not group:
        return Response(
            {'error': 'No schedule group reference found'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Calculate book-off window
    grace = timedelta(minutes=group.grace_period_minutes)
    window_start = (datetime.combine(today, group.end_time) - grace).time()
    window_end = (datetime.combine(today, group.end_time) + grace).time()

    if current_time < window_start:
        return Response(
            {'error': f'Book-off window opens at {window_start.strftime("%H:%M")}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Determine status
    if current_time <= group.end_time:
        booking_status = 'ON_TIME'
    elif current_time <= window_end:
        booking_status = 'ON_TIME'
    else:
        settings_obj = StaffManagementSettings.objects.filter(school=school).first()
        allow_late = settings_obj.allow_late_booking if settings_obj else True
        if not allow_late:
            return Response(
                {'error': 'Book-off window has closed. Late booking is not allowed.'},
                status=status.HTTP_403_FORBIDDEN
            )
        booking_status = 'LATE'

    record.book_off_time = now
    record.book_off_status = booking_status
    record.save()

    return Response({
        'message': f'Booked off successfully ({booking_status.replace("_", " ").title()})',
        'book_off_time': timezone.localtime(now).strftime('%H:%M:%S'),
        'status': booking_status,
    }, status=status.HTTP_200_OK)


# ============================================================================
# TEACHER: MY SCHEDULE / MY RECORDS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacher, HasStaffManagement])
def my_schedule(request):
    """Get teacher's own schedule and today's booking status."""
    school = getattr(request, 'school', None)
    teacher = request.user
    now = timezone.now()
    today = timezone.localtime(now).date()

    assignment = StaffScheduleAssignment.objects.filter(
        teacher=teacher, school=school, is_active=True
    ).select_related('schedule_group').first()

    if not assignment:
        return Response({
            'has_schedule': False,
            'message': 'You are not assigned to any schedule group',
        }, status=status.HTTP_200_OK)

    group = assignment.schedule_group
    today_record = StaffAttendanceRecord.objects.filter(teacher=teacher, date=today).first()
    is_work_day = today.weekday() in group.days

    # Calculate windows for frontend display
    grace = timedelta(minutes=group.grace_period_minutes)
    book_on_window_start = (datetime.combine(today, group.start_time) - grace).time()
    book_on_window_end = (datetime.combine(today, group.start_time) + grace).time()
    book_off_window_start = (datetime.combine(today, group.end_time) - grace).time()
    book_off_window_end = (datetime.combine(today, group.end_time) + grace).time()

    return Response({
        'has_schedule': True,
        'schedule_group': {
            'name': group.name,
            'days': group.days,
            'start_time': group.start_time.strftime('%H:%M'),
            'end_time': group.end_time.strftime('%H:%M'),
            'grace_period_minutes': group.grace_period_minutes,
        },
        'today': {
            'date': today,
            'is_work_day': is_work_day,
            'book_on_time': timezone.localtime(today_record.book_on_time).strftime('%H:%M:%S') if today_record and today_record.book_on_time else None,
            'book_off_time': timezone.localtime(today_record.book_off_time).strftime('%H:%M:%S') if today_record and today_record.book_off_time else None,
            'book_on_status': today_record.book_on_status if today_record else None,
            'book_off_status': today_record.book_off_status if today_record else None,
        },
        'windows': {
            'book_on_start': book_on_window_start.strftime('%H:%M'),
            'book_on_end': book_on_window_end.strftime('%H:%M'),
            'book_off_start': book_off_window_start.strftime('%H:%M'),
            'book_off_end': book_off_window_end.strftime('%H:%M'),
        },
        'server_time': timezone.localtime(now).strftime('%H:%M:%S'),
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacher, HasStaffManagement])
def my_records(request):
    """Get teacher's own attendance history."""
    school = getattr(request, 'school', None)
    teacher = request.user

    records = StaffAttendanceRecord.objects.filter(
        teacher=teacher, school=school
    ).select_related('schedule_group').order_by('-date')[:30]

    data = [{
        'date': r.date,
        'schedule_group_name': r.schedule_group.name if r.schedule_group else 'N/A',
        'scheduled_start': r.scheduled_start.strftime('%H:%M') if r.scheduled_start else None,
        'scheduled_end': r.scheduled_end.strftime('%H:%M') if r.scheduled_end else None,
        'book_on_time': timezone.localtime(r.book_on_time).strftime('%H:%M:%S') if r.book_on_time else None,
        'book_off_time': timezone.localtime(r.book_off_time).strftime('%H:%M:%S') if r.book_off_time else None,
        'book_on_status': r.book_on_status,
        'book_off_status': r.book_off_status,
    } for r in records]

    return Response(data, status=status.HTTP_200_OK)
