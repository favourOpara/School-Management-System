from django.urls import path
from .views import (
    get_users_by_role,
    get_students_by_class,
)

urlpatterns = [
    path('list-users/', get_users_by_role, name='list-users'),
    path('class-students/', get_students_by_class, name='class-students'),
]
