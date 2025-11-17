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
    calculate_grade_summaries, validate_grading_configuration, grading_dashboard, get_student_grades_view,

    # Teacher Manual Grading Views
    get_teacher_subjects_for_grading, get_students_for_manual_grading, save_manual_grades,

    # Analytics Views
    get_test_completion_stats, get_class_subjects_for_tests, get_subject_test_scores,
    update_test_score, unlock_test_scores,

    # Exam Completion Analytics Views
    get_exam_completion_stats, get_class_subjects_for_exams, get_subject_exam_scores, update_exam_score,

    # Report Sheet Views
    get_students_for_report, get_report_sheet,

    # Report Access Analytics Views
    get_report_access_stats, send_report_sheets, get_eligible_classes_for_reports,
    get_eligible_students_in_class, send_individual_report,

    # Incomplete Grades Analytics Views
    get_incomplete_grades_classes, get_incomplete_grades_students, search_incomplete_grades_students,
    send_incomplete_grade_notification, send_bulk_incomplete_grade_notifications,

    # Unpaid Fees Analytics Views
    get_unpaid_fees_classes, get_unpaid_fees_students, search_unpaid_fees_students,
    send_unpaid_fee_notification, send_bulk_unpaid_fee_notifications,

    # Both Issues (Unpaid Fees + Incomplete Grades) Analytics Views
    get_both_issues_classes, get_both_issues_students,
    send_both_issues_notification, send_bulk_both_issues_notifications,

    # Reports Sent Analytics Views
    get_reports_sent_stats, get_class_report_sent_students,

    # Subject Grading Completion Analytics Views
    get_subject_grading_stats, get_subject_incomplete_students, notify_teachers_incomplete_grades,

    # Student Dashboard Views
    get_class_attendance_ranking
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

    # ============================================================================
    # TEACHER MANUAL GRADING URLS
    # ============================================================================
    path('teacher/grading/subjects/', get_teacher_subjects_for_grading, name='teacher-grading-subjects'),
    path('teacher/grading/subjects/<int:subject_id>/students/', get_students_for_manual_grading, name='students-for-manual-grading'),
    path('teacher/grading/subjects/<int:subject_id>/save/', save_manual_grades, name='save-manual-grades'),

    # ============================================================================
    # ANALYTICS URLS
    # ============================================================================
    path('analytics/tests/', get_test_completion_stats, name='test-completion-stats'),
    path('analytics/tests/class/<int:class_session_id>/subjects/', get_class_subjects_for_tests, name='class-subjects-for-tests'),
    path('analytics/tests/subject/<int:subject_id>/scores/', get_subject_test_scores, name='subject-test-scores'),
    path('analytics/tests/scores/update/', update_test_score, name='update-test-score'),
    path('analytics/tests/scores/unlock/', unlock_test_scores, name='unlock-test-scores'),

    # ============================================================================
    # EXAM COMPLETION ANALYTICS URLS
    # ============================================================================
    path('analytics/exams/', get_exam_completion_stats, name='exam-completion-stats'),
    path('analytics/exams/class/<int:class_session_id>/subjects/', get_class_subjects_for_exams, name='class-subjects-for-exams'),
    path('analytics/exams/subject/<int:subject_id>/scores/', get_subject_exam_scores, name='subject-exam-scores'),
    path('analytics/exams/scores/update/', update_exam_score, name='update-exam-score'),

    # ============================================================================
    # REPORT ACCESS ANALYTICS URLS
    # ============================================================================
    path('analytics/report-access/', get_report_access_stats, name='report-access-stats'),
    path('analytics/report-access/send/', send_report_sheets, name='send-report-sheets'),
    path('analytics/report-access/classes/', get_eligible_classes_for_reports, name='eligible-classes-for-reports'),
    path('analytics/report-access/class/<int:class_session_id>/students/', get_eligible_students_in_class, name='eligible-students-in-class'),
    path('analytics/report-access/send-individual/', send_individual_report, name='send-individual-report'),

    # Incomplete grades endpoints
    path('analytics/incomplete-grades/classes/', get_incomplete_grades_classes, name='incomplete-grades-classes'),
    path('analytics/incomplete-grades/class/<int:class_session_id>/students/', get_incomplete_grades_students, name='incomplete-grades-students'),
    path('analytics/incomplete-grades/search/', search_incomplete_grades_students, name='search-incomplete-grades-students'),
    path('analytics/incomplete-grades/notify/', send_incomplete_grade_notification, name='send-incomplete-grade-notification'),
    path('analytics/incomplete-grades/notify-all/', send_bulk_incomplete_grade_notifications, name='send-bulk-incomplete-grade-notifications'),

    # Unpaid fees endpoints
    path('analytics/unpaid-fees/classes/', get_unpaid_fees_classes, name='unpaid-fees-classes'),
    path('analytics/unpaid-fees/class/<int:class_session_id>/students/', get_unpaid_fees_students, name='unpaid-fees-students'),
    path('analytics/unpaid-fees/search/', search_unpaid_fees_students, name='search-unpaid-fees-students'),
    path('analytics/unpaid-fees/notify/', send_unpaid_fee_notification, name='send-unpaid-fee-notification'),
    path('analytics/unpaid-fees/notify-all/', send_bulk_unpaid_fee_notifications, name='send-bulk-unpaid-fee-notifications'),

    # Both issues (unpaid fees + incomplete grades) endpoints
    path('analytics/both-issues/classes/', get_both_issues_classes, name='both-issues-classes'),
    path('analytics/both-issues/class/<int:class_session_id>/students/', get_both_issues_students, name='both-issues-students'),
    path('analytics/both-issues/notify/', send_both_issues_notification, name='send-both-issues-notification'),
    path('analytics/both-issues/notify-all/', send_bulk_both_issues_notifications, name='send-bulk-both-issues-notifications'),

    # Reports sent by class endpoints
    path('analytics/reports-sent/', get_reports_sent_stats, name='reports-sent-stats'),
    path('analytics/reports-sent/class/<int:class_session_id>/students/', get_class_report_sent_students, name='class-report-sent-students'),

    # Subject grading completion endpoints
    path('analytics/subject-grading/', get_subject_grading_stats, name='subject-grading-stats'),
    path('analytics/subject-grading/<int:subject_id>/incomplete/', get_subject_incomplete_students, name='subject-incomplete-students'),
    path('analytics/subject-grading/notify-teachers/', notify_teachers_incomplete_grades, name='notify-teachers-incomplete-grades'),

    # ============================================================================
    # REPORT SHEET URLS
    # ============================================================================
    path('reports/students/', get_students_for_report, name='get-students-for-report'),
    path('reports/student/<int:student_id>/', get_report_sheet, name='get-report-sheet'),

    # ============================================================================
    # STUDENT DASHBOARD URLS
    # ============================================================================
    path('student/dashboard/attendance-ranking/', get_class_attendance_ranking, name='student-attendance-ranking'),
]