from django.urls import path
from .views import (
    CreateFeeStructureView,
    ListStudentFeeRecordsView,
    ListFeeStructuresView,
    UpdateFeeStructureView,
    DeleteFeeStructureView,
    FeeStudentsView,
    update_fee_payment,
    fee_dashboard_view,
)

urlpatterns = [
    path('fees/create/', CreateFeeStructureView.as_view(), name='create-fee'),
    path('fees/records/', ListStudentFeeRecordsView.as_view(), name='list-fee-records'),
    path('fees/', ListFeeStructuresView.as_view(), name='list-fees'),
    path('fees/<int:pk>/edit/', UpdateFeeStructureView.as_view(), name='edit-fee'),
    path('fees/<int:pk>/delete/', DeleteFeeStructureView.as_view(), name='delete-fee'),
    path('fees/<int:fee_id>/students/', FeeStudentsView.as_view(), name='fee-students'),
    path('fee-records/<int:record_id>/update/', update_fee_payment, name='update-fee-record'),
    path('fees/dashboard/', fee_dashboard_view, name='fees-dashboard'),
]
