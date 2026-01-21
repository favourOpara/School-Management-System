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
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import School, SubscriptionPlan, Subscription, PaymentHistory
from .serializers import (
    SchoolSerializer,
    SchoolPublicSerializer,
    SubscriptionPlanSerializer,
    SubscriptionSerializer,
    PaymentHistorySerializer,
    SchoolRegistrationSerializer,
    SlugCheckSerializer,
    UpgradePlanSerializer,
    InitializePaymentSerializer,
    ContactSalesSerializer,
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
    Register a new school with admin user.
    POST /api/public/register/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SchoolRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.save()

            school = result['school']
            subscription = result['subscription']
            admin_user = result['admin_user']

            # Get the plan
            plan = subscription.plan

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
                    return Response({
                        'message': 'School registered successfully. Complete payment to activate.',
                        'school': SchoolSerializer(school).data,
                        'payment': {
                            'authorization_url': payment_result['authorization_url'],
                            'reference': payment_result['reference'],
                        }
                    }, status=status.HTTP_201_CREATED)
                else:
                    # Payment init failed, but school was created
                    # They can pay later
                    return Response({
                        'message': 'School registered. Payment initialization failed - you can complete payment later.',
                        'school': SchoolSerializer(school).data,
                        'payment_error': payment_result.get('error')
                    }, status=status.HTTP_201_CREATED)

            else:
                # Free plan - no payment needed
                # Send verification email
                try:
                    from logs.email_service import send_verification_email
                    verification_url = f"{request.build_absolute_uri('/')[:-1]}/{school.slug}/verify-email/{admin_user.email_verification_token}"
                    send_verification_email(admin_user, verification_url)
                except Exception as e:
                    pass  # Email sending failed, but account was created

                return Response({
                    'message': 'School registered successfully. Please verify your email to activate your account.',
                    'school': SchoolSerializer(school).data,
                }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ContactSalesView(APIView):
    """
    Submit custom plan inquiry.
    POST /api/public/contact-sales/
    """
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
    PUT /api/<school_slug>/school/
    """
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def put(self, request):
        school = request.school
        if not school:
            return Response(
                {'error': 'School context not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only allow updating certain fields
        allowed_fields = ['name', 'email', 'phone', 'address', 'logo']
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}

        for field, value in update_data.items():
            setattr(school, field, value)

        school.save()
        serializer = SchoolSerializer(school)
        return Response(serializer.data)


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
