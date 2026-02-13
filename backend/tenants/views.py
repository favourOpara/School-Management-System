"""
Views for tenant/subscription management.
"""
import uuid
from datetime import timedelta
from django.utils import timezone
from django.utils.text import slugify
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import School, SubscriptionPlan, Subscription, PaymentHistory, PortalUser
from .serializers import (
    SchoolSerializer,
    SchoolPublicSerializer,
    SchoolConfigurationSerializer,
    SubscriptionPlanSerializer,
    SubscriptionSerializer,
    PaymentHistorySerializer,
    SchoolRegistrationSerializer,
    SlugCheckSerializer,
    UpgradePlanSerializer,
    InitializePaymentSerializer,
    ContactSalesSerializer,
    PortalUserSerializer,
    SchoolAdminAccountSerializer,
    CreateSchoolAdminSerializer,
    UpdateSchoolAdminSerializer,
)
from .paystack import (
    initialize_transaction,
    verify_transaction,
    create_customer,
    create_subscription as create_paystack_subscription,
    cancel_subscription,
)
from .permissions import HasActiveSubscription, IsSchoolAdmin, get_feature_limits


# ============== PUBLIC ENDPOINTS ==============

class PublicPlanListView(APIView):
    """
    List all available subscription plans (public).
    GET /api/public/plans/
    """
    authentication_classes = []  # Skip authentication entirely for public endpoints
    permission_classes = [AllowAny]

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(
            is_active=True,
            is_public=True
        ).order_by('display_order', 'monthly_price')

        serializer = SubscriptionPlanSerializer(plans, many=True)
        return Response(serializer.data)


class PublicSchoolInfoView(APIView):
    """
    Get public info about a school for login page.
    GET /api/public/school/<slug>/
    """
    authentication_classes = []  # Skip authentication entirely for public endpoints
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            school = School.objects.get(slug=slug, is_active=True)
            serializer = SchoolPublicSerializer(school)
            return Response(serializer.data)
        except School.DoesNotExist:
            return Response(
                {'error': 'School not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class SlugCheckView(APIView):
    """
    Check if a school slug/URL is available.
    GET /api/public/check-slug/<slug>/
    """
    authentication_classes = []  # Skip authentication entirely for public endpoints
    permission_classes = [AllowAny]

    def get(self, request, slug):
        slug = slug.lower()
        is_available = not School.objects.filter(slug=slug).exists()

        # Also check for reserved slugs
        reserved_slugs = ['admin', 'api', 'public', 'webhooks', 'static', 'media', 'login']
        if slug in reserved_slugs:
            is_available = False

        return Response({
            'slug': slug,
            'available': is_available
        })


class SchoolRegistrationView(APIView):
    """
    Register a new school with portal user and initial admin account.
    POST /api/public/register/

    Creates:
    1. School entity
    2. Subscription
    3. Portal user (for Admin Portal access)
    4. Initial admin account (for School Management System access)
    """
    authentication_classes = []  # Skip authentication entirely for public endpoints
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SchoolRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.save()

            school = result['school']
            subscription = result['subscription']
            portal_user = result['portal_user']
            admin_user = result['admin_user']
            admin_username = result['admin_username']
            admin_password = result['admin_password']

            # Get the plan
            plan = subscription.plan

            # Base response data (includes admin credentials for display in portal)
            response_data = {
                'school': SchoolSerializer(school).data,
                'admin_credentials': {
                    'username': admin_username,
                    'password': admin_password,
                    'note': 'Save these credentials! They are needed to access the School Management System.'
                }
            }

            # If it's a paid plan, initialize payment
            if plan.monthly_price > 0:
                # Determine amount based on billing cycle
                billing_cycle = serializer.validated_data.get('billing_cycle', 'monthly')
                if billing_cycle == 'annual':
                    amount = plan.annual_price
                else:
                    amount = plan.monthly_price

                # Generate payment reference
                reference = f'reg_{school.slug}_{uuid.uuid4().hex[:8]}'

                # Create pending payment record
                PaymentHistory.objects.create(
                    subscription=subscription,
                    paystack_reference=reference,
                    amount=amount,
                    status='pending',
                    plan_name=plan.display_name,
                    billing_cycle=billing_cycle,
                    metadata={'school_id': str(school.id)}
                )

                # Initialize Paystack transaction
                callback_url = request.data.get(
                    'callback_url',
                    f"{request.build_absolute_uri('/')[:-1]}/payment/callback"
                )

                payment_result = initialize_transaction(
                    email=school.email,
                    amount=amount,
                    reference=reference,
                    callback_url=callback_url,
                    metadata={
                        'school_id': str(school.id),
                        'school_name': school.name,
                        'plan': plan.name,
                    }
                )

                if payment_result['success']:
                    response_data['message'] = 'School registered successfully. Complete payment to activate.'
                    response_data['payment'] = {
                        'authorization_url': payment_result['authorization_url'],
                        'reference': payment_result['reference'],
                    }
                else:
                    response_data['message'] = 'School registered. Payment initialization failed - you can complete payment later.'
                    response_data['payment_error'] = payment_result.get('error')

                return Response(response_data, status=status.HTTP_201_CREATED)

            else:
                # Free plan - no payment needed
                response_data['message'] = 'School registered successfully! You can now sign in to the Admin Portal.'

                return Response(response_data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ContactSalesView(APIView):
    """
    Submit custom plan inquiry.
    POST /api/public/contact-sales/
    """
    authentication_classes = []  # Skip authentication entirely for public endpoints
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContactSalesSerializer(data=request.data)

        if serializer.is_valid():
            # In production, this would send an email to the sales team
            # For now, just acknowledge receipt
            return Response({
                'message': 'Thank you for your interest! Our sales team will contact you shortly.',
                'data': serializer.validated_data
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PortalLoginView(APIView):
    """
    Admin Portal login endpoint.
    POST /api/portal/login/

    Authenticates portal users (school owners) and returns school info with tokens.
    Portal authentication is SEPARATE from school management system authentication.

    For backward compatibility, also checks CustomUser (admin) if no PortalUser exists,
    and auto-creates a PortalUser for migration.
    """
    authentication_classes = []  # Skip authentication entirely for public endpoints
    permission_classes = [AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        from users.models import CustomUser

        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        portal_user = None

        # First, try to find portal user by email
        try:
            portal_user = PortalUser.objects.select_related('school').get(email=email)

            # Check password
            if not portal_user.check_password(password):
                return Response(
                    {'error': 'Invalid credentials'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        except PortalUser.DoesNotExist:
            # Backward compatibility: Check if there's an admin CustomUser with this email
            try:
                legacy_user = CustomUser.objects.select_related('school').get(
                    email=email,
                    role='admin'
                )

                # Check password against legacy user
                if not legacy_user.check_password(password):
                    return Response(
                        {'error': 'Invalid credentials'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )

                if not legacy_user.is_active:
                    return Response(
                        {'error': 'Account is disabled'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )

                if not legacy_user.school:
                    return Response(
                        {'error': 'No school associated with this account'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Auto-create PortalUser for this legacy admin (migration)
                portal_user = PortalUser.objects.create(
                    school=legacy_user.school,
                    email=legacy_user.email,
                    password=legacy_user.password,  # Already hashed
                    first_name=legacy_user.first_name,
                    last_name=legacy_user.last_name,
                    phone=legacy_user.phone_number or '',
                    is_active=True,
                    is_primary=True
                )

            except CustomUser.DoesNotExist:
                return Response(
                    {'error': 'Invalid credentials'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        # Check if portal user is active
        if not portal_user.is_active:
            return Response(
                {'error': 'Account is disabled'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if school is active
        if not portal_user.school.is_active:
            return Response(
                {'error': 'School account has been deactivated'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Update last login
        portal_user.last_login = timezone.now()
        portal_user.save(update_fields=['last_login'])

        # Generate tokens (using school ID as claim for API authentication)
        # We create a custom token payload since PortalUser is not a Django User
        from rest_framework_simplejwt.tokens import AccessToken
        import datetime

        access_token = AccessToken()
        access_token['portal_user_id'] = str(portal_user.id)
        access_token['school_id'] = str(portal_user.school.id)
        access_token['email'] = portal_user.email
        access_token['is_portal'] = True
        access_token.set_exp(lifetime=datetime.timedelta(hours=24))

        refresh_token = RefreshToken()
        refresh_token['portal_user_id'] = str(portal_user.id)
        refresh_token['school_id'] = str(portal_user.school.id)
        refresh_token['is_portal'] = True

        return Response({
            'access': str(access_token),
            'refresh': str(refresh_token),
            'user': {
                'id': str(portal_user.id),
                'email': portal_user.email,
                'first_name': portal_user.first_name,
                'last_name': portal_user.last_name,
                'is_primary': portal_user.is_primary,
            },
            'school': {
                'id': str(portal_user.school.id),
                'name': portal_user.school.name,
                'slug': portal_user.school.slug,
                'logo': portal_user.school.logo.url if portal_user.school.logo else None,
            }
        })


# ============== AUTHENTICATED ENDPOINTS ==============

class SchoolDetailView(APIView):
    """
    Get current school details.
    GET /api/<school_slug>/school/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = request.school
        if not school:
            return Response(
                {'error': 'School context not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = SchoolSerializer(school)
        return Response(serializer.data)


class SchoolUpdateView(APIView):
    """
    Update school details (admin only).
    PUT /api/<school_slug>/school/update/
    """
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def put(self, request):
        school = request.school
        if not school:
            return Response(
                {'error': 'School context not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = SchoolConfigurationSerializer(school, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(SchoolSerializer(school).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SchoolConfigurationView(APIView):
    """
    Get and update school configuration/branding settings (admin only).
    GET/PUT /api/<school_slug>/school/configuration/
    """
    permission_classes = [IsAuthenticated, IsSchoolAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        school = request.school
        if not school:
            return Response(
                {'error': 'School context not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = SchoolConfigurationSerializer(school)
        return Response(serializer.data)

    def put(self, request):
        school = request.school
        if not school:
            return Response(
                {'error': 'School context not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = SchoolConfigurationSerializer(school, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # Set email_sender_name to school name if not provided
            if not school.email_sender_name:
                school.email_sender_name = school.name
                school.save()

            return Response(SchoolConfigurationSerializer(school).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubscriptionDetailView(APIView):
    """
    Get current subscription details.
    GET /api/<school_slug>/subscription/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subscription = request.subscription
        if not subscription:
            return Response(
                {'error': 'No subscription found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = SubscriptionSerializer(subscription)

        # Add feature limits
        response_data = serializer.data
        response_data['feature_limits'] = get_feature_limits(request.school)

        return Response(response_data)


class SubscriptionPlansView(APIView):
    """
    Get available plans for upgrade.
    GET /api/<school_slug>/subscription/plans/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(
            is_active=True,
            is_public=True
        ).order_by('display_order', 'monthly_price')

        serializer = SubscriptionPlanSerializer(plans, many=True)

        # Mark current plan
        current_plan_id = None
        if request.subscription:
            current_plan_id = str(request.subscription.plan.id)

        return Response({
            'plans': serializer.data,
            'current_plan_id': current_plan_id
        })


class UpgradePlanView(APIView):
    """
    Upgrade subscription plan.
    POST /api/<school_slug>/subscription/upgrade/
    """
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def post(self, request):
        serializer = UpgradePlanSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        subscription = request.subscription
        if not subscription:
            return Response(
                {'error': 'No subscription found'},
                status=status.HTTP_404_NOT_FOUND
            )

        new_plan = SubscriptionPlan.objects.get(id=serializer.validated_data['plan_id'])
        billing_cycle = serializer.validated_data.get('billing_cycle', subscription.billing_cycle)

        # Determine amount
        if billing_cycle == 'annual':
            amount = new_plan.annual_price
        else:
            amount = new_plan.monthly_price

        if amount == 0:
            # Downgrade to free plan
            subscription.plan = new_plan
            subscription.billing_cycle = billing_cycle
            subscription.save()

            return Response({
                'message': 'Plan changed successfully',
                'subscription': SubscriptionSerializer(subscription).data
            })

        # Initialize payment for upgrade
        reference = f'upg_{request.school.slug}_{uuid.uuid4().hex[:8]}'

        PaymentHistory.objects.create(
            subscription=subscription,
            paystack_reference=reference,
            amount=amount,
            status='pending',
            plan_name=new_plan.display_name,
            billing_cycle=billing_cycle,
            metadata={
                'school_id': str(request.school.id),
                'upgrade_from': subscription.plan.name,
                'upgrade_to': new_plan.name,
            }
        )

        callback_url = request.data.get(
            'callback_url',
            f"{request.build_absolute_uri('/')[:-1]}/{request.school.slug}/billing/callback"
        )

        payment_result = initialize_transaction(
            email=request.school.email,
            amount=amount,
            reference=reference,
            callback_url=callback_url,
            metadata={
                'school_id': str(request.school.id),
                'type': 'upgrade',
                'new_plan': new_plan.name,
            }
        )

        if payment_result['success']:
            return Response({
                'message': 'Payment initialized. Complete payment to upgrade.',
                'payment': {
                    'authorization_url': payment_result['authorization_url'],
                    'reference': payment_result['reference'],
                }
            })
        else:
            return Response({
                'error': 'Payment initialization failed',
                'detail': payment_result.get('error')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CancelSubscriptionView(APIView):
    """
    Cancel subscription (will remain active until period end).
    POST /api/<school_slug>/subscription/cancel/
    """
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def post(self, request):
        subscription = request.subscription
        if not subscription:
            return Response(
                {'error': 'No subscription found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Cancel with Paystack if there's an active subscription
        if subscription.paystack_subscription_code and subscription.paystack_email_token:
            result = cancel_subscription(
                subscription.paystack_subscription_code,
                subscription.paystack_email_token
            )

            if not result['success']:
                return Response({
                    'error': 'Failed to cancel subscription',
                    'detail': result.get('error')
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        subscription.status = 'cancelled'
        subscription.cancelled_at = timezone.now()
        subscription.save()

        return Response({
            'message': 'Subscription cancelled. You will have access until your current period ends.',
            'access_until': subscription.current_period_end
        })


class VerifyPaymentView(APIView):
    """
    Verify a payment after redirect from Paystack.
    GET /api/<school_slug>/billing/verify/<reference>/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        result = verify_transaction(reference)

        if not result['success']:
            return Response({
                'error': 'Payment verification failed',
                'detail': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)

        # Find and update payment record
        try:
            payment = PaymentHistory.objects.get(paystack_reference=reference)
            payment.status = 'success'
            payment.paystack_transaction_id = str(result['data']['transaction_id'])
            payment.paid_at = timezone.now()
            payment.payment_method = result['data']['authorization'].get('channel', '')
            payment.card_type = result['data']['authorization'].get('card_type', '')
            payment.card_last4 = result['data']['authorization'].get('last4', '')
            payment.save()

            # Update subscription
            subscription = payment.subscription
            subscription.status = 'active'

            # Save authorization for future charges
            auth_code = result['data']['authorization'].get('authorization_code')
            if auth_code:
                subscription.paystack_authorization_code = auth_code

            # Set customer code
            customer_code = result['data']['customer'].get('customer_code')
            if customer_code:
                subscription.paystack_customer_code = customer_code

            # Extend period
            if payment.billing_cycle == 'monthly':
                subscription.current_period_end = timezone.now() + timedelta(days=30)
            else:
                subscription.current_period_end = timezone.now() + timedelta(days=365)

            subscription.current_period_start = timezone.now()
            subscription.save()

            # Update plan if this was an upgrade
            metadata = payment.metadata or {}
            if metadata.get('type') == 'upgrade':
                new_plan_name = metadata.get('new_plan')
                if new_plan_name:
                    new_plan = SubscriptionPlan.objects.filter(name=new_plan_name).first()
                    if new_plan:
                        subscription.plan = new_plan
                        subscription.save()

            return Response({
                'message': 'Payment verified successfully',
                'subscription': SubscriptionSerializer(subscription).data
            })

        except PaymentHistory.DoesNotExist:
            return Response({
                'error': 'Payment record not found',
            }, status=status.HTTP_404_NOT_FOUND)


class PaymentHistoryView(APIView):
    """
    Get payment history for the school.
    GET /api/<school_slug>/billing/history/
    """
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def get(self, request):
        subscription = request.subscription
        if not subscription:
            return Response({'payments': []})

        payments = PaymentHistory.objects.filter(
            subscription=subscription
        ).order_by('-created_at')

        serializer = PaymentHistorySerializer(payments, many=True)
        return Response({'payments': serializer.data})


class InitializePaymentView(APIView):
    """
    Initialize a one-time payment.
    POST /api/<school_slug>/billing/initialize/
    """
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def post(self, request):
        serializer = InitializePaymentSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        plan = SubscriptionPlan.objects.get(id=serializer.validated_data['plan_id'])
        billing_cycle = serializer.validated_data['billing_cycle']

        if billing_cycle == 'annual':
            amount = plan.annual_price
        else:
            amount = plan.monthly_price

        reference = f'pay_{request.school.slug}_{uuid.uuid4().hex[:8]}'

        PaymentHistory.objects.create(
            subscription=request.subscription,
            paystack_reference=reference,
            amount=amount,
            status='pending',
            plan_name=plan.display_name,
            billing_cycle=billing_cycle,
        )

        callback_url = serializer.validated_data.get(
            'callback_url',
            f"{request.build_absolute_uri('/')[:-1]}/{request.school.slug}/billing/callback"
        )

        payment_result = initialize_transaction(
            email=request.school.email,
            amount=amount,
            reference=reference,
            callback_url=callback_url,
            metadata={
                'school_id': str(request.school.id),
                'plan': plan.name,
            }
        )

        if payment_result['success']:
            return Response({
                'authorization_url': payment_result['authorization_url'],
                'reference': payment_result['reference'],
            })
        else:
            return Response({
                'error': 'Payment initialization failed',
                'detail': payment_result.get('error')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============== ADMIN ENDPOINTS (Super Admin) ==============

class AdminSchoolListView(APIView):
    """
    List all schools (super admin only).
    GET /api/admin/schools/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Check if user is a Django superuser
        if not request.user.is_superuser:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        schools = School.objects.all().select_related(
            'subscription', 'subscription__plan'
        ).order_by('-created_at')

        serializer = SchoolSerializer(schools, many=True)
        return Response({'schools': serializer.data})


class AdminSchoolDetailView(APIView):
    """
    Get/update school details (super admin only).
    GET/PUT /api/admin/schools/<school_id>/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, school_id):
        if not request.user.is_superuser:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        try:
            school = School.objects.select_related(
                'subscription', 'subscription__plan'
            ).get(id=school_id)
            serializer = SchoolSerializer(school)
            return Response(serializer.data)
        except School.DoesNotExist:
            return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, school_id):
        if not request.user.is_superuser:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        try:
            school = School.objects.get(id=school_id)

            # Update allowed fields
            for field in ['name', 'email', 'phone', 'address', 'is_active', 'is_verified']:
                if field in request.data:
                    setattr(school, field, request.data[field])

            school.save()
            serializer = SchoolSerializer(school)
            return Response(serializer.data)
        except School.DoesNotExist:
            return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)


# ============== PORTAL ADMIN ACCOUNT MANAGEMENT ==============

def get_portal_user_from_token(request):
    """
    Extract portal user from JWT token.
    Portal tokens have 'is_portal' claim set to True.
    """
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework_simplejwt.exceptions import TokenError

    try:
        # Get the token from Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token_str = auth_header.split(' ')[1]

        # Validate token without user lookup
        token = AccessToken(token_str)

        # Check if this is a portal token
        if not token.get('is_portal'):
            return None

        portal_user_id = token.get('portal_user_id')
        if not portal_user_id:
            return None

        return PortalUser.objects.select_related('school', 'school__subscription', 'school__subscription__plan').get(
            id=portal_user_id,
            is_active=True
        )
    except (TokenError, PortalUser.DoesNotExist):
        return None


class PortalAdminAccountsView(APIView):
    """
    List admin accounts for the school.
    GET /api/portal/admin-accounts/

    Returns all admin accounts that can access the School Management System.
    """
    authentication_classes = []  # Skip default auth - we handle it manually via portal token
    permission_classes = [AllowAny]

    def get(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        from users.models import CustomUser

        # Get all admin accounts for this school
        admin_accounts = CustomUser.objects.filter(
            school=portal_user.school,
            role='admin'
        ).order_by('date_joined')

        serializer = SchoolAdminAccountSerializer(admin_accounts, many=True)

        # Get subscription limits
        subscription = portal_user.school.subscription if hasattr(portal_user.school, 'subscription') else None
        max_admins = subscription.plan.max_admin_accounts if subscription else 1
        current_count = admin_accounts.count()
        can_create = current_count < max_admins and subscription and subscription.plan.name != 'free'

        return Response({
            'admin_accounts': serializer.data,
            'limits': {
                'max_admins': max_admins,
                'current_count': current_count,
                'can_create': can_create,
                'plan_name': subscription.plan.display_name if subscription else 'Free Trial'
            }
        })


class PortalCreateAdminAccountView(APIView):
    """
    Create a new admin account for the School Management System.
    POST /api/portal/admin-accounts/

    Only available for paid plans (not free trial).
    """
    authentication_classes = []  # Skip default auth - we handle it manually via portal token
    permission_classes = [AllowAny]

    def post(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check subscription
        subscription = portal_user.school.subscription if hasattr(portal_user.school, 'subscription') else None
        if not subscription:
            return Response(
                {'error': 'No subscription found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if plan allows creating more admins
        if subscription.plan.name == 'free':
            return Response(
                {'error': 'Upgrade to a paid plan to create additional admin accounts'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not subscription.can_create_admin():
            return Response(
                {'error': f'Maximum admin accounts ({subscription.plan.max_admin_accounts}) reached for your plan'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateSchoolAdminSerializer(
            data=request.data,
            context={'school': portal_user.school}
        )

        if serializer.is_valid():
            result = serializer.save()
            admin_user = result['admin_user']
            password = result['password']

            return Response({
                'message': 'Admin account created successfully',
                'admin_account': SchoolAdminAccountSerializer(admin_user).data,
                'credentials': {
                    'username': admin_user.username,
                    'password': password,
                    'note': 'Save these credentials! The password cannot be retrieved later.'
                }
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PortalAdminAccountDetailView(APIView):
    """
    Get, update, or delete a specific admin account.
    GET/PUT/DELETE /api/portal/admin-accounts/<admin_id>/
    """
    authentication_classes = []  # Skip default auth - we handle it manually via portal token
    permission_classes = [AllowAny]

    def get_admin_user(self, portal_user, admin_id):
        """Get admin user if it belongs to the portal user's school."""
        from users.models import CustomUser
        try:
            return CustomUser.objects.get(
                id=admin_id,
                school=portal_user.school,
                role='admin'
            )
        except CustomUser.DoesNotExist:
            return None

    def get(self, request, admin_id):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        admin_user = self.get_admin_user(portal_user, admin_id)
        if not admin_user:
            return Response({'error': 'Admin account not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response(SchoolAdminAccountSerializer(admin_user).data)

    def put(self, request, admin_id):
        """Update admin account credentials."""
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        admin_user = self.get_admin_user(portal_user, admin_id)
        if not admin_user:
            return Response({'error': 'Admin account not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateSchoolAdminSerializer(
            admin_user,
            data=request.data,
            partial=True,
            context={'admin_user': admin_user, 'school': portal_user.school}
        )

        if serializer.is_valid():
            updated_user = serializer.update(admin_user, serializer.validated_data)

            response_data = {
                'message': 'Admin account updated successfully',
                'admin_account': SchoolAdminAccountSerializer(updated_user).data
            }

            # Include new password if it was changed
            if 'password' in request.data:
                response_data['new_password'] = request.data['password']
                response_data['password_note'] = 'Password has been updated. Make sure to save it.'

            return Response(response_data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, admin_id):
        """Deactivate admin account (soft delete)."""
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        admin_user = self.get_admin_user(portal_user, admin_id)
        if not admin_user:
            return Response({'error': 'Admin account not found'}, status=status.HTTP_404_NOT_FOUND)

        # Don't allow deleting the last active admin
        from users.models import CustomUser
        active_admins = CustomUser.objects.filter(
            school=portal_user.school,
            role='admin',
            is_active=True
        ).count()

        if active_admins <= 1:
            return Response(
                {'error': 'Cannot delete the last admin account'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Soft delete - deactivate instead of removing
        admin_user.is_active = False
        admin_user.save()

        return Response({'message': 'Admin account deactivated successfully'})


class PortalResetAdminPasswordView(APIView):
    """
    Reset admin account password (generate new random password).
    POST /api/portal/admin-accounts/<admin_id>/reset-password/
    """
    authentication_classes = []  # Skip default auth - we handle it manually via portal token
    permission_classes = [AllowAny]

    def post(self, request, admin_id):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from users.models import CustomUser
        from .serializers import generate_random_password

        try:
            admin_user = CustomUser.objects.get(
                id=admin_id,
                school=portal_user.school,
                role='admin'
            )
        except CustomUser.DoesNotExist:
            return Response({'error': 'Admin account not found'}, status=status.HTTP_404_NOT_FOUND)

        # Generate new password
        new_password = generate_random_password()
        admin_user.set_password(new_password)
        admin_user.must_change_password = True
        admin_user.save()

        return Response({
            'message': 'Password reset successfully',
            'credentials': {
                'username': admin_user.username,
                'password': new_password,
                'note': 'Save this password! It cannot be retrieved later.'
            }
        })


class PortalProprietorAccountsView(APIView):
    """
    List proprietor accounts for the school.
    GET /api/portal/proprietor-accounts/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from users.models import CustomUser
        from .serializers import SchoolProprietorAccountSerializer

        prop_accounts = CustomUser.objects.filter(
            school=portal_user.school,
            role='proprietor'
        ).order_by('date_joined')

        serializer = SchoolProprietorAccountSerializer(prop_accounts, many=True)

        subscription = portal_user.school.subscription if hasattr(portal_user.school, 'subscription') else None
        max_proprietors = subscription.plan.max_proprietors if subscription else 0
        current_count = prop_accounts.count()
        can_create = max_proprietors > 0 and current_count < max_proprietors

        return Response({
            'proprietor_accounts': serializer.data,
            'limits': {
                'max_proprietors': max_proprietors,
                'current_count': current_count,
                'can_create': can_create,
                'plan_name': subscription.plan.display_name if subscription else 'Free Trial'
            }
        })


class PortalCreateProprietorAccountView(APIView):
    """
    Create a new proprietor account for the School Management System.
    POST /api/portal/proprietor-accounts/create/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from .serializers import CreateSchoolProprietorSerializer, SchoolProprietorAccountSerializer

        subscription = portal_user.school.subscription if hasattr(portal_user.school, 'subscription') else None
        if not subscription:
            return Response({'error': 'No subscription found'}, status=status.HTTP_400_BAD_REQUEST)

        if subscription.plan.max_proprietors == 0:
            return Response(
                {'error': 'Upgrade to Standard or Premium to create proprietor accounts'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not subscription.can_create_proprietor():
            return Response(
                {'error': f'Maximum proprietor accounts ({subscription.plan.max_proprietors}) reached for your plan'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateSchoolProprietorSerializer(
            data=request.data,
            context={'school': portal_user.school}
        )

        if serializer.is_valid():
            result = serializer.save()
            prop_user = result['proprietor_user']
            password = result['password']

            return Response({
                'message': 'Proprietor account created successfully',
                'proprietor_account': SchoolProprietorAccountSerializer(prop_user).data,
                'credentials': {
                    'username': prop_user.username,
                    'password': password,
                    'note': 'Save these credentials! The password cannot be retrieved later.'
                }
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PortalProprietorAccountDetailView(APIView):
    """
    Update or deactivate a proprietor account.
    PUT/DELETE /api/portal/proprietor-accounts/<prop_id>/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def put(self, request, prop_id):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from users.models import CustomUser
        from .serializers import UpdateSchoolProprietorSerializer, SchoolProprietorAccountSerializer

        try:
            prop_user = CustomUser.objects.get(
                id=prop_id, school=portal_user.school, role='proprietor'
            )
        except CustomUser.DoesNotExist:
            return Response({'error': 'Proprietor account not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateSchoolProprietorSerializer(
            prop_user, data=request.data, partial=True,
            context={'prop_user': prop_user}
        )

        if serializer.is_valid():
            updated_user = serializer.update(prop_user, serializer.validated_data)
            password = serializer.validated_data.get('password')

            response_data = {
                'message': 'Proprietor account updated successfully',
                'proprietor_account': SchoolProprietorAccountSerializer(updated_user).data,
            }
            if password:
                response_data['credentials'] = {
                    'username': updated_user.username,
                    'password': password,
                    'note': 'Save these credentials! The password cannot be retrieved later.'
                }
            return Response(response_data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, prop_id):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from users.models import CustomUser

        try:
            prop_user = CustomUser.objects.get(
                id=prop_id, school=portal_user.school, role='proprietor'
            )
        except CustomUser.DoesNotExist:
            return Response({'error': 'Proprietor account not found'}, status=status.HTTP_404_NOT_FOUND)

        prop_user.is_active = False
        prop_user.save()
        return Response({'message': 'Proprietor account deactivated'})


class PortalResetProprietorPasswordView(APIView):
    """
    Reset proprietor account password.
    POST /api/portal/proprietor-accounts/<prop_id>/reset-password/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, prop_id):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        from users.models import CustomUser
        from .serializers import generate_random_password

        try:
            prop_user = CustomUser.objects.get(
                id=prop_id, school=portal_user.school, role='proprietor'
            )
        except CustomUser.DoesNotExist:
            return Response({'error': 'Proprietor account not found'}, status=status.HTTP_404_NOT_FOUND)

        new_password = generate_random_password()
        prop_user.set_password(new_password)
        prop_user.must_change_password = True
        prop_user.save()

        return Response({
            'message': 'Password reset successfully',
            'credentials': {
                'username': prop_user.username,
                'password': new_password,
                'note': 'Save this password! It cannot be retrieved later.'
            }
        })


class PortalSchoolConfigurationView(APIView):
    """
    Get and update school configuration/branding from the Admin Portal.
    GET/PUT /api/portal/school/configuration/
    """
    authentication_classes = []  # Skip default auth - we handle it manually via portal token
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        school = portal_user.school
        serializer = SchoolConfigurationSerializer(school)
        return Response(serializer.data)

    def put(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        school = portal_user.school
        serializer = SchoolConfigurationSerializer(school, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # Set email_sender_name to school name if not provided
            if not school.email_sender_name:
                school.email_sender_name = school.name
                school.save()

            return Response(SchoolConfigurationSerializer(school).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PortalSubscriptionPlansView(APIView):
    """Get available plans from the portal."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        plans = SubscriptionPlan.objects.filter(is_active=True, is_public=True).order_by('display_order', 'monthly_price')
        serializer = SubscriptionPlanSerializer(plans, many=True)

        current_plan_id = None
        school = portal_user.school
        subscription = getattr(school, 'subscription', None)
        if subscription:
            current_plan_id = str(subscription.plan.id)

        return Response({
            'plans': serializer.data,
            'current_plan_id': current_plan_id,
        })


class PortalSubscriptionDetailView(APIView):
    """Get subscription details from the portal."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        school = portal_user.school
        subscription = getattr(school, 'subscription', None)
        if not subscription:
            return Response({'error': 'No subscription found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubscriptionSerializer(subscription)
        response_data = serializer.data
        response_data['feature_limits'] = get_feature_limits(school)
        return Response(response_data)


class PortalUpgradePlanView(APIView):
    """Upgrade subscription plan from the portal."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        school = portal_user.school
        subscription = getattr(school, 'subscription', None)
        if not subscription:
            return Response({'error': 'No subscription found'}, status=status.HTTP_404_NOT_FOUND)

        plan_id = request.data.get('plan_id')
        billing_cycle = request.data.get('billing_cycle', subscription.billing_cycle)

        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

        amount = new_plan.annual_price if billing_cycle == 'annual' else new_plan.monthly_price

        if amount == 0:
            subscription.plan = new_plan
            subscription.billing_cycle = billing_cycle
            subscription.save()
            return Response({
                'message': 'Plan changed successfully',
                'subscription': SubscriptionSerializer(subscription).data,
            })

        reference = f'upg_{school.slug}_{uuid.uuid4().hex[:8]}'

        PaymentHistory.objects.create(
            subscription=subscription,
            paystack_reference=reference,
            amount=amount,
            status='pending',
            plan_name=new_plan.display_name,
            billing_cycle=billing_cycle,
            metadata={
                'school_id': str(school.id),
                'upgrade_from': subscription.plan.name,
                'upgrade_to': new_plan.name,
            },
        )

        callback_url = request.data.get(
            'callback_url',
            f"{request.build_absolute_uri('/')[:-1]}/{school.slug}/billing/callback",
        )

        payment_result = initialize_transaction(
            email=school.email,
            amount=amount,
            reference=reference,
            callback_url=callback_url,
            metadata={
                'school_id': str(school.id),
                'type': 'upgrade',
                'new_plan': new_plan.name,
            },
        )

        if payment_result['success']:
            return Response({
                'message': 'Payment initialized. Complete payment to upgrade.',
                'payment': {
                    'authorization_url': payment_result['authorization_url'],
                    'reference': payment_result['reference'],
                },
            })
        else:
            return Response(
                {'error': 'Payment initialization failed', 'detail': payment_result.get('error')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PortalDownloadDatabaseView(APIView):
    """
    Download full school database in CSV, XLSX, or JSON format.
    POST /api/portal/database/download/
    Available for Standard, Premium, and Custom plans only.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        portal_user = get_portal_user_from_token(request)
        if not portal_user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        school = portal_user.school
        subscription = getattr(school, 'subscription', None)

        if not subscription or subscription.plan.name not in ('standard', 'premium', 'custom'):
            return Response({
                'error': 'Database download is only available for Standard and Premium plans.',
                'current_plan': subscription.plan.display_name if subscription else 'None',
            }, status=status.HTTP_403_FORBIDDEN)

        export_format = request.data.get('format', 'csv').lower()
        if export_format not in ('csv', 'xlsx', 'json'):
            return Response({'error': 'Invalid format. Must be csv, xlsx, or json.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from .database_export import generate_database_export
            file_data, filename, content_type = generate_database_export(school, export_format)

            from django.http import HttpResponse
            response = HttpResponse(file_data, content_type=content_type)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'Database export failed for {school.slug}: {e}')
            return Response({'error': 'Failed to generate export.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PublicVerifyPaymentView(APIView):
    """
    Public payment verification after Paystack redirect (no auth required).
    Used during registration flow when user isn't logged in yet.
    GET /api/public/verify-payment/<reference>/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, reference):
        from .paystack import verify_transaction

        result = verify_transaction(reference)

        if not result['success']:
            return Response({
                'verified': False,
                'error': 'Payment verification failed',
                'detail': result.get('error'),
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = PaymentHistory.objects.select_related(
                'subscription__school', 'subscription__plan'
            ).get(paystack_reference=reference)
        except PaymentHistory.DoesNotExist:
            return Response({
                'verified': False,
                'error': 'Payment record not found',
            }, status=status.HTTP_404_NOT_FOUND)

        if payment.status == 'success':
            # Already verified (e.g. by webhook)
            school = payment.subscription.school
            return Response({
                'verified': True,
                'already_processed': True,
                'school_name': school.name,
                'school_slug': school.slug,
                'plan_name': payment.subscription.plan.display_name,
            })

        # Update payment record
        payment.status = 'success'
        payment.paystack_transaction_id = str(result['data']['transaction_id'])
        payment.paid_at = timezone.now()
        payment.payment_method = result['data']['authorization'].get('channel', '')
        payment.card_type = result['data']['authorization'].get('card_type', '')
        payment.card_last4 = result['data']['authorization'].get('last4', '')
        payment.save()

        # Activate subscription
        subscription = payment.subscription
        subscription.status = 'active'
        subscription.billing_cycle = payment.billing_cycle

        # Update plan if this was an upgrade or registration payment
        metadata = payment.metadata or {}
        new_plan_name = metadata.get('upgrade_to') or metadata.get('new_plan')
        if new_plan_name:
            new_plan = SubscriptionPlan.objects.filter(name=new_plan_name).first()
            if new_plan:
                subscription.plan = new_plan
        elif payment.plan_name:
            new_plan = SubscriptionPlan.objects.filter(display_name=payment.plan_name).first()
            if new_plan:
                subscription.plan = new_plan

        auth_code = result['data']['authorization'].get('authorization_code')
        if auth_code:
            subscription.paystack_authorization_code = auth_code

        customer_code = result['data']['customer'].get('customer_code')
        if customer_code:
            subscription.paystack_customer_code = customer_code

        subscription.current_period_start = timezone.now()
        if payment.billing_cycle == 'monthly':
            subscription.current_period_end = timezone.now() + timedelta(days=30)
        else:
            subscription.current_period_end = timezone.now() + timedelta(days=365)
        subscription.save()

        school = subscription.school
        return Response({
            'verified': True,
            'school_name': school.name,
            'school_slug': school.slug,
            'plan_name': subscription.plan.display_name,
        })
