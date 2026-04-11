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

from django.conf import settings
from .models import School, Subscription, SubscriptionPlan, PaymentHistory, OnboardingAgent, OnboardingRecord, ContactInquiry, SupportTicket, StaffReply, SchoolMessage
from .serializers import SchoolSerializer
from .permissions import check_trial_expiry
from users.models import CustomUser


def _append_note(existing: str, new_text: str) -> str:
    """Append a timestamped note entry to an existing notes string."""
    ts = timezone.now().strftime('%d %b %Y %H:%M')
    entry = f"[{ts}]\n{new_text.strip()}"
    if existing and existing.strip():
        return existing.strip() + "\n\n" + entry
    return entry


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
                'grace_period': status_counts.get('grace_period', 0),
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

        now = timezone.now()
        data = []
        for school in schools:
            sub = getattr(school, 'subscription', None)

            # Transition expired trials/subscriptions before reading status
            if sub:
                check_trial_expiry(sub)

            # Compute days left before subscription/trial expires
            days_left = None
            if sub:
                if sub.status == 'trial' and school.trial_end_date:
                    delta = school.trial_end_date - now
                    days_left = max(0, delta.days)
                elif sub.current_period_end:
                    delta = sub.current_period_end - now
                    days_left = max(0, delta.days)

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
                'days_left': days_left,
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


# ─────────────────────────────────────────────────────────────
# Onboarding agent management (platform admin only)
# ─────────────────────────────────────────────────────────────

class PlatformOnboardingAgentsView(IsPlatformAdmin):
    """GET /api/superadmin/onboarding-agents/  — list all agents."""

    def get(self, request):
        agents = OnboardingAgent.objects.annotate(
            active_count=Count(
                'assigned_schools',
                filter=Q(assigned_schools__status='in_progress'),
            ),
            completed_count=Count(
                'assigned_schools',
                filter=Q(assigned_schools__status='completed'),
            ),
        ).order_by('first_name', 'last_name')

        data = [
            {
                'id': str(a.id),
                'email': a.email,
                'first_name': a.first_name,
                'last_name': a.last_name,
                'full_name': a.get_full_name(),
                'phone': a.phone,
                'is_active': a.is_active,
                'active_schools': a.active_count,
                'completed_schools': a.completed_count,
                'last_login': a.last_login.isoformat() if a.last_login else None,
                'created_at': a.created_at.isoformat(),
            }
            for a in agents
        ]
        return Response({'agents': data, 'total': len(data)})


class PlatformCreateOnboardingAgentView(IsPlatformAdmin):
    """POST /api/superadmin/onboarding-agents/create/  — create a new agent."""

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        phone = request.data.get('phone', '').strip()

        if not email or not password or not first_name or not last_name:
            return Response(
                {'error': 'email, password, first_name, and last_name are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if OnboardingAgent.objects.filter(email__iexact=email).exists():
            return Response(
                {'error': 'An agent with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        agent = OnboardingAgent(
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            is_active=True,
        )
        agent.set_password(password)
        agent.save()

        return Response({
            'message': f'Agent {agent.get_full_name()} created successfully.',
            'agent': {
                'id': str(agent.id),
                'email': agent.email,
                'full_name': agent.get_full_name(),
            },
        }, status=status.HTTP_201_CREATED)


class PlatformOnboardingAgentDetailView(IsPlatformAdmin):
    """
    PATCH /api/superadmin/onboarding-agents/<agent_id>/  — toggle active / reset password.
    DELETE /api/superadmin/onboarding-agents/<agent_id>/  — remove agent.
    """

    def _get_agent(self, agent_id):
        try:
            return OnboardingAgent.objects.get(id=agent_id)
        except OnboardingAgent.DoesNotExist:
            return None

    def patch(self, request, agent_id):
        agent = self._get_agent(agent_id)
        if not agent:
            return Response({'error': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []
        if 'is_active' in request.data:
            agent.is_active = bool(request.data['is_active'])
            update_fields.append('is_active')
        if 'password' in request.data:
            new_pw = request.data['password']
            if len(new_pw) < 8:
                return Response(
                    {'error': 'Password must be at least 8 characters.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            agent.set_password(new_pw)
            update_fields.append('password')

        if update_fields:
            agent.save(update_fields=update_fields)

        return Response({'message': 'Agent updated.'})

    def delete(self, request, agent_id):
        agent = self._get_agent(agent_id)
        if not agent:
            return Response({'error': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        agent.delete()
        return Response({'message': 'Agent deleted.'})


class PlatformAssignOnboardingView(IsPlatformAdmin):
    """
    POST /api/superadmin/onboarding-queue/<record_id>/assign/
    Body: { "agent_id": "<uuid>" }  (pass null / empty to unassign)
    Assigns or unassigns an onboarding agent to a school record.
    """

    def post(self, request, record_id):
        try:
            record = OnboardingRecord.objects.select_related('school', 'agent').get(id=record_id)
        except OnboardingRecord.DoesNotExist:
            return Response({'error': 'Record not found.'}, status=status.HTTP_404_NOT_FOUND)

        agent_id = request.data.get('agent_id')
        admin_note = (request.data.get('note') or '').strip()

        if not agent_id:
            # Unassign
            record.agent = None
            record.status = 'pending'
            record.assigned_at = None
            if admin_note:
                record.admin_notes = _append_note(record.admin_notes, admin_note)
            record.save(update_fields=['agent', 'status', 'assigned_at', 'admin_notes'])
            return Response({'message': f'Agent unassigned from {record.school.name}.'})

        try:
            agent = OnboardingAgent.objects.get(id=agent_id, is_active=True)
        except OnboardingAgent.DoesNotExist:
            return Response({'error': 'Agent not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)

        record.agent = agent
        record.status = 'in_progress'
        record.assigned_at = timezone.now()
        if admin_note:
            record.admin_notes = _append_note(record.admin_notes, admin_note)
        record.save(update_fields=['agent', 'status', 'assigned_at', 'admin_notes'])

        return Response({
            'message': f'{agent.get_full_name()} assigned to {record.school.name}.',
            'agent': {'id': str(agent.id), 'name': agent.get_full_name()},
        })


class PlatformOnboardingQueueView(IsPlatformAdmin):
    """GET /api/superadmin/onboarding-queue/  — all school onboarding records."""

    def get(self, request):
        status_filter = request.query_params.get('status', '')

        records = OnboardingRecord.objects.select_related(
            'school', 'school__subscription', 'school__subscription__plan', 'agent'
        )
        if status_filter in ('pending', 'in_progress', 'completed', 'skipped'):
            records = records.filter(status=status_filter)

        records = records.order_by('-created_at')

        data = []
        for r in records:
            school = r.school
            sub = getattr(school, 'subscription', None)
            completed, total = r.get_checklist_progress()
            data.append({
                'id': str(r.id),
                'school_name': school.name,
                'school_email': school.email,
                'school_slug': school.slug,
                'registered_at': school.created_at.isoformat(),
                'registration_type': r.registration_type,
                'plan_name': sub.plan.display_name if sub and sub.plan else 'Unknown',
                'onboarding_status': r.status,
                'agent': r.agent.get_full_name() if r.agent else None,
                'agent_email': r.agent.email if r.agent else None,
                'progress': {'completed': completed, 'total': total},
                'checklist': {
                    'students_imported': r.students_imported,
                    'teachers_added': r.teachers_added,
                    'classes_setup': r.classes_setup,
                    'subjects_setup': r.subjects_setup,
                    'parents_added': r.parents_added,
                    'attendance_configured': r.attendance_configured,
                    'grading_configured': r.grading_configured,
                },
                'notes': r.notes or '',
                'admin_notes': r.admin_notes or '',
                'assigned_at': r.assigned_at.isoformat() if r.assigned_at else None,
                'completed_at': r.completed_at.isoformat() if r.completed_at else None,
                'thread': _build_thread(r),
                'unread_school_messages': r.school_messages.filter(is_read=False).count(),
            })

        return Response({'records': data, 'total': len(data)})


# ─────────────────────────────────────────────────────────────
# Contact Inquiry management (platform admin)
# ─────────────────────────────────────────────────────────────

def _serialize_reply(r):
    return {
        'id': str(r.id),
        'sender_name': r.sender_name,
        'sent_by_admin': r.sent_by_admin,
        'message': r.message,
        'recipient_email': r.recipient_email,
        'email_sent': r.email_sent,
        'created_at': r.created_at.isoformat(),
    }


def _serialize_inquiry(inq):
    try:
        replies = [_serialize_reply(r) for r in inq.replies.all()]
    except Exception:
        replies = []
    return {
        'id': str(inq.id),
        'school_name': inq.school_name,
        'contact_name': inq.contact_name,
        'email': inq.email,
        'phone': inq.phone or '',
        'message': inq.message,
        'expected_students': inq.expected_students,
        'expected_staff': inq.expected_staff,
        'source': inq.source,
        'status': inq.status,
        'assigned_agent': inq.assigned_agent.get_full_name() if inq.assigned_agent else None,
        'assigned_agent_id': str(inq.assigned_agent.id) if inq.assigned_agent else None,
        'assigned_agent_email': inq.assigned_agent.email if inq.assigned_agent else None,
        'admin_notes': inq.admin_notes or '',
        'created_at': inq.created_at.isoformat(),
        'assigned_at': inq.assigned_at.isoformat() if inq.assigned_at else None,
        'resolved_at': inq.resolved_at.isoformat() if inq.resolved_at else None,
        'replies': replies,
    }


class PlatformContactsView(IsPlatformAdmin):
    """GET /api/superadmin/contacts/ — list all contact inquiries."""

    def get(self, request):
        status_filter = request.query_params.get('status', '')
        search = request.query_params.get('search', '').strip()

        qs = ContactInquiry.objects.select_related('assigned_agent')
        if status_filter in ('new', 'assigned', 'in_progress', 'resolved'):
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(school_name__icontains=search) |
                Q(contact_name__icontains=search) |
                Q(email__icontains=search)
            )

        data = [_serialize_inquiry(i) for i in qs]
        counts = {
            'new': ContactInquiry.objects.filter(status='new').count(),
            'assigned': ContactInquiry.objects.filter(status='assigned').count(),
            'in_progress': ContactInquiry.objects.filter(status='in_progress').count(),
            'resolved': ContactInquiry.objects.filter(status='resolved').count(),
        }
        return Response({'inquiries': data, 'total': len(data), 'counts': counts})


class PlatformContactDetailView(IsPlatformAdmin):
    """
    PATCH /api/superadmin/contacts/<inquiry_id>/
    Body: { agent_id?, status?, note? }
    Assign agent, change status, or add admin note.
    """

    def _get(self, inquiry_id):
        try:
            return ContactInquiry.objects.select_related('assigned_agent').get(id=inquiry_id)
        except ContactInquiry.DoesNotExist:
            return None

    def patch(self, request, inquiry_id):
        inq = self._get(inquiry_id)
        if not inq:
            return Response({'error': 'Inquiry not found.'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = ['updated_at']

        # Assign agent
        agent_id = request.data.get('agent_id')
        if agent_id is not None:
            if agent_id == '' or agent_id is None:
                inq.assigned_agent = None
                inq.assigned_at = None
                if inq.status == 'assigned':
                    inq.status = 'new'
                update_fields += ['assigned_agent', 'assigned_at', 'status']
            else:
                try:
                    agent = OnboardingAgent.objects.get(id=agent_id, is_active=True)
                    inq.assigned_agent = agent
                    inq.assigned_at = timezone.now()
                    if inq.status == 'new':
                        inq.status = 'assigned'
                    update_fields += ['assigned_agent', 'assigned_at', 'status']
                except OnboardingAgent.DoesNotExist:
                    return Response({'error': 'Agent not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)

        # Status override
        new_status = request.data.get('status')
        if new_status in ('new', 'assigned', 'in_progress', 'resolved'):
            inq.status = new_status
            if new_status == 'resolved' and not inq.resolved_at:
                inq.resolved_at = timezone.now()
                update_fields.append('resolved_at')
            if 'status' not in update_fields:
                update_fields.append('status')

        # Admin note (append with timestamp)
        note = (request.data.get('note') or '').strip()
        if note:
            inq.admin_notes = _append_note(inq.admin_notes, note)
            update_fields.append('admin_notes')

        inq.save(update_fields=list(set(update_fields)))
        return Response({'message': 'Updated.', 'inquiry': _serialize_inquiry(inq)})


# ─────────────────────────────────────────────────────────────
# Platform Admin — Support Ticket Management
# ─────────────────────────────────────────────────────────────

def _serialize_support_ticket(t):
    try:
        replies = [_serialize_reply(r) for r in t.replies.all()]
    except Exception:
        replies = []
    return {
        'id': str(t.id),
        'school_name': t.school.name,
        'school_slug': t.school.slug,
        'submitted_by_name': t.submitted_by_name,
        'submitted_by_email': t.submitted_by_email,
        'subject': t.subject,
        'message': t.message,
        'status': t.status,
        'assigned_agent': {
            'id': str(t.assigned_agent.id),
            'name': t.assigned_agent.get_full_name(),
            'email': t.assigned_agent.email,
        } if t.assigned_agent else None,
        'agent_notes': t.agent_notes,
        'admin_notes': t.admin_notes,
        'created_at': t.created_at.isoformat(),
        'assigned_at': t.assigned_at.isoformat() if t.assigned_at else None,
        'resolved_at': t.resolved_at.isoformat() if t.resolved_at else None,
        'replies': replies,
    }


class PlatformSupportListView(IsPlatformAdmin):
    """
    GET /api/superadmin/support/?status=&search=
    Lists all support tickets with optional filters.
    """

    def get(self, request):
        qs = SupportTicket.objects.select_related('school', 'assigned_agent').all()

        status_filter = request.query_params.get('status', '')
        if status_filter:
            qs = qs.filter(status=status_filter)

        search = request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(school__name__icontains=search) |
                Q(subject__icontains=search) |
                Q(submitted_by_email__icontains=search)
            )

        qs = qs.order_by('-created_at')

        counts = {
            'open': SupportTicket.objects.filter(status='open').count(),
            'assigned': SupportTicket.objects.filter(status='assigned').count(),
            'in_progress': SupportTicket.objects.filter(status='in_progress').count(),
            'resolved': SupportTicket.objects.filter(status='resolved').count(),
        }

        return Response({
            'tickets': [_serialize_support_ticket(t) for t in qs],
            'total': qs.count(),
            'counts': counts,
        })


class PlatformSupportDetailView(IsPlatformAdmin):
    """
    PATCH /api/superadmin/support/<ticket_id>/
    Assign agent, change status, append admin note.
    """

    def patch(self, request, ticket_id):
        try:
            ticket = SupportTicket.objects.select_related('school', 'assigned_agent').get(id=ticket_id)
        except SupportTicket.DoesNotExist:
            return Response({'error': 'Ticket not found.'}, status=404)

        update_fields = ['updated_at']

        agent_id = request.data.get('agent_id')
        if agent_id is not None:
            if agent_id == '':
                ticket.assigned_agent = None
                ticket.assigned_at = None
                if ticket.status == 'assigned':
                    ticket.status = 'open'
                update_fields += ['assigned_agent', 'assigned_at', 'status']
            else:
                try:
                    agent = OnboardingAgent.objects.get(id=agent_id, is_active=True)
                    ticket.assigned_agent = agent
                    ticket.assigned_at = timezone.now()
                    if ticket.status == 'open':
                        ticket.status = 'assigned'
                    update_fields += ['assigned_agent', 'assigned_at', 'status']
                except OnboardingAgent.DoesNotExist:
                    return Response({'error': 'Agent not found.'}, status=404)

        new_status = request.data.get('status')
        if new_status in ('open', 'assigned', 'in_progress', 'resolved'):
            ticket.status = new_status
            if new_status == 'resolved' and not ticket.resolved_at:
                ticket.resolved_at = timezone.now()
                update_fields.append('resolved_at')
            elif new_status in ('open', 'assigned') and ticket.resolved_at:
                ticket.resolved_at = None
                update_fields.append('resolved_at')
            if 'status' not in update_fields:
                update_fields.append('status')

        note = (request.data.get('note') or '').strip()
        if note:
            ticket.admin_notes = _append_note(ticket.admin_notes, note)
            update_fields.append('admin_notes')

        ticket.save(update_fields=list(set(update_fields)))
        return Response({'message': 'Updated.', 'ticket': _serialize_support_ticket(ticket)})


class PlatformSupportAutoAssignView(IsPlatformAdmin):
    """
    POST /api/superadmin/support/auto-assign/
    Round-robin assigns all open/unassigned tickets across active onboarding agents.
    """

    def post(self, request):
        agents = list(OnboardingAgent.objects.filter(is_active=True))
        if not agents:
            return Response({'error': 'No active onboarding agents available.'}, status=400)

        unassigned = SupportTicket.objects.filter(status='open').order_by('created_at')
        if not unassigned.exists():
            return Response({'message': 'No open tickets to assign.', 'assigned_count': 0})

        now = timezone.now()
        assigned_count = 0
        for i, ticket in enumerate(unassigned):
            agent = agents[i % len(agents)]
            ticket.assigned_agent = agent
            ticket.assigned_at = now
            ticket.status = 'assigned'
            ticket.save(update_fields=['assigned_agent', 'assigned_at', 'status', 'updated_at'])
            assigned_count += 1

        return Response({
            'message': f'{assigned_count} ticket(s) distributed across {len(agents)} agent(s).',
            'assigned_count': assigned_count,
            'agent_count': len(agents),
        })


# ─────────────────────────────────────────────────────────────
# Platform Admin — Reply to schools (support, contacts, onboarding)
# ─────────────────────────────────────────────────────────────

def _build_thread(record):
    """Merge StaffReply (outbound) + SchoolMessage (inbound) into a sorted thread."""
    items = []
    for r in record.replies.all():
        items.append({
            'direction': 'outbound',
            'sender_name': r.sender_name,
            'message': r.message,
            'created_at': r.created_at.isoformat(),
            'email_sent': r.email_sent,
        })
    for m in record.school_messages.all():
        items.append({
            'direction': 'inbound',
            'sender_name': m.sender_name,
            'message': m.content,
            'created_at': m.created_at.isoformat(),
            'is_read': m.is_read,
        })
    return sorted(items, key=lambda x: x['created_at'])


def _send_staff_reply_email(reply, subject_line, recipient_name, recipient_email, reply_url=None):
    """Send the reply email and update email_sent flag."""
    from .insightwick_emails import send_insightwick_email
    body_html = f'''
        <p>Hi {recipient_name or 'there'},</p>
        <p>You have received a reply from the InsightWick team regarding your enquiry.</p>
        <blockquote style="border-left: 4px solid #3b82f6; padding: 12px 18px;
                           background: #eff6ff; border-radius: 0 8px 8px 0;
                           margin: 20px 0; color: #1e3a5f; font-size: 15px;
                           line-height: 1.7; white-space: pre-wrap;">{reply.message}</blockquote>
        <p style="color: #6b7280; font-size: 13px;">
            If you need further assistance, please submit a new support request from your
            school dashboard or contact us at
            <a href="mailto:office@insightwick.com" style="color: #2563eb;">office@insightwick.com</a>.
        </p>
    '''
    sent = send_insightwick_email(
        recipient_email=recipient_email,
        recipient_name=recipient_name or 'School Admin',
        subject=subject_line,
        heading='Reply from InsightWick Support',
        body_html=body_html,
        cta_text='Reply to this message' if reply_url else None,
        cta_url=reply_url,
    )
    reply.email_sent = sent
    reply.save(update_fields=['email_sent'])


class PlatformSupportReplyView(IsPlatformAdmin):
    """
    POST /api/superadmin/support/<ticket_id>/reply/
    Platform admin sends a reply to the school that submitted the support ticket.
    """

    def post(self, request, ticket_id):
        try:
            ticket = SupportTicket.objects.select_related('school').get(id=ticket_id)
        except SupportTicket.DoesNotExist:
            return Response({'error': 'Ticket not found.'}, status=404)

        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=400)

        admin_name = request.data.get('sender_name') or 'InsightWick Admin'

        reply = StaffReply.objects.create(
            support_ticket=ticket,
            sent_by_admin=True,
            sender_name=admin_name,
            message=message,
            recipient_email=ticket.submitted_by_email,
            recipient_name=ticket.submitted_by_name,
        )

        _send_staff_reply_email(
            reply=reply,
            subject_line=f'Re: {ticket.subject}',
            recipient_name=ticket.submitted_by_name,
            recipient_email=ticket.submitted_by_email,
        )

        return Response({
            'message': 'Reply sent.',
            'reply': _serialize_reply(reply),
            'email_sent': reply.email_sent,
        })


class PlatformContactReplyView(IsPlatformAdmin):
    """
    POST /api/superadmin/contacts/<inquiry_id>/reply/
    Platform admin sends a reply to the contact inquiry submitter.
    """

    def post(self, request, inquiry_id):
        try:
            inq = ContactInquiry.objects.get(id=inquiry_id)
        except ContactInquiry.DoesNotExist:
            return Response({'error': 'Inquiry not found.'}, status=404)

        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=400)

        admin_name = request.data.get('sender_name') or 'InsightWick Admin'

        reply = StaffReply.objects.create(
            contact_inquiry=inq,
            sent_by_admin=True,
            sender_name=admin_name,
            message=message,
            recipient_email=inq.email,
            recipient_name=inq.contact_name,
        )

        _send_staff_reply_email(
            reply=reply,
            subject_line=f'Re: Your enquiry — {inq.school_name}',
            recipient_name=inq.contact_name,
            recipient_email=inq.email,
        )

        return Response({
            'message': 'Reply sent.',
            'reply': _serialize_reply(reply),
            'email_sent': reply.email_sent,
        })


class PlatformOnboardingReplyView(IsPlatformAdmin):
    """
    POST /api/superadmin/onboarding-queue/<record_id>/reply/
    Platform admin sends a reply to the school in the onboarding queue.
    """

    def post(self, request, record_id):
        try:
            record = OnboardingRecord.objects.select_related('school').get(id=record_id)
        except OnboardingRecord.DoesNotExist:
            return Response({'error': 'Onboarding record not found.'}, status=404)

        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=400)

        admin_name = request.data.get('sender_name') or 'InsightWick Admin'

        reply = StaffReply.objects.create(
            onboarding_record=record,
            sent_by_admin=True,
            sender_name=admin_name,
            message=message,
            recipient_email=record.school.email,
            recipient_name=record.school.name,
        )

        reply_url = f"{settings.FRONTEND_URL}/conversation/{record.conversation_token}"
        _send_staff_reply_email(
            reply=reply,
            subject_line=f'Message from InsightWick — {record.school.name}',
            recipient_name=record.school.name,
            recipient_email=record.school.email,
            reply_url=reply_url,
        )

        # Mark any unread school messages as read now that admin is active
        record.school_messages.filter(is_read=False).update(is_read=True)

        return Response({
            'message': 'Reply sent.',
            'reply': {
                'direction': 'outbound',
                'sender_name': reply.sender_name,
                'message': reply.message,
                'created_at': reply.created_at.isoformat(),
                'email_sent': reply.email_sent,
            },
        })
