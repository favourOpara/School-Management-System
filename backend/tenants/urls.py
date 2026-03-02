"""
URL configuration for tenants app.
"""
from django.urls import path
from . import views
from . import proprietor_views
from . import platform_views
from . import onboarding_views
from .platform_views import (
    PlatformContactsView, PlatformContactDetailView,
    PlatformSupportListView, PlatformSupportDetailView, PlatformSupportAutoAssignView,
    PlatformSupportReplyView, PlatformContactReplyView, PlatformOnboardingReplyView,
)
from .onboarding_views import (
    OnboardingContactsView, OnboardingContactUpdateView,
    OnboardingSupportView, OnboardingSupportDetailView,
    OnboardingSupportReplyView, OnboardingContactReplyView, OnboardingSchoolReplyView,
)
from .webhooks import paystack_webhook

# Public URLs (no authentication required)
public_urlpatterns = [
    path('plans/', views.PublicPlanListView.as_view(), name='public-plans'),
    path('school/<slug:slug>/', views.PublicSchoolInfoView.as_view(), name='public-school-info'),
    path('check-slug/<slug:slug>/', views.SlugCheckView.as_view(), name='check-slug'),
    path('register/', views.SchoolRegistrationView.as_view(), name='school-registration'),
    path('check-trial/', views.CheckTrialEligibilityView.as_view(), name='check-trial'),
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
    path('subscription/upgrade/preview/', views.UpgradeProrationPreviewView.as_view(), name='subscription-upgrade-preview'),
    path('subscription/cancel/', views.CancelSubscriptionView.as_view(), name='subscription-cancel'),

    # Support tickets (admin submits, school-scoped)
    path('support/', views.SupportTicketListView.as_view(), name='support-tickets'),
    path('support/<uuid:ticket_id>/reopen/', views.SupportTicketReopenView.as_view(), name='support-ticket-reopen'),

    # Billing
    path('billing/history/', views.PaymentHistoryView.as_view(), name='payment-history'),
    path('billing/initialize/', views.InitializePaymentView.as_view(), name='initialize-payment'),
    path('billing/verify/<str:reference>/', views.VerifyPaymentView.as_view(), name='verify-payment'),
    path('billing/auto-debit/toggle/', views.SchoolToggleAutoDebitView.as_view(), name='school-toggle-auto-debit'),
    path('billing/saved-card/remove/', views.SchoolRemoveSavedCardView.as_view(), name='school-remove-saved-card'),
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
    path('subscription/upgrade/preview/', views.PortalUpgradeProrationPreviewView.as_view(), name='portal-upgrade-preview'),

    # Database export (Standard+ plans only)
    path('database/download/', views.PortalDownloadDatabaseView.as_view(), name='portal-database-download'),

    # Auto-debit management
    path('billing/auto-debit/toggle/', views.ToggleAutoDebitView.as_view(), name='portal-toggle-auto-debit'),
    path('billing/saved-card/remove/', views.RemoveSavedCardView.as_view(), name='portal-remove-saved-card'),
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

    # Onboarding agent management (platform admin only)
    path('onboarding-agents/', platform_views.PlatformOnboardingAgentsView.as_view(), name='platform-onboarding-agents'),
    path('onboarding-agents/create/', platform_views.PlatformCreateOnboardingAgentView.as_view(), name='platform-create-onboarding-agent'),
    path('onboarding-agents/<uuid:agent_id>/', platform_views.PlatformOnboardingAgentDetailView.as_view(), name='platform-onboarding-agent-detail'),
    path('onboarding-queue/', platform_views.PlatformOnboardingQueueView.as_view(), name='platform-onboarding-queue'),
    path('onboarding-queue/<uuid:record_id>/assign/', platform_views.PlatformAssignOnboardingView.as_view(), name='platform-assign-onboarding'),
    path('onboarding-queue/<uuid:record_id>/reply/', PlatformOnboardingReplyView.as_view(), name='platform-onboarding-reply'),

    # Contact inquiry management (platform admin only)
    path('contacts/', PlatformContactsView.as_view(), name='platform-contacts'),
    path('contacts/<uuid:inquiry_id>/', PlatformContactDetailView.as_view(), name='platform-contact-detail'),
    path('contacts/<uuid:inquiry_id>/reply/', PlatformContactReplyView.as_view(), name='platform-contact-reply'),

    # Support ticket management (platform admin only)
    path('support/', PlatformSupportListView.as_view(), name='platform-support-list'),
    path('support/auto-assign/', PlatformSupportAutoAssignView.as_view(), name='platform-support-auto-assign'),
    path('support/<uuid:ticket_id>/', PlatformSupportDetailView.as_view(), name='platform-support-detail'),
    path('support/<uuid:ticket_id>/reply/', PlatformSupportReplyView.as_view(), name='platform-support-reply'),
]

# Onboarding staff URLs (view assigned schools + update checklist)
onboarding_urlpatterns = [
    path('login/', onboarding_views.OnboardingLoginView.as_view(), name='onboarding-login'),
    path('schools/', onboarding_views.OnboardingSchoolsView.as_view(), name='onboarding-schools'),
    path('schools/<uuid:record_id>/update/', onboarding_views.OnboardingUpdateView.as_view(), name='onboarding-update'),
    path('schools/<uuid:record_id>/reply/', OnboardingSchoolReplyView.as_view(), name='onboarding-school-reply'),
    path('contacts/', OnboardingContactsView.as_view(), name='onboarding-contacts'),
    path('contacts/<uuid:inquiry_id>/update/', OnboardingContactUpdateView.as_view(), name='onboarding-contact-update'),
    path('contacts/<uuid:inquiry_id>/reply/', OnboardingContactReplyView.as_view(), name='onboarding-contact-reply'),

    # Support tickets assigned to this agent
    path('support/', OnboardingSupportView.as_view(), name='onboarding-support'),
    path('support/<uuid:ticket_id>/', OnboardingSupportDetailView.as_view(), name='onboarding-support-detail'),
    path('support/<uuid:ticket_id>/reply/', OnboardingSupportReplyView.as_view(), name='onboarding-support-reply'),
]
