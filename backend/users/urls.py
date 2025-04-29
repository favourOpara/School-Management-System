from django.urls import path
from .views import CreateUserView, TeacherSignupView, ParentSignupView 
from .views import me, list_teachers, list_students, list_teachers,  students_with_subjects, list_parents, UserRetrieveUpdateDestroyView

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
]