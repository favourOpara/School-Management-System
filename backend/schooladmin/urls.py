from django.urls import path
from .views import (
    # Fee Structure Views
    CreateFeeStructureView, ListFeeStructuresView, UpdateFeeStructureView,
    DeleteFeeStructureView, ListStudentFeeRecordsView, FeeStudentsView,
    update_fee_payment, fee_dashboard_view,
    
    # Grading Scale Views
    GradingScaleListCreateView, GradingScaleDetailView,
    
    # Grading Configuration Views
    GradingConfigurationListCreateView, GradingConfigurationDetailView,
    CopyGradingConfigurationView, 
    
    # Configuration Template Views
    ConfigurationTemplateListCreateView, ConfigurationTemplateDetailView,
    ApplyConfigurationTemplateView,
    
    # Student Grade Views
    StudentGradeListCreateView, StudentGradeDetailView,
    
    # Grading-related Attendance Views
    AttendanceRecordListCreateView, AttendanceRecordDetailView,
    
    # Grade Summary Views
    GradeSummaryListView,
    
    # Results Management Views
    get_subjects_by_session, get_subject_grades, update_student_grade, bulk_update_grades,
    
    # Attendance Sync Views
    sync_attendance_to_grades, sync_class_attendance_to_grades,
    
    # Utility Views
    calculate_grade_summaries, validate_grading_configuration, grading_dashboard, get_student_grades_view
)

urlpatterns = [
    # ============================================================================
    # FEE STRUCTURE URLS
    # ============================================================================
    path('fees/create/', CreateFeeStructureView.as_view(), name='create-fee-structure'),
    path('fees/', ListFeeStructuresView.as_view(), name='list-fee-structures'),
    path('fees/<int:pk>/update/', UpdateFeeStructureView.as_view(), name='update-fee-structure'),
    path('fees/<int:pk>/delete/', DeleteFeeStructureView.as_view(), name='delete-fee-structure'),
    path('fees/records/', ListStudentFeeRecordsView.as_view(), name='list-student-fee-records'),
    path('fees/<int:fee_id>/students/', FeeStudentsView.as_view(), name='fee-students'),
    path('fee-records/<int:record_id>/update/', update_fee_payment, name='update-fee-payment'),
    path('fees/dashboard/', fee_dashboard_view, name='fee-dashboard'),
    
    # ============================================================================
    # GRADING SCALE URLS
    # ============================================================================
    path('grading/scales/', GradingScaleListCreateView.as_view(), name='grading-scales'),
    path('grading/scales/<int:pk>/', GradingScaleDetailView.as_view(), name='grading-scale-detail'),
    
    # ============================================================================
    # GRADING CONFIGURATION URLS
    # ============================================================================
    path('grading/configurations/', GradingConfigurationListCreateView.as_view(), name='grading-configurations'),
    path('grading/configurations/<int:pk>/', GradingConfigurationDetailView.as_view(), name='grading-configuration-detail'),
    path('grading/configurations/copy/', CopyGradingConfigurationView.as_view(), name='copy-grading-configuration'),

    # ============================================================================
    # CONFIGURATION TEMPLATE URLS
    # ============================================================================
    path('grading/templates/', ConfigurationTemplateListCreateView.as_view(), name='configuration-template-list-create'),
    path('grading/templates/<int:pk>/', ConfigurationTemplateDetailView.as_view(), name='configuration-template-detail'),
    path('grading/templates/apply/', ApplyConfigurationTemplateView.as_view(), name='apply-configuration-template'),
    
    # ============================================================================
    # STUDENT GRADE URLS
    # ============================================================================
    path('grading/student-grades/', StudentGradeListCreateView.as_view(), name='student-grade-list-create'),
    path('grading/student-grades/<int:pk>/', StudentGradeDetailView.as_view(), name='student-grade-detail'),

    # ============================================================================
    # GRADING-RELATED ATTENDANCE URLS
    # ============================================================================
    path('attendance/', AttendanceRecordListCreateView.as_view(), name='attendance-records'),
    path('attendance/<int:pk>/', AttendanceRecordDetailView.as_view(), name='attendance-record-detail'),
    
    # ============================================================================
    # GRADE SUMMARY URLS
    # ============================================================================
    path('grading/summaries/', GradeSummaryListView.as_view(), name='grade-summaries'),
    
    # ============================================================================
    # RESULTS MANAGEMENT URLS (NEW - FOR ADMIN RESULTS VIEWING/EDITING)
    # ============================================================================
    path('results/subjects/', get_subjects_by_session, name='get-subjects-by-session'),
    path('results/subjects/<int:subject_id>/grades/', get_subject_grades, name='get-subject-grades'),
    path('results/grade-summary/<int:grade_summary_id>/', update_student_grade, name='update-student-grade'),
    path('results/bulk-update/', bulk_update_grades, name='bulk-update-grades'),
    
    # ============================================================================
    # ATTENDANCE SYNC URLS (NEW - SYNC ATTENDANCE TO GRADES)
    # ============================================================================
    path('results/sync-attendance/', sync_attendance_to_grades, name='sync-attendance-to-grades'),
    path('results/sync-class-attendance/', sync_class_attendance_to_grades, name='sync-class-attendance-to-grades'),
    
    # ============================================================================
    # UTILITY URLS
    # ============================================================================
    path('grading/calculate/', calculate_grade_summaries, name='calculate-grade-summaries'),
    path('grading/validate/', validate_grading_configuration, name='validate-grading-configuration'),
    path('grading/dashboard/', grading_dashboard, name='grading-dashboard'),
    path('student/grades/', get_student_grades_view, name='student-grades-view'),
]