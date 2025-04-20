# academics/urls.py
from django.urls import path
from .views import (
    ClassListCreateView, ClassDetailView,
    ClassSessionListCreateView, ClassSessionDetailView,
    SubjectCreateView, SubjectListView
)

urlpatterns = [
    # Base class (e.g., "J.S.S.1")
    path('classes/', ClassListCreateView.as_view(), name='class-list-create'),
    path('classes/<int:id>/', ClassDetailView.as_view(), name='class-detail'),

    # Class sessions (e.g., "J.S.S.1 - 2024/2025 - First Term")
    path('sessions/', ClassSessionListCreateView.as_view(), name='class-session-list-create'),
    path('sessions/<int:id>/', ClassSessionDetailView.as_view(), name='class-session-detail'),

    # Subjects
    path('subjects/', SubjectListView.as_view(), name='subject-list'),
    path('subjects/create/', SubjectCreateView.as_view(), name='subject-create'),
]
