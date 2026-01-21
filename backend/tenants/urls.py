"""
URL configuration for tenants app.
"""
from django.urls import path
from . import views
from .webhooks import paystack_webhook

# Public URLs (no authentication required)
public_urlpatterns = [
    path('plans/', views.PublicPlanListView.as_view(), name='public-plans'),
    path('school/<slug:slug>/', views.PublicSchoolInfoView.as_view(), name='public-school-info'),
    path('check-slug/<slug:slug>/', views.SlugCheckView.as_view(), name='check-slug'),
    path('register/', views.SchoolRegistrationView.as_view(), name='school-registration'),
    path('contact-sales/', views.ContactSalesView.as_view(), name='contact-sales'),
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

# Super admin URLs
admin_urlpatterns = [
    path('schools/', views.AdminSchoolListView.as_view(), name='admin-schools'),
    path('schools/<uuid:school_id>/', views.AdminSchoolDetailView.as_view(), name='admin-school-detail'),
]
