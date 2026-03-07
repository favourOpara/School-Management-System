"""
Tenant middleware for multi-tenant isolation.
"""
import re
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from .models import School


# Routes that don't require tenant context
PUBLIC_ROUTES = [
    r'^/api/public/',
    r'^/api/webhooks/',
    r'^/api/token/',
    r'^/api/portal/',
    r'^/api/superadmin/',
    r'^/api/onboarding/',
    r'^/admin/',
    r'^/static/',
    r'^/media/',
    r'^/__debug__/',
    # Token-based unauthenticated routes (email verification, password reset)
    r'^/api/users/verify-email/',
    r'^/api/users/reset-password/',
]

# Legacy routes that should redirect (for backwards compatibility)
LEGACY_ROUTE_PATTERNS = [
    r'^/api/users/',
    r'^/api/academics/',
    r'^/api/attendance/',
    r'^/api/schooladmin/',
    r'^/api/admin/',
    r'^/api/logs/',
]


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to extract school context from URL path and attach to request.

    URL pattern: /api/<school_slug>/...
    Example: /api/greenwood-academy/users/list-students/

    The middleware:
    1. Skips public routes that don't require tenant context
    2. Extracts school slug from URL path
    3. Looks up the school and attaches it to request.school
    4. Verifies the school is active and subscription is valid
    """

    def _get_user_from_jwt(self, request):
        """
        Extract user from JWT token in Authorization header.
        This is needed because DRF authentication happens at view level,
        but we need the user's school in middleware for legacy routes.
        """
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        try:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(auth_header.split(' ')[1])
            user = jwt_auth.get_user(validated_token)
            return user
        except (InvalidToken, TokenError, Exception):
            return None

    def process_request(self, request):
        # Initialize school to None
        request.school = None
        request.subscription = None

        path = request.path

        # Skip public routes
        for pattern in PUBLIC_ROUTES:
            if re.match(pattern, path):
                return None

        # Handle legacy routes (redirect to user's school for backwards compatibility)
        for pattern in LEGACY_ROUTE_PATTERNS:
            if re.match(pattern, path):
                # Try to get user from JWT token (since DRF auth happens at view level)
                user = self._get_user_from_jwt(request)
                if user and hasattr(user, 'school') and user.school:
                    request.school = user.school
                    request.subscription = getattr(user.school, 'subscription', None)
                    return None

                # Check if user is authenticated via session and has a school
                if hasattr(request, 'user') and request.user.is_authenticated:
                    if hasattr(request.user, 'school') and request.user.school:
                        request.school = request.user.school
                        request.subscription = getattr(request.school, 'subscription', None)
                        return None

                # No school found — block the request to prevent cross-tenant data leakage
                return JsonResponse({
                    'error': 'School context required',
                    'message': 'Your account is not associated with a school. Please contact support.'
                }, status=403)

        # Extract school slug from path: /api/<school_slug>/...
        match = re.match(r'^/api/([a-z0-9-]+)/', path)

        if not match:
            # Not a tenant-scoped route, allow through
            return None

        school_slug = match.group(1)

        # Skip if slug is a known non-tenant route
        non_tenant_slugs = ['public', 'webhooks', 'token', 'portal', 'superadmin', 'admin', 'onboarding']
        if school_slug in non_tenant_slugs:
            return None

        # Look up the school
        try:
            school = School.objects.select_related('subscription', 'subscription__plan').get(
                slug=school_slug
            )
        except School.DoesNotExist:
            return JsonResponse({
                'error': 'School not found',
                'message': f"No school found with URL '{school_slug}'"
            }, status=404)

        # Check if school is active
        if not school.is_active:
            return JsonResponse({
                'error': 'School inactive',
                'message': 'This school account has been deactivated. Please contact support.'
            }, status=403)

        # Attach school to request
        request.school = school
        request.subscription = getattr(school, 'subscription', None)

        return None

    def process_view(self, request, view_func, view_args, view_kwargs):
        """
        Pass school context to views via kwargs if needed.
        """
        # Remove school_slug from kwargs if present (it's on request.school)
        if 'school_slug' in view_kwargs:
            del view_kwargs['school_slug']

        return None


class SubscriptionValidationMiddleware(MiddlewareMixin):
    """
    Middleware to validate subscription status on protected routes.

    This should run AFTER TenantMiddleware and authentication middleware.
    """

    # Routes that require active subscription
    SUBSCRIPTION_REQUIRED_PATTERNS = [
        r'^/api/[a-z0-9-]+/users/',
        r'^/api/[a-z0-9-]+/academics/',
        r'^/api/[a-z0-9-]+/attendance/',
        r'^/api/[a-z0-9-]+/schooladmin/',
        r'^/api/[a-z0-9-]+/admin/',
        r'^/api/[a-z0-9-]+/logs/',
    ]

    # Routes exempt from subscription check (billing, viewing plans, etc.)
    SUBSCRIPTION_EXEMPT_PATTERNS = [
        r'^/api/[a-z0-9-]+/subscription/',
        r'^/api/[a-z0-9-]+/billing/',
    ]

    def process_request(self, request):
        path = request.path

        # Check if route requires subscription
        requires_subscription = False
        for pattern in self.SUBSCRIPTION_REQUIRED_PATTERNS:
            if re.match(pattern, path):
                requires_subscription = True
                break

        if not requires_subscription:
            return None

        # Check if route is exempt
        for pattern in self.SUBSCRIPTION_EXEMPT_PATTERNS:
            if re.match(pattern, path):
                return None

        # Validate subscription
        subscription = getattr(request, 'subscription', None)

        if not subscription:
            return JsonResponse({
                'error': 'No subscription',
                'message': 'This school does not have an active subscription.'
            }, status=402)

        # Server-side trial expiry check
        from .permissions import check_trial_expiry
        check_trial_expiry(subscription)

        if not subscription.is_active_or_trial():
            if subscription.status == 'expired':
                message = 'Your subscription has expired. Please renew to continue.'
            elif subscription.status == 'cancelled':
                message = 'Your subscription has been cancelled. Please resubscribe to continue.'
            elif subscription.status == 'past_due':
                message = 'Your payment is past due. Please update your payment method.'
            else:
                message = 'Your subscription is not active. Please contact support.'

            return JsonResponse({
                'error': 'Subscription not active',
                'status': subscription.status,
                'message': message
            }, status=402)

        # Track grace period state on request for response headers
        request.is_grace_period = subscription.is_in_grace_period()
        request.grace_days_remaining = subscription.get_grace_days_remaining() if request.is_grace_period else 0

        return None

    def process_response(self, request, response):
        """Attach grace period headers to responses during grace period."""
        if getattr(request, 'is_grace_period', False):
            response['X-Subscription-Grace-Period'] = 'true'
            response['X-Grace-Days-Remaining'] = str(getattr(request, 'grace_days_remaining', 0))
        return response


def get_current_school(request):
    """
    Helper function to get the current school from request.

    Usage in views:
        from tenants.middleware import get_current_school
        school = get_current_school(request)
    """
    return getattr(request, 'school', None)


def get_current_subscription(request):
    """
    Helper function to get the current subscription from request.
    """
    return getattr(request, 'subscription', None)
