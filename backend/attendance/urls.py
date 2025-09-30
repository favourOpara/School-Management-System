from django.urls import path
from .views import (
    # Original attendance views
    SessionCalendarCreateView, SessionCalendarListView, StudentAttendanceRecordView,
    
    # Attendance calendar views (for React components)
    list_attendance_calendars, create_attendance_calendar, 
    update_attendance_calendar, delete_attendance_calendar
)

urlpatterns = [
    # Original attendance URLs
    path('session-calendar/create/', SessionCalendarCreateView.as_view(), name='create-session-calendar'),
    path('session-calendar/', SessionCalendarListView.as_view(), name='list-session-calendars'),
    path('records/', StudentAttendanceRecordView.as_view(), name='student-attendance-records'),
    
    # Attendance calendar URLs (for React components)
    path('calendar/', list_attendance_calendars, name='list-attendance-calendars'),
    path('calendar/create/', create_attendance_calendar, name='create-attendance-calendar'),
    path('calendar/update/', update_attendance_calendar, name='update-attendance-calendar'),
    path('calendar/delete/', delete_attendance_calendar, name='delete-attendance-calendar'),
]