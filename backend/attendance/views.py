from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.db import transaction
from datetime import datetime

from .models import (
    SessionCalendar, SchoolDay, HolidayLabel, AttendanceRecord,
    AttendanceCalendar, AttendanceSchoolDay, AttendanceHolidayLabel
)
from users.models import CustomUser
from academics.models import Subject, ClassSession
from .serializers import (
    SessionCalendarSerializer, SchoolDaySerializer, AttendanceRecordSerializer
)
from users.views import IsAdminRole

# ORIGINAL ATTENDANCE VIEWS
class SessionCalendarCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        academic_year = request.data.get("academic_year")
        term = request.data.get("term")
        selected_dates = request.data.get("school_days", [])
        holidays = request.data.get("holidays", [])

        if not academic_year or not term or not selected_dates:
            return Response({"detail": "Missing academic_year, term or school_days"}, status=400)

        if SessionCalendar.objects.filter(academic_year=academic_year, term=term).exists():
            return Response({"detail": "Calendar already exists for this academic year and term"}, status=400)

        calendar = SessionCalendar.objects.create(academic_year=academic_year, term=term)

        for date_str in selected_dates:
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                SchoolDay.objects.create(session=calendar, date=date_obj, is_school_day=True)
            except Exception as e:
                print(f"Error creating school day for {date_str}: {str(e)}")

        for h in holidays:
            try:
                date_obj = datetime.strptime(h['date'], "%Y-%m-%d").date()
                school_day = SchoolDay.objects.get(session=calendar, date=date_obj)
                HolidayLabel.objects.create(school_day=school_day, label=h['label'])
            except Exception as e:
                print(f"Error labeling holiday for {h['date']}: {str(e)}")

        return Response({"message": "Session calendar created successfully"}, status=201)


class SessionCalendarListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = SessionCalendarSerializer
    queryset = SessionCalendar.objects.all()


class StudentAttendanceRecordView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        academic_year = request.query_params.get("academic_year")
        term = request.query_params.get("term")
        class_id = request.query_params.get("class_id")
        subject_id = request.query_params.get("subject_id")

        if not all([academic_year, term, class_id, subject_id]):
            return Response({"detail": "Missing required parameters"}, status=400)

        try:
            class_session = ClassSession.objects.get(classroom__id=class_id, academic_year=academic_year, term=term)
            subject = Subject.objects.get(id=subject_id, class_session=class_session)
        except ClassSession.DoesNotExist:
            return Response({"detail": "Class session not found"}, status=404)
        except Subject.DoesNotExist:
            return Response({"detail": "Subject not found"}, status=404)

        students = CustomUser.objects.filter(role="student", classroom__id=class_id, academic_year=academic_year)

        school_days = SchoolDay.objects.filter(session__academic_year=academic_year, session__term=term, is_school_day=True)
        school_day_dates = [d.date for d in school_days]

        results = []

        for student in students:
            attended = AttendanceRecord.objects.filter(
                student=student,
                subject=subject,
                school_day__date__in=school_day_dates
            ).values_list("school_day__date", flat=True)

            missed_days = [str(d) for d in school_day_dates if d not in attended]

            last_record = AttendanceRecord.objects.filter(student=student, subject=subject).order_by('-marked_at').first()

            results.append({
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.middle_name or ''} {student.last_name}".strip(),
                "days_attended": len(attended),
                "days_missed": len(missed_days),
                "missed_dates": missed_days,
                "last_updated_by": getattr(last_record.marked_by, 'username', None) if last_record else None,
                "last_updated_at": last_record.marked_at.strftime("%Y-%m-%d %H:%M:%S") if last_record else None
            })

        return Response(results)


# ATTENDANCE CALENDAR VIEWS (for React components)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_attendance_calendars(request):
    """List all attendance calendars - used by ViewAttendance.jsx"""
    try:
        calendars = AttendanceCalendar.objects.all().order_by('-academic_year', 'term')
        
        calendar_data = []
        for calendar in calendars:
            school_days = []
            
            for school_day in calendar.school_days.all():
                school_days.append({
                    'date': school_day.date.strftime('%Y-%m-%d'),
                    'holiday_label': None
                })
            
            for holiday in calendar.holidays.all():
                school_days.append({
                    'date': holiday.date.strftime('%Y-%m-%d'),
                    'holiday_label': {'label': holiday.label}
                })
            
            class_sessions = list(calendar.class_sessions.values_list('id', flat=True))
            
            calendar_data.append({
                'id': calendar.id,
                'academic_year': calendar.academic_year,
                'term': calendar.term,
                'school_days': school_days,
                'class_sessions': class_sessions,
                'total_school_days': calendar.get_total_school_days(),
                'total_holidays': calendar.get_total_holidays(),
                'created_at': calendar.created_at.isoformat(),
                'updated_at': calendar.updated_at.isoformat()
            })
        
        return Response(calendar_data)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to retrieve calendars: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def create_attendance_calendar(request):
    """Create a new attendance calendar - used by React components"""
    academic_year = request.data.get('academic_year')
    term = request.data.get('term')
    school_days = request.data.get('school_days', [])
    holidays = request.data.get('holidays', [])
    
    if not academic_year or not term:
        return Response(
            {'error': 'academic_year and term are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if AttendanceCalendar.objects.filter(academic_year=academic_year, term=term).exists():
        return Response(
            {'error': f'Calendar for {academic_year} - {term} already exists'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        with transaction.atomic():
            calendar = AttendanceCalendar.objects.create(
                academic_year=academic_year,
                term=term,
                created_by=request.user
            )
            
            matching_sessions = ClassSession.objects.filter(
                academic_year=academic_year,
                term=term
            )
            calendar.class_sessions.set(matching_sessions)
            
            for day_str in school_days:
                try:
                    day_date = datetime.strptime(day_str, '%Y-%m-%d').date()
                    AttendanceSchoolDay.objects.create(
                        calendar=calendar,
                        date=day_date
                    )
                except ValueError:
                    return Response(
                        {'error': f'Invalid date format: {day_str}. Use YYYY-MM-DD'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            for holiday in holidays:
                try:
                    holiday_date = datetime.strptime(holiday['date'], '%Y-%m-%d').date()
                    AttendanceHolidayLabel.objects.create(
                        calendar=calendar,
                        date=holiday_date,
                        label=holiday['label']
                    )
                except (ValueError, KeyError):
                    return Response(
                        {'error': f'Invalid holiday format: {holiday}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            return Response({
                'message': 'Attendance calendar created successfully',
                'calendar': {
                    'id': calendar.id,
                    'academic_year': calendar.academic_year,
                    'term': calendar.term,
                    'school_days_count': len(school_days),
                    'holidays_count': len(holidays),
                    'linked_class_sessions': calendar.class_sessions.count(),
                    'created_at': calendar.created_at.isoformat()
                }
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response(
            {'error': f'Failed to create calendar: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT'])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_attendance_calendar(request):
    """Update an existing attendance calendar - used by EditAttendanceCalendar.jsx"""
    academic_year = request.data.get('academic_year')
    term = request.data.get('term')
    school_days = request.data.get('school_days', [])
    holidays = request.data.get('holidays', [])
    
    if not academic_year or not term:
        return Response(
            {'error': 'academic_year and term are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        calendar = AttendanceCalendar.objects.get(
            academic_year=academic_year, 
            term=term
        )
    except AttendanceCalendar.DoesNotExist:
        return Response(
            {'error': f'Calendar for {academic_year} - {term} not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        with transaction.atomic():
            # Instead of deleting all and recreating, do a smart update:
            # 1. Parse incoming dates
            incoming_school_days = set()
            for day_str in school_days:
                try:
                    day_date = datetime.strptime(day_str, '%Y-%m-%d').date()
                    incoming_school_days.add(day_date)
                except ValueError:
                    return Response(
                        {'error': f'Invalid date format: {day_str}. Use YYYY-MM-DD'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Get existing school days
            existing_school_days = set(
                calendar.school_days.values_list('date', flat=True)
            )

            # Add new school days
            dates_to_add = incoming_school_days - existing_school_days
            for date_to_add in dates_to_add:
                AttendanceSchoolDay.objects.create(
                    calendar=calendar,
                    date=date_to_add
                )

            # Remove school days that are no longer in the list
            dates_to_remove = existing_school_days - incoming_school_days
            calendar.school_days.filter(date__in=dates_to_remove).delete()

            created_dates = incoming_school_days

            # Handle holidays similarly
            incoming_holidays = {}
            for holiday in holidays:
                try:
                    holiday_date = datetime.strptime(holiday['date'], '%Y-%m-%d').date()
                    incoming_holidays[holiday_date] = holiday['label']
                except (ValueError, KeyError):
                    return Response(
                        {'error': f'Invalid holiday format: {holiday}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Get existing holidays
            existing_holidays = {
                h.date: h for h in calendar.holidays.all()
            }

            # Add new holidays
            for holiday_date, label in incoming_holidays.items():
                if holiday_date not in existing_holidays:
                    AttendanceHolidayLabel.objects.create(
                        calendar=calendar,
                        date=holiday_date,
                        label=label
                    )
                else:
                    # Update label if changed
                    if existing_holidays[holiday_date].label != label:
                        existing_holidays[holiday_date].label = label
                        existing_holidays[holiday_date].save()

            # Remove holidays that are no longer in the list
            holidays_to_remove = set(existing_holidays.keys()) - set(incoming_holidays.keys())
            calendar.holidays.filter(date__in=holidays_to_remove).delete()

            created_holiday_dates = incoming_holidays
            
            matching_sessions = ClassSession.objects.filter(
                academic_year=academic_year,
                term=term
            )
            calendar.class_sessions.set(matching_sessions)
            
            calendar.save()
            
            return Response({
                'message': 'Attendance calendar updated successfully',
                'calendar': {
                    'id': calendar.id,
                    'academic_year': calendar.academic_year,
                    'term': calendar.term,
                    'school_days_count': len(created_dates),
                    'holidays_count': len(created_holiday_dates),
                    'linked_class_sessions': calendar.class_sessions.count(),
                    'updated_at': calendar.updated_at.isoformat()
                }
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response(
            {'error': f'Failed to update calendar: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsAdminRole])
def delete_attendance_calendar(request):
    """
    Delete an attendance calendar and CASCADE delete all related attendance records
    - used by EditAttendanceCalendar.jsx

    WARNING: This is a DESTRUCTIVE operation that will:
    1. Delete all attendance records (schooladmin.AttendanceRecord) for this session
    2. Delete all attendance-related grades (StudentGrade)
    3. Reset attendance scores in GradeSummary to 0
    4. Delete the calendar and all its school days and holidays

    This should ONLY be used if you want to completely remove historical data.
    For normal session transitions, DO NOT delete old calendars - create new ones instead.
    """
    academic_year = request.data.get('academic_year')
    term = request.data.get('term')
    
    if not academic_year or not term:
        return Response(
            {'error': 'academic_year and term are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        calendar = AttendanceCalendar.objects.get(
            academic_year=academic_year, 
            term=term
        )
    except AttendanceCalendar.DoesNotExist:
        return Response(
            {'error': f'Calendar for {academic_year} - {term} not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        with transaction.atomic():
            # Collect statistics before deletion
            calendar_info = {
                'academic_year': calendar.academic_year,
                'term': calendar.term,
                'school_days_count': calendar.school_days.count(),
                'holidays_count': calendar.holidays.count(),
                'linked_class_sessions': calendar.class_sessions.count()
            }
            
            # CASCADE DELETE: Remove all schooladmin AttendanceRecords for this academic session
            # Import here to avoid circular imports
            from schooladmin.models import AttendanceRecord as SchoolAdminAttendanceRecord
            from schooladmin.models import StudentGrade, GradeSummary
            
            # Get all class sessions for this academic year and term
            class_sessions = ClassSession.objects.filter(
                academic_year=academic_year,
                term=term
            )
            
            # Count records before deletion for reporting
            attendance_records_count = SchoolAdminAttendanceRecord.objects.filter(
                class_session__in=class_sessions
            ).count()
            
            # Delete all attendance records for these sessions
            deleted_attendance = SchoolAdminAttendanceRecord.objects.filter(
                class_session__in=class_sessions
            ).delete()
            
            # CASCADE DELETE: Remove attendance-related grades
            # Delete StudentGrade records where component_type is 'attendance'
            from schooladmin.models import GradeComponent
            attendance_components = GradeComponent.objects.filter(
                grading_config__academic_year=academic_year,
                grading_config__term=term,
                component_type='attendance'
            )
            
            deleted_grades = StudentGrade.objects.filter(
                component__in=attendance_components
            ).delete()
            
            # CASCADE DELETE: Reset attendance scores in GradeSummary
            # Find all grade summaries for this session and reset attendance_score to 0
            grade_summaries = GradeSummary.objects.filter(
                grading_config__academic_year=academic_year,
                grading_config__term=term
            )
            
            updated_summaries_count = 0
            for summary in grade_summaries:
                summary.attendance_score = 0
                summary.recalculate_total_score()
                summary.save()
                updated_summaries_count += 1
            
            # Now delete the calendar itself (this will cascade delete school_days and holidays)
            calendar.delete()
            
            calendar_info['deleted_attendance_records'] = attendance_records_count
            calendar_info['deleted_attendance_grades'] = deleted_grades[0] if deleted_grades else 0
            calendar_info['updated_grade_summaries'] = updated_summaries_count
            
            return Response({
                'message': f'Attendance calendar for {academic_year} - {term} deleted successfully',
                'deleted_calendar': calendar_info,
                'cascade_info': {
                    'attendance_records_deleted': attendance_records_count,
                    'attendance_grades_deleted': deleted_grades[0] if deleted_grades else 0,
                    'grade_summaries_reset': updated_summaries_count
                }
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response(
            {'error': f'Failed to delete calendar: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )