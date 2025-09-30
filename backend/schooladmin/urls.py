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
    
    # Grading-related Attendance Views (keep these)
    AttendanceRecordListCreateView, AttendanceRecordDetailView,
    
    # Grade Summary Views
    GradeSummaryListView,
    
    # Utility Views
    calculate_grade_summaries, validate_grading_configuration, grading_dashboard
)

urlpatterns = [
    # Fee Structure URLs
    path('fees/create/', CreateFeeStructureView.as_view(), name='create-fee-structure'),
    path('fees/', ListFeeStructuresView.as_view(), name='list-fee-structures'),
    path('fees/<int:pk>/update/', UpdateFeeStructureView.as_view(), name='update-fee-structure'),
    path('fees/<int:pk>/delete/', DeleteFeeStructureView.as_view(), name='delete-fee-structure'),
    path('fees/records/', ListStudentFeeRecordsView.as_view(), name='list-student-fee-records'),
    path('fees/<int:fee_id>/students/', FeeStudentsView.as_view(), name='fee-students'),
    path('fees/records/<int:record_id>/update-payment/', update_fee_payment, name='update-fee-payment'),
    path('fees/dashboard/', fee_dashboard_view, name='fee-dashboard'),
    
    # Grading Scale URLs
    path('grading/scales/', GradingScaleListCreateView.as_view(), name='grading-scales'),
    path('grading/scales/<int:pk>/', GradingScaleDetailView.as_view(), name='grading-scale-detail'),
    
    # Grading Configuration URLs
    path('grading/configurations/', GradingConfigurationListCreateView.as_view(), name='grading-configurations'),
    path('grading/configurations/<int:pk>/', GradingConfigurationDetailView.as_view(), name='grading-configuration-detail'),
    path('grading/configurations/copy/', CopyGradingConfigurationView.as_view(), name='copy-grading-configuration'),

    # Configuration Template URLs
    path('grading/templates/', ConfigurationTemplateListCreateView.as_view(), name='configuration-template-list-create'),
    path('grading/templates/<int:pk>/', ConfigurationTemplateDetailView.as_view(), name='configuration-template-detail'),
    path('grading/templates/apply/', ApplyConfigurationTemplateView.as_view(), name='apply-configuration-template'),
    
    # Student Grade URLs    
    path('grading/student-grades/', StudentGradeListCreateView.as_view(), name='student-grade-list-create'),
    path('grading/student-grades/<int:pk>/', StudentGradeDetailView.as_view(), name='student-grade-detail'),

    # Grading-related Attendance URLs (keep these)
    path('attendance/', AttendanceRecordListCreateView.as_view(), name='attendance-records'),
    path('attendance/<int:pk>/', AttendanceRecordDetailView.as_view(), name='attendance-record-detail'),
    
    # Grade Summary URLs
    path('grading/summaries/', GradeSummaryListView.as_view(), name='grade-summaries'),
    
    # Utility URLs
    path('grading/calculate/', calculate_grade_summaries, name='calculate-grade-summaries'),
    path('grading/validate/', validate_grading_configuration, name='validate-grading-configuration'),
    path('grading/dashboard/', grading_dashboard, name='grading-dashboard'),
]