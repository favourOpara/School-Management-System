from django.urls import path
from .views import (
    CreateUserView,
    TeacherSignupView,
    ParentSignupView,
    me,
    list_teachers,
    list_students,
    students_with_subjects,
    list_parents,
    UserRetrieveUpdateDestroyView,
    CustomTokenObtainPairView,
    student_history,
    individual_student_history,
    parent_attendance_report
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('create-user/', CreateUserView.as_view(), name='create-user'),
    path('teacher-signup/', TeacherSignupView.as_view(), name='teacher-signup'),
    path('parent-signup/', ParentSignupView.as_view(), name='parent-signup'),
    path('me/', me, name='me'),
    path('teachers/', list_teachers, name='list-teachers'),
    path('list-students/', list_students, name='list-students'),
    path('list-parents/', list_parents, name='list-parents'),
    path('list-teachers/', list_teachers, name='list-teachers'),
    path('students-with-subjects/', students_with_subjects, name='students-with-subjects'),
    path('<int:pk>/', UserRetrieveUpdateDestroyView.as_view(), name='user-detail'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('student-history/', student_history, name='student_history'),
    path('student-history/<int:student_id>/', individual_student_history, name='individual_student_history'),
    path('parent/attendance-report/', parent_attendance_report, name='parent_attendance_report'),
]