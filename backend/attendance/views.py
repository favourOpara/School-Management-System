from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from .models import SessionCalendar, SchoolDay, HolidayLabel
from users.models import CustomUser
from academics.models import Subject, ClassSession
from attendance.models import AttendanceRecord  # assuming this model is defined
from .serializers import SessionCalendarSerializer, SchoolDaySerializer
from users.views import IsAdminRole
from datetime import datetime

class SessionCalendarCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        academic_year = request.data.get("academic_year")
        term = request.data.get("term")
        selected_dates = request.data.get("school_days", [])  # Expecting list of date strings
        holidays = request.data.get("holidays", [])  # Expecting list of {date, label}

        if not academic_year or not term or not selected_dates:
            return Response({"detail": "Missing academic_year, term or school_days"}, status=400)

        # Prevent duplicate calendar for same year + term
        if SessionCalendar.objects.filter(academic_year=academic_year, term=term).exists():
            return Response({"detail": "Calendar already exists for this academic year and term"}, status=400)

        calendar = SessionCalendar.objects.create(academic_year=academic_year, term=term)

        for date_str in selected_dates:
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                SchoolDay.objects.create(session=calendar, date=date_obj, is_school_day=True)
            except Exception as e:
                print(f"Error creating school day for {date_str}: {str(e)}")

        # Save holiday labels
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


# NEW VIEW: Retrieve attendance data for each student in a class/subject
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
                date__in=school_day_dates
            ).values_list("date", flat=True)

            missed_days = [str(d) for d in school_day_dates if d not in attended]

            last_record = AttendanceRecord.objects.filter(student=student, subject=subject).order_by('-updated_at').first()

            results.append({
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.middle_name or ''} {student.last_name}".strip(),
                "days_attended": len(attended),
                "days_missed": len(missed_days),
                "missed_dates": missed_days,
                "last_updated_by": getattr(last_record.updated_by, 'username', None),
                "last_updated_at": last_record.updated_at.strftime("%Y-%m-%d %H:%M:%S") if last_record else None
            })

        return Response(results)
