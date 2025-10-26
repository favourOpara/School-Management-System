# academics/urls.py

from django.urls import path
from .views import (
    ClassListCreateView, ClassDetailView,
    ClassSessionListCreateView, ClassSessionDetailView,
    SubjectListCreateView, SubjectListView, SubjectDetailView,
    SessionInheritanceView, TeacherAssignedSubjectsView, TeacherSubjectStudentsView,
    SubjectContentCreateView, TeacherSubjectContentView, TeacherContentDetailView,
    SubjectContentListView, SessionStudentsView, StudentAssignmentListView,
    StudentAssignmentDetailView,
    SubmitAssignmentView,
    StudentSubmissionDetailView,
    StudentSubmissionListView,
    delete_submission,
    get_student_submissions,
    grade_submission,
    release_grade
)

urlpatterns = [
    # Base class (e.g., "J.S.S.1")
    path('classes/', ClassListCreateView.as_view(), name='class-list-create'),
    path('classes/<int:id>/', ClassDetailView.as_view(), name='class-detail'),

    # Class sessions (e.g., "J.S.S.1 - 2024/2025 - First Term")
    path('sessions/', ClassSessionListCreateView.as_view(), name='class-session-list-create'),
    path('sessions/<int:id>/', ClassSessionDetailView.as_view(), name='class-session-detail'),
    
    # Session students - for attendance marking
    path('session-students/<int:session_id>/', SessionStudentsView.as_view(), name='session-students'),
    
    # Session inheritance - copy students/subjects from previous sessions
    path('sessions/inherit/', SessionInheritanceView.as_view(), name='session-inheritance'),

    # Subjects - admin-only for create/update/delete, authenticated for list view
    path('subjects/', SubjectListCreateView.as_view(), name='subject-list-create'),
    path('subjects/list/', SubjectListView.as_view(), name='subject-list'),
    path('subjects/<int:id>/', SubjectDetailView.as_view(), name='subject-detail'),
    
    # Teacher-only endpoints
    path('teacher/assigned-subjects/', TeacherAssignedSubjectsView.as_view(), name='teacher-assigned-subjects'),
    path('teacher/subjects/<int:subject_id>/students/', TeacherSubjectStudentsView.as_view(), name='teacher-subject-students'),
    
    # Subject content management - teacher endpoints
    path('teacher/content/create/', SubjectContentCreateView.as_view(), name='teacher-content-create'),
    path('teacher/subjects/<int:subject_id>/content/', TeacherSubjectContentView.as_view(), name='teacher-subject-content'),
    path('teacher/content/<int:content_id>/', TeacherContentDetailView.as_view(), name='teacher-content-detail'),
    
    # Subject content viewing - for students/admins (future use)
    path('subjects/<int:subject_id>/content/', SubjectContentListView.as_view(), name='subject-content-list'),

    # Student assignment submission
    path('student/assignments/', StudentAssignmentListView.as_view(), name='student-assignments'),
    path('student/assignments/<int:pk>/', StudentAssignmentDetailView.as_view(), name='student-assignment-detail'),
    path('student/assignments/submit/', SubmitAssignmentView.as_view(), name='submit-assignment'),
    path('student/submissions/', StudentSubmissionListView.as_view(), name='student-submissions'),
    path('student/submissions/<int:pk>/', StudentSubmissionDetailView.as_view(), name='student-submission-detail'),
    path('student/submissions/<int:submission_id>/delete/', delete_submission, name='delete-submission'),
    
    # Teacher submission viewing and grading (NEW)
    path('student/<int:student_id>/submissions/', get_student_submissions, name='student-submissions-view'),
    path('submission/<int:submission_id>/grade/', grade_submission, name='grade-submission'),
    path('submission/<int:submission_id>/release/', release_grade, name='release-grade'),
]