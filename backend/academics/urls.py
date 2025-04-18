from django.urls import path
from .views import ClassRoomListCreateView, ClassRoomDetailView

urlpatterns = [
    path('classes/', ClassRoomListCreateView.as_view(), name='classroom-list-create'),
    path('classes/<int:id>/', ClassRoomDetailView.as_view(), name='classroom-detail'),
]
