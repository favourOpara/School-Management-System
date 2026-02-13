"""
URL configuration for tenants app.
"""
from django.urls import path
from . import views
from . import proprietor_views
from . import platform_views
from .webhooks import paystack_webhook

# Public URLs (no authentication required)
public_urlpatterns = [
    path('plans/', views.PublicPlanListView.as_view(), name='public-plans'),
    path('school/<slug:slug>/', views.PublicSchoolInfoView.as_view(), name='public-school-info'),
    path('check-slug/<slug:slug>/', views.SlugCheckView.as_view(), name='check-slug'),
    path('register/', views.SchoolRegistrationView.as_view(), name='school-registration'),
    path('contact-sales/', views.ContactSalesView.as_view(), name='contact-sales'),
    path('verify-payment/<str:reference>/', views.PublicVerifyPaymentView.as_view(), name='public-verify-payment'),
]

# Webhook URLs
webhook_urlpatterns = [
    path('paystack/', paystack_webhook, name='paystack-webhook'),
]

# School-scoped URLs (authentication required)
# These will be mounted under /api/<school_slug>/
school_urlpatterns = [
    # School info
    path('school/', views.SchoolDetailView.as_view(), name='school-detail'),
    path('school/update/', views.SchoolUpdateView.as_view(), name='school-update'),
    path('school/configuration/', views.SchoolConfigurationView.as_view(), name='school-configuration'),

    # Subscription management
    path('subscription/', views.SubscriptionDetailView.as_view(), name='subscription-detail'),
    path('subscription/plans/', views.SubscriptionPlansView.as_view(), name='subscription-plans'),
    path('subscription/upgrade/', views.UpgradePlanView.as_view(), name='subscription-upgrade'),
    path('subscription/cancel/', views.CancelSubscriptionView.as_view(), name='subscription-cancel'),

    # Billing
    path('billing/history/', views.PaymentHistoryView.as_view(), name='payment-history'),
    path('billing/initialize/', views.InitializePaymentView.as_view(), name='initialize-payment'),
    path('billing/verify/<str:reference>/', views.VerifyPaymentView.as_view(), name='verify-payment'),
]

# Portal URLs (admin portal authentication)
portal_urlpatterns = [
    path('login/', views.PortalLoginView.as_view(), name='portal-login'),

    # School configuration (branding)
    path('school/configuration/', views.PortalSchoolConfigurationView.as_view(), name='portal-school-configuration'),

    # Admin account management (for School Management System access)
    path('admin-accounts/', views.PortalAdminAccountsView.as_view(), name='portal-admin-accounts'),
    path('admin-accounts/create/', views.PortalCreateAdminAccountView.as_view(), name='portal-create-admin'),
    path('admin-accounts/<int:admin_id>/', views.PortalAdminAccountDetailView.as_view(), name='portal-admin-detail'),
    path('admin-accounts/<int:admin_id>/reset-password/', views.PortalResetAdminPasswordView.as_view(), name='portal-reset-admin-password'),

    # Proprietor account management (for School Management System access)
    path('proprietor-accounts/', views.PortalProprietorAccountsView.as_view(), name='portal-proprietor-accounts'),
    path('proprietor-accounts/create/', views.PortalCreateProprietorAccountView.as_view(), name='portal-create-proprietor'),
    path('proprietor-accounts/<int:prop_id>/', views.PortalProprietorAccountDetailView.as_view(), name='portal-proprietor-detail'),
    path('proprietor-accounts/<int:prop_id>/reset-password/', views.PortalResetProprietorPasswordView.as_view(), name='portal-reset-proprietor-password'),

    # Subscription management (portal auth)
    path('subscription/', views.PortalSubscriptionDetailView.as_view(), name='portal-subscription-detail'),
    path('subscription/plans/', views.PortalSubscriptionPlansView.as_view(), name='portal-subscription-plans'),
    path('subscription/upgrade/', views.PortalUpgradePlanView.as_view(), name='portal-upgrade-plan'),

    # Database export (Standard+ plans only)
    path('database/download/', views.PortalDownloadDatabaseView.as_view(), name='portal-database-download'),
]

# Proprietor URLs (school-scoped, proprietor role required)
proprietor_urlpatterns = [
    path('dashboard/', proprietor_views.proprietor_dashboard, name='proprietor-dashboard'),
    path('sessions/', proprietor_views.proprietor_sessions, name='proprietor-sessions'),
    path('performance/', proprietor_views.proprietor_performance, name='proprietor-performance'),
    path('performance-details/', proprietor_views.proprietor_performance_details, name='proprietor-performance-details'),
    path('revenue/', proprietor_views.proprietor_revenue, name='proprietor-revenue'),
    path('revenue-by-class/', proprietor_views.proprietor_revenue_by_class, name='proprietor-revenue-by-class'),
    path('revenue-details/', proprietor_views.proprietor_revenue_details, name='proprietor-revenue-details'),
    path('attendance-analytics/', proprietor_views.proprietor_attendance_analytics, name='proprietor-attendance-analytics'),
    path('attendance-details/', proprietor_views.proprietor_attendance_details, name='proprietor-attendance-details'),
    path('failed-students/', proprietor_views.proprietor_failed_students, name='proprietor-failed-students'),
    path('data-quality/', proprietor_views.proprietor_data_quality, name='proprietor-data-quality'),
    path('staff-enrollment/', proprietor_views.proprietor_staff_enrollment, name='proprietor-staff-enrollment'),
]

# Super admin URLs
admin_urlpatterns = [
    path('schools/', views.AdminSchoolListView.as_view(), name='admin-schools'),
    path('schools/<uuid:school_id>/', views.AdminSchoolDetailView.as_view(), name='admin-school-detail'),

    # Platform admin endpoints
    path('login/', platform_views.PlatformLoginView.as_view(), name='platform-login'),
    path('overview/', platform_views.PlatformOverviewView.as_view(), name='platform-overview'),
    path('schools/list/', platform_views.PlatformSchoolsListView.as_view(), name='platform-schools-list'),
    path('schools/<uuid:school_id>/detail/', platform_views.PlatformSchoolDetailView.as_view(), name='platform-school-detail'),
    path('schools/<uuid:school_id>/action/', platform_views.PlatformSchoolActionView.as_view(), name='platform-school-action'),
    path('revenue/', platform_views.PlatformRevenueView.as_view(), name='platform-revenue'),
    path('plans/', platform_views.PlatformPlansListView.as_view(), name='platform-plans'),
]
