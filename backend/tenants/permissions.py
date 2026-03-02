"""
Custom permission classes for feature gating based on subscription plans.
"""
from rest_framework import permissions


class HasActiveSubscription(permissions.BasePermission):
    """
    Permission class to check if the school has an active subscription.

    This checks for 'trial' or 'active' subscription status.
    """
    message = "Your subscription is not active. Please renew your subscription to access this feature."

    def has_permission(self, request, view):
        subscription = getattr(request, 'subscription', None)

        if not subscription:
            self.message = "No subscription found for this school."
            return False

        if not subscription.is_active_or_trial():
            if subscription.status == 'expired':
                self.message = "Your subscription has expired. Please renew to continue."
            elif subscription.status == 'cancelled':
                self.message = "Your subscription has been cancelled. Please resubscribe."
            elif subscription.status == 'past_due':
                self.message = "Your payment is past due. Please update your payment method."
            return False

        return True


class CanCreateAdmin(permissions.BasePermission):
    """
    Permission class to check if more admin accounts can be created.

    Based on the plan's max_admin_accounts limit.
    """
    message = "You have reached the maximum number of admin accounts for your plan. Please upgrade to add more."

    def has_permission(self, request, view):
        # Only check on POST requests (creating new users)
        if request.method != 'POST':
            return True

        # Only check when creating admin users
        role = request.data.get('role', '')
        if role != 'admin':
            return True

        subscription = getattr(request, 'subscription', None)
        if not subscription:
            self.message = "No subscription found for this school."
            return False

        if not subscription.can_create_admin():
            current = subscription.get_admin_count()
            max_allowed = subscription.plan.max_admin_accounts
            self.message = (
                f"You have reached the maximum number of admin accounts ({max_allowed}) "
                f"for your {subscription.plan.display_name} plan. "
                f"Please upgrade your plan to add more administrators."
            )
            return False

        return True


class HasImportFeature(permissions.BasePermission):
    """
    Permission class to check if CSV import feature is available.

    Premium plans have access to bulk import functionality.
    """
    message = "CSV import is not available on your current plan. Please upgrade to Premium to access this feature."

    def has_permission(self, request, view):
        subscription = getattr(request, 'subscription', None)

        if not subscription:
            self.message = "No subscription found for this school."
            return False

        if not subscription.plan.has_import_feature:
            self.message = (
                f"CSV import is not available on your {subscription.plan.display_name} plan. "
                f"Please upgrade to Premium to access bulk import features."
            )
            return False

        return True


class HasStaffManagement(permissions.BasePermission):
    """
    Permission class to check if staff management feature is available.

    Premium and Custom plans have access to staff management.
    """
    message = "Staff management is not available on your current plan. Please upgrade to Premium to access this feature."

    def has_permission(self, request, view):
        subscription = getattr(request, 'subscription', None)

        if not subscription:
            self.message = "No subscription found for this school."
            return False

        if not subscription.plan.has_staff_management:
            self.message = (
                f"Staff management is not available on your {subscription.plan.display_name} plan. "
                f"Please upgrade to Premium to access staff management features."
            )
            return False

        return True


class CanSendEmail(permissions.BasePermission):
    """
    Permission class to check daily email sending limits.

    Each plan has a maximum number of emails per day.
    """
    message = "You have reached your daily email limit. Please try again tomorrow or upgrade your plan."

    def has_permission(self, request, view):
        subscription = getattr(request, 'subscription', None)

        if not subscription:
            self.message = "No subscription found for this school."
            return False

        if not subscription.can_send_email():
            limit = subscription.plan.max_daily_emails
            self.message = (
                f"You have reached your daily email limit of {limit} emails. "
                f"Please try again tomorrow or upgrade your plan for higher limits."
            )
            return False

        return True


class IsSameSchool(permissions.BasePermission):
    """
    Permission class to ensure users can only access their own school's data.

    This prevents cross-tenant data access.
    """
    message = "You do not have permission to access data from another school."

    def has_permission(self, request, view):
        user = request.user
        request_school = getattr(request, 'school', None)

        if not user.is_authenticated:
            return False

        user_school = getattr(user, 'school', None)

        if not user_school or not request_school:
            return False

        if user_school.id != request_school.id:
            return False

        return True


class IsSchoolAdmin(permissions.BasePermission):
    """
    Permission class to check if user is an admin for the current school.
    """
    message = "You must be a school administrator to perform this action."

    def has_permission(self, request, view):
        user = request.user
        request_school = getattr(request, 'school', None)

        if not user.is_authenticated:
            return False

        if user.role != 'admin':
            return False

        user_school = getattr(user, 'school', None)
        if not user_school or not request_school:
            return False

        if user_school.id != request_school.id:
            return False

        return True


class IsSchoolStaff(permissions.BasePermission):
    """
    Permission class to check if user is staff (admin, principal, or teacher).
    """
    message = "You must be a staff member to perform this action."

    def has_permission(self, request, view):
        user = request.user

        if not user.is_authenticated:
            return False

        return user.role in ['admin', 'principal', 'teacher']


# Utility functions for checking permissions in views

def check_email_limit(school):
    """
    Check if school can send more emails and increment counter.

    Usage:
        from tenants.permissions import check_email_limit

        if not check_email_limit(school):
            return Response({'error': 'Email limit reached'}, status=403)

        # Send email...

    Returns:
        bool: True if email can be sent, False otherwise
    """
    subscription = getattr(school, 'subscription', None)
    if not subscription:
        return False

    if not subscription.can_send_email():
        return False

    subscription.increment_email_count()
    return True


def check_admin_limit(school):
    """
    Check if school can create more admin accounts.

    Usage:
        from tenants.permissions import check_admin_limit

        if not check_admin_limit(school):
            return Response({'error': 'Admin limit reached'}, status=403)

    Returns:
        bool: True if admin can be created, False otherwise
    """
    subscription = getattr(school, 'subscription', None)
    if not subscription:
        return False

    return subscription.can_create_admin()


def check_import_feature(school):
    """
    Check if school has access to import features.

    Returns:
        bool: True if import is available, False otherwise
    """
    subscription = getattr(school, 'subscription', None)
    if not subscription:
        return False

    return subscription.plan.has_import_feature


def get_feature_limits(school):
    """
    Get all feature limits for a school's subscription.

    Returns:
        dict: Dictionary with limit information
    """
    subscription = getattr(school, 'subscription', None)
    if not subscription:
        return {
            'has_subscription': False,
            'plan_name': None,
            'max_admins': 0,
            'current_admins': 0,
            'max_daily_emails': 0,
            'emails_sent_today': 0,
            'has_import': False,
            'has_staff_management': False,
        }

    from users.models import CustomUser
    counts = _get_user_counts(school)
    plan = subscription.plan

    return {
        'has_subscription': True,
        'plan_name': plan.display_name,
        'max_admins': plan.max_admin_accounts,
        'current_admins': subscription.get_admin_count(),
        'max_daily_emails': plan.max_daily_emails,
        'emails_sent_today': subscription.emails_sent_today,
        'emails_remaining': (
            -1 if plan.max_daily_emails == 0
            else max(0, plan.max_daily_emails - subscription.emails_sent_today)
        ),
        'has_import': plan.has_import_feature,
        'has_staff_management': plan.has_staff_management,
        'max_import_rows': plan.max_import_rows,
        'max_students': plan.max_students,
        'current_students': counts['student'],
        'max_teachers': plan.max_teachers,
        'current_teachers': counts['teacher'],
        'max_principals': plan.max_principals,
        'current_principals': counts['principal'],
        'max_parents': plan.max_parents,
        'current_parents': counts['parent'],
        'status': subscription.status,
        'is_trial': subscription.status == 'trial',
        'billing_cycle': subscription.billing_cycle,
        'current_period_end': subscription.current_period_end,
        'is_in_grace_period': subscription.is_in_grace_period(),
        'grace_period_end': subscription.get_grace_period_end().isoformat() if subscription.get_grace_period_end() else None,
        'grace_days_remaining': subscription.get_grace_days_remaining(),
    }


def _get_user_counts(school):
    """Get current user counts by role for a school. Excludes graduated students."""
    from users.models import CustomUser
    from django.db.models import Count

    counts_qs = (
        CustomUser.objects.filter(school=school, is_active=True, is_graduated=False)
        .values('role')
        .annotate(count=Count('id'))
    )
    counts = {r: 0 for r in ('student', 'teacher', 'principal', 'parent', 'admin', 'proprietor')}
    for row in counts_qs:
        counts[row['role']] = row['count']
    return counts


def check_user_limit(school, role):
    """
    Check if a school can create another user of the given role.

    Returns:
        (bool, str): (can_create, message)
        - (True, '') if allowed
        - (False, 'message') if limit reached
    """
    subscription = getattr(school, 'subscription', None)
    if not subscription:
        return False, 'No active subscription.'

    plan = subscription.plan
    counts = _get_user_counts(school)

    limit_map = {
        'student': ('max_students', counts['student']),
        'teacher': ('max_teachers', counts['teacher']),
        'principal': ('max_principals', counts['principal']),
        'parent': ('max_parents', counts['parent']),
        'admin': ('max_admin_accounts', counts['admin']),
        'proprietor': ('max_proprietors', counts['proprietor']),
    }

    if role not in limit_map:
        return True, ''

    field, current = limit_map[role]
    max_allowed = getattr(plan, field, 0)

    if max_allowed == 0:
        return True, ''  # 0 means unlimited

    if current >= max_allowed:
        role_label = role.capitalize() + 's' if role != 'principal' else 'Principals'
        return False, f'You have reached the maximum of {max_allowed} {role_label.lower()} on your {plan.display_name} plan. Please upgrade to add more.'

    return True, ''


def check_trial_expiry(subscription):
    """
    Check if a subscription has passed its period end.
    Transitions to grace_period (if grace days > 0) or expired.
    Also checks if grace period has elapsed.
    Called from middleware on every request.

    Returns:
        bool: True if subscription is still valid, False if expired.
    """
    from django.utils import timezone

    # Check if trial/active subscription has passed its end date
    if subscription.status in ('trial', 'active') and subscription.current_period_end:
        if timezone.now() > subscription.current_period_end:
            if subscription.plan.grace_period_days > 0:
                subscription.status = 'grace_period'
                subscription.save(update_fields=['status'])
                # Grace period is still usable — return True
                return True
            else:
                subscription.status = 'expired'
                subscription.save(update_fields=['status'])
                return False

    # Check if grace period has elapsed
    if subscription.status == 'grace_period':
        grace_end = subscription.get_grace_period_end()
        if grace_end and timezone.now() > grace_end:
            subscription.status = 'expired'
            subscription.save(update_fields=['status'])
            return False
        return True  # Still in grace period — allow access

    if subscription.status == 'expired':
        return False

    return True
