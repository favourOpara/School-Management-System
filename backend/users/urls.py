from django.urls import path
from .views import CreateUserView, TeacherSignupView, ParentSignupView 
from .views import me, list_teachers

urlpatterns = [
    path('create-user/', CreateUserView.as_view(), name='create-user'),
    path('teacher-signup/', TeacherSignupView.as_view(), name='teacher-signup'),
    path('parent-signup/', ParentSignupView.as_view(), name='parent-signup'),
    path('me/', me, name='me'),
    path('teachers/', list_teachers, name='list-teachers'),
]