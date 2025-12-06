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
    student_attendance_report,
    parent_attendance_report,
    parent_grade_report,
    student_grade_report,
    upload_avatar,
    remove_avatar,
    get_current_user_profile,
    change_admin_username,
    change_admin_password,
    change_password,
    initialize_admin,
    initialize_admin_2,
    initialize_admin_3,
    initialize_admin_4
)
from .verification_views import (
    verify_email,
    verify_and_change_password,
    resend_verification_email,
    forgot_password,
    reset_password
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
    path('student/attendance-report/', student_attendance_report, name='student_attendance_report'),
    path('parent/attendance-report/', parent_attendance_report, name='parent_attendance_report'),
    path('parent/grade-report/', parent_grade_report, name='parent_grade_report'),
    path('student/grade-report/', student_grade_report, name='student_grade_report'),
    path('profile/', get_current_user_profile, name='user_profile'),
    path('avatar/upload/', upload_avatar, name='upload_avatar'),
    path('avatar/remove/', remove_avatar, name='remove_avatar'),
    path('admin/change-username/', change_admin_username, name='change_admin_username'),
    path('admin/change-password/', change_admin_password, name='change_admin_password'),
    path('change-password/', change_password, name='change_password'),
    path('initialize-admin/', initialize_admin, name='initialize_admin'),
    path('initialize-admin-2/', initialize_admin_2, name='initialize_admin_2'),
    path('initialize-admin-3/', initialize_admin_3, name='initialize_admin_3'),
    path('initialize-admin-4/', initialize_admin_4, name='initialize_admin_4'),

    # Email verification endpoints
    path('verify-email/<str:token>/', verify_email, name='verify_email'),
    path('verify-and-change-password/<str:token>/', verify_and_change_password, name='verify_and_change_password'),
    path('resend-verification/', resend_verification_email, name='resend_verification'),

    # Password reset endpoints
    path('forgot-password/', forgot_password, name='forgot_password'),
    path('reset-password/<str:token>/', reset_password, name='reset_password'),
]