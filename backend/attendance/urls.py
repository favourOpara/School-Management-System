from django.urls import path
from .views import SessionCalendarCreateView, SessionCalendarListView, StudentAttendanceRecordView

urlpatterns = [
    path('calendar/create/', SessionCalendarCreateView.as_view(), name='create-calendar'),
    path('calendar/', SessionCalendarListView.as_view(), name='list-calendars'),
    path('records/', StudentAttendanceRecordView.as_view(), name='student-attendance-records'),
]
