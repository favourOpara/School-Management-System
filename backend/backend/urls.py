"""
URL configuration for backend project.

Multi-tenant URL Structure:
- Public routes: /api/public/... (no auth required)
- Webhooks: /api/webhooks/... (no auth required, signature verified)
- Token routes: /api/token/... (for JWT authentication)
- School-scoped routes: /api/<school_slug>/... (auth required)
- Legacy routes: /api/users/... etc. (for backward compatibility)
- Super admin routes: /api/superadmin/... (Django superuser only)
"""
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from tenants.urls import (
    public_urlpatterns as tenant_public_urls,
    webhook_urlpatterns as tenant_webhook_urls,
    school_urlpatterns as tenant_school_urls,
    admin_urlpatterns as tenant_admin_urls,
    portal_urlpatterns as tenant_portal_urls,
    proprietor_urlpatterns as tenant_proprietor_urls,
    onboarding_urlpatterns as tenant_onboarding_urls,
)


# School-scoped URL patterns (mounted under /api/<school_slug>/)
# These include the existing app URLs plus tenant-specific URLs
school_scoped_patterns = [
    # Tenant/subscription management
    path('', include(tenant_school_urls)),

    # Proprietor analytics
    path('proprietor/', include(tenant_proprietor_urls)),

    # Existing app URLs (now school-scoped)
    path('users/', include('users.urls')),
    path('academics/', include('academics.urls')),
    path('admin/', include('schooladmin.urls')),
    path('schooladmin/', include('schooladmin.urls')),
    path('attendance/', include('attendance.urls')),
    path('logs/', include('logs.urls')),
]


urlpatterns = [
    # Django admin
    path('admin/', admin.site.urls),

    # Public routes (no authentication required)
    path('api/public/', include(tenant_public_urls)),

    # Webhook routes (signature verified, no auth)
    path('api/webhooks/', include(tenant_webhook_urls)),

    # JWT Token routes
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Super admin routes (Django superuser only)
    path('api/superadmin/', include(tenant_admin_urls)),

    # Admin Portal routes (for school admin configuration)
    path('api/portal/', include(tenant_portal_urls)),

    # Onboarding agent routes (for EduCare internal onboarding staff)
    path('api/onboarding/', include(tenant_onboarding_urls)),

    # School-scoped routes (authentication required)
    # The TenantMiddleware will extract school_slug and attach to request
    re_path(r'^api/(?P<school_slug>[a-z0-9-]+)/', include(school_scoped_patterns)),

    # Legacy routes (for backward compatibility during migration)
    # These will use the default school or the user's school from the middleware
    path('api/users/', include('users.urls')),
    path('api/academics/', include('academics.urls')),
    path('api/admin/', include('schooladmin.urls')),
    path('api/schooladmin/', include('schooladmin.urls')),
    path('api/attendance/', include('attendance.urls')),
    path('api/logs/', include('logs.urls')),
]

# Note: Media files are served by Cloudinary, not locally
# if settings.DEBUG:
#     urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
