# academics/urls.py

from django.urls import path
from .views import (
    ClassListCreateView, ClassDetailView,
    ClassSessionListCreateView, ClassSessionDetailView,
    SubjectListCreateView, SubjectDetailView,
)

urlpatterns = [
    # Base class (e.g., "J.S.S.1")
    path('classes/', ClassListCreateView.as_view(), name='class-list-create'),
    path('classes/<int:id>/', ClassDetailView.as_view(), name='class-detail'),

    # Class sessions (e.g., "J.S.S.1 - 2024/2025 - First Term")
    path('sessions/', ClassSessionListCreateView.as_view(), name='class-session-list-create'),
    path('sessions/<int:id>/', ClassSessionDetailView.as_view(), name='class-session-detail'),

    # Subjects - both list and create now handled in one view
    path('subjects/', SubjectListCreateView.as_view(), name='subject-list-create'),
    path('subjects/<int:id>/', SubjectDetailView.as_view()),
]
# academics/urls.py

from django.urls import path
from .views import (
    ClassListCreateView, ClassDetailView,
    ClassSessionListCreateView, ClassSessionDetailView,
    SubjectListCreateView, SubjectDetailView,
)

urlpatterns = [
    # Base class (e.g., "J.S.S.1")
    path('classes/', ClassListCreateView.as_view(), name='class-list-create'),
    path('classes/<int:id>/', ClassDetailView.as_view(), name='class-detail'),

    # Class sessions (e.g., "J.S.S.1 - 2024/2025 - First Term")
    path('sessions/', ClassSessionListCreateView.as_view(), name='class-session-list-create'),
    path('sessions/<int:id>/', ClassSessionDetailView.as_view(), name='class-session-detail'),

    # Subjects - admin-only for create, list, update, delete
    path('subjects/', SubjectListCreateView.as_view(), name='subject-list-create'),
    path('subjects/<int:id>/', SubjectDetailView.as_view(), name='subject-detail'),
]
