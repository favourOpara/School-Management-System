from django.urls import path
from .views import CreateUserView, TeacherSignupView, ParentSignupView 
from .views import me

urlpatterns = [
    path('create-user/', CreateUserView.as_view(), name='create-user'),
    path('teacher-signup/', TeacherSignupView.as_view(), name='teacher-signup'),
    path('parent-signup/', ParentSignupView.as_view(), name='parent-signup'),
    path('me/', me, name='me'),
]