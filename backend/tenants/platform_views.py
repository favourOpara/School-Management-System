"""
Platform admin views for SaaS owners.
All endpoints require Django superuser access.
Mounted under /api/superadmin/
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken

from .models import School, Subscription, SubscriptionPlan, PaymentHistory
from .serializers import SchoolSerializer
from users.models import CustomUser


class IsPlatformAdmin(APIView):
    """Base class — checks is_superuser on every request."""
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_superuser:
            self.permission_denied(
                request,
                message='Platform admin access required.',
                code=status.HTTP_403_FORBIDDEN,
            )


class PlatformLoginView(APIView):
    """
    POST /api/superadmin/login/
    Authenticates a Django superuser and returns JWT tokens.
    """
    permission_classes = []  # No auth required — this IS the login endpoint

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_superuser:
            return Response(
                {'error': 'Access denied. Platform admin privileges required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_active:
            return Response(
                {'error': 'Account is disabled.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
            },
        })


class PlatformOverviewView(IsPlatformAdmin):
    """GET /api/superadmin/overview/"""

    def get(self, request):
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # School counts by subscription status
        status_qs = (
            Subscription.objects.values('status')
            .annotate(count=Count('id'))
        )
        status_counts = {row['status']: row['count'] for row in status_qs}

        # Total users by role (excluding superusers)
        user_qs = (
            CustomUser.objects.filter(is_active=True)
            .exclude(is_superuser=True)
            .values('role')
            .annotate(count=Count('id'))
        )
        role_counts = {row['role']: row['count'] for row in user_qs}

        # Revenue
        successful = PaymentHistory.objects.filter(status='success')
        all_time_revenue = successful.aggregate(total=Sum('amount'))['total'] or 0
        this_month_revenue = successful.filter(
            paid_at__gte=month_start
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Active subscriptions by plan
        plan_breakdown = list(
            Subscription.objects.filter(status__in=['active', 'trial'])
            .values('plan__name', 'plan__display_name')
            .annotate(count=Count('id'))
        )

        # Recent registrations
        recent_schools = list(
            School.objects.filter(created_at__gte=seven_days_ago)
            .order_by('-created_at')
            .values('id', 'name', 'slug', 'email', 'created_at')[:10]
        )
        # Convert UUID and datetime for JSON
        for s in recent_schools:
            s['id'] = str(s['id'])
            s['created_at'] = s['created_at'].isoformat()

        return Response({
            'schools': {
                'total': School.objects.count(),
                'active': status_counts.get('active', 0),
                'trial': status_counts.get('trial', 0),
                'expired': status_counts.get('expired', 0),
                'cancelled': status_counts.get('cancelled', 0),
                'past_due': status_counts.get('past_due', 0),
            },
            'users': role_counts,
            'users_total': sum(role_counts.values()),
            'revenue': {
                'all_time': all_time_revenue,
                'this_month': this_month_revenue,
            },
            'plans': plan_breakdown,
            'recent_registrations': recent_schools,
        })


class PlatformSchoolsListView(IsPlatformAdmin):
    """GET /api/superadmin/schools/list/?search=&status=&plan="""

    def get(self, request):
        schools = School.objects.select_related(
            'subscription', 'subscription__plan'
        ).annotate(
            user_count=Count('users', filter=Q(users__is_active=True))
        )

        # Filters
        search = request.query_params.get('search', '').strip()
        if search:
            schools = schools.filter(
                Q(name__icontains=search) | Q(slug__icontains=search) | Q(email__icontains=search)
            )

        sub_status = request.query_params.get('status', '')
        if sub_status:
            schools = schools.filter(subscription__status=sub_status)

        plan_name = request.query_params.get('plan', '')
        if plan_name:
            schools = schools.filter(subscription__plan__name=plan_name)

        schools = schools.order_by('-created_at')

        data = []
        for school in schools:
            sub = getattr(school, 'subscription', None)
            data.append({
                'id': str(school.id),
                'name': school.name,
                'slug': school.slug,
                'email': school.email,
                'is_active': school.is_active,
                'is_verified': school.is_verified,
                'created_at': school.created_at.isoformat(),
                'user_count': school.user_count,
                'subscription_status': sub.status if sub else None,
                'plan_name': sub.plan.display_name if sub and sub.plan else None,
                'plan_key': sub.plan.name if sub and sub.plan else None,
                'billing_cycle': sub.billing_cycle if sub else None,
                'current_period_end': (
                    sub.current_period_end.isoformat()
                    if sub and sub.current_period_end else None
                ),
            })

        return Response({'schools': data, 'total': len(data)})


class PlatformSchoolDetailView(IsPlatformAdmin):
    """GET /api/superadmin/schools/<school_id>/detail/"""

    def get(self, request, school_id):
        try:
            school = School.objects.select_related(
                'subscription', 'subscription__plan'
            ).get(id=school_id)
        except School.DoesNotExist:
            return Response(
                {'error': 'School not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # User counts by role
        user_counts_qs = (
            CustomUser.objects.filter(school=school, is_active=True)
            .values('role')
            .annotate(count=Count('id'))
        )
        user_counts = {row['role']: row['count'] for row in user_counts_qs}

        # Recent payments
        sub = getattr(school, 'subscription', None)
        payments = []
        if sub:
            for p in sub.payments.order_by('-created_at')[:20]:
                payments.append({
                    'id': str(p.id),
                    'amount': p.amount,
                    'status': p.status,
                    'plan_name': p.plan_name,
                    'billing_cycle': p.billing_cycle,
                    'paid_at': p.paid_at.isoformat() if p.paid_at else None,
                    'created_at': p.created_at.isoformat(),
                })

        serializer = SchoolSerializer(school)

        return Response({
            'school': serializer.data,
            'user_counts': user_counts,
            'payments': payments,
        })


class PlatformSchoolActionView(IsPlatformAdmin):
    """
    POST /api/superadmin/schools/<school_id>/action/
    Body: { "action": "activate"|"deactivate"|"change_plan", "plan_id": "..." }
    """

    def post(self, request, school_id):
        try:
            school = School.objects.select_related('subscription').get(id=school_id)
        except School.DoesNotExist:
            return Response(
                {'error': 'School not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        action = request.data.get('action')

        if action == 'activate':
            school.is_active = True
            school.save(update_fields=['is_active'])
            if hasattr(school, 'subscription') and school.subscription.status == 'expired':
                school.subscription.status = 'active'
                school.subscription.save(update_fields=['status'])
            return Response({'message': f'{school.name} has been activated.'})

        elif action == 'deactivate':
            school.is_active = False
            school.save(update_fields=['is_active'])
            return Response({'message': f'{school.name} has been deactivated.'})

        elif action == 'change_plan':
            plan_id = request.data.get('plan_id')
            if not plan_id:
                return Response(
                    {'error': 'plan_id is required.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                new_plan = SubscriptionPlan.objects.get(id=plan_id)
            except SubscriptionPlan.DoesNotExist:
                return Response(
                    {'error': 'Plan not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            sub = getattr(school, 'subscription', None)
            if not sub:
                return Response(
                    {'error': 'School has no subscription.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sub.plan = new_plan
            sub.save(update_fields=['plan'])
            return Response({'message': f'Plan changed to {new_plan.display_name}.'})

        return Response(
            {'error': 'Invalid action. Use: activate, deactivate, or change_plan.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


class PlatformRevenueView(IsPlatformAdmin):
    """GET /api/superadmin/revenue/"""

    def get(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_start = (month_start - timedelta(days=1)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        successful = PaymentHistory.objects.filter(status='success')

        all_time = successful.aggregate(total=Sum('amount'))['total'] or 0
        this_month = successful.filter(
            paid_at__gte=month_start
        ).aggregate(total=Sum('amount'))['total'] or 0
        last_month = successful.filter(
            paid_at__gte=last_month_start, paid_at__lt=month_start
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Revenue by plan
        by_plan = list(
            successful.values('plan_name')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-total')
        )

        # Monthly revenue (last 12 months) using TruncMonth
        monthly_qs = (
            successful
            .filter(paid_at__gte=now - timedelta(days=365))
            .annotate(month=TruncMonth('paid_at'))
            .values('month')
            .annotate(revenue=Sum('amount'))
            .order_by('month')
        )
        monthly = [
            {'month': row['month'].strftime('%b %Y'), 'revenue': row['revenue']}
            for row in monthly_qs
        ]

        # Recent payments
        recent = (
            successful
            .select_related('subscription__school')
            .order_by('-paid_at')[:25]
        )
        recent_data = []
        for p in recent:
            recent_data.append({
                'id': str(p.id),
                'school_name': p.subscription.school.name,
                'amount': p.amount,
                'plan_name': p.plan_name,
                'billing_cycle': p.billing_cycle,
                'paid_at': p.paid_at.isoformat() if p.paid_at else None,
                'payment_method': p.payment_method,
            })

        return Response({
            'all_time': all_time,
            'this_month': this_month,
            'last_month': last_month,
            'by_plan': by_plan,
            'monthly': monthly,
            'recent_payments': recent_data,
        })


class PlatformPlansListView(IsPlatformAdmin):
    """GET /api/superadmin/plans/"""

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True).order_by('display_order')
        data = [
            {
                'id': str(p.id),
                'name': p.name,
                'display_name': p.display_name,
                'monthly_price': p.monthly_price,
                'annual_price': p.annual_price,
            }
            for p in plans
        ]
        return Response({'plans': data})
