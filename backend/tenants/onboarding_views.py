"""
Onboarding agent views.
Mounted under /api/onboarding/

InsightWick internal onboarding staff use these endpoints to log in,
see which schools need setup help, claim a school, and track progress.
"""
from datetime import timedelta

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from django.conf import settings
from .models import OnboardingAgent, OnboardingRecord, ContactInquiry, SupportTicket, StaffReply, SchoolMessage


def _append_note(existing: str, new_text: str) -> str:
    """Append a timestamped note entry to an existing notes string."""
    ts = timezone.now().strftime('%d %b %Y %H:%M')
    entry = f"[{ts}]\n{new_text.strip()}"
    if existing and existing.strip():
        return existing.strip() + "\n\n" + entry
    return entry


# ─────────────────────────────────────────────────────────────
# Auth helper — verifies the onboarding JWT on every request
# ─────────────────────────────────────────────────────────────

class IsOnboardingAgent(APIView):
    """Base class: validates onboarding JWT and attaches `request.onboarding_agent`."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            self.permission_denied(request, message='Authentication required.')

        token_str = auth_header[7:]
        try:
            token = AccessToken(token_str)
            if not token.get('is_onboarding'):
                self.permission_denied(request, message='Onboarding agent access required.')
            agent_id = token.get('onboarding_agent_id')
            agent = OnboardingAgent.objects.get(id=agent_id, is_active=True)
            request.onboarding_agent = agent
        except (TokenError, InvalidToken, OnboardingAgent.DoesNotExist):
            self.permission_denied(request, message='Invalid or expired token.')


# ─────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────

class OnboardingLoginView(APIView):
    """
    POST /api/onboarding/login/
    Authenticates an OnboardingAgent and returns a JWT access token.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from rest_framework_simplejwt.tokens import AccessToken

        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            agent = OnboardingAgent.objects.get(email__iexact=email)
        except OnboardingAgent.DoesNotExist:
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not agent.check_password(password):
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not agent.is_active:
            return Response({'error': 'Account is disabled.'}, status=status.HTTP_403_FORBIDDEN)

        agent.last_login = timezone.now()
        agent.save(update_fields=['last_login'])

        access_token = AccessToken()
        access_token['onboarding_agent_id'] = str(agent.id)
        access_token['email'] = agent.email
        access_token['is_onboarding'] = True
        access_token.set_exp(lifetime=timedelta(hours=12))

        return Response({
            'access': str(access_token),
            'user': {
                'id': str(agent.id),
                'email': agent.email,
                'first_name': agent.first_name,
                'last_name': agent.last_name,
                'full_name': agent.get_full_name(),
            },
        })


# ─────────────────────────────────────────────────────────────
# Schools list
# ─────────────────────────────────────────────────────────────

class OnboardingSchoolsView(IsOnboardingAgent):
    """
    GET /api/onboarding/schools/?status=active|completed
    Returns only the schools assigned to the current agent.
    - active   → assigned + in_progress (default)
    - completed → assigned + completed
    """

    def get(self, request):
        status_filter = request.query_params.get('status', 'active')

        records = OnboardingRecord.objects.select_related(
            'school', 'school__subscription', 'school__subscription__plan', 'agent'
        ).filter(agent=request.onboarding_agent)  # agents see ONLY their own assignments

        if status_filter == 'completed':
            records = records.filter(status='completed')
        else:
            # 'active' — pending assignment or in_progress
            records = records.filter(status='in_progress')

        records = records.order_by('-created_at')

        data = []
        for r in records:
            school = r.school
            sub = getattr(school, 'subscription', None)
            completed, total = r.get_checklist_progress()
            data.append({
                'id': str(r.id),
                'school_id': str(school.id),
                'school_name': school.name,
                'school_email': school.email,
                'school_phone': school.phone,
                'school_slug': school.slug,
                'registered_at': school.created_at.isoformat(),
                'registration_type': r.registration_type,
                'plan_name': sub.plan.display_name if sub and sub.plan else 'Unknown',
                'subscription_status': sub.status if sub else 'unknown',
                'onboarding_status': r.status,
                'agent': {
                    'id': str(r.agent.id),
                    'name': r.agent.get_full_name(),
                } if r.agent else None,
                'checklist': {
                    'students_imported': r.students_imported,
                    'teachers_added': r.teachers_added,
                    'classes_setup': r.classes_setup,
                    'subjects_setup': r.subjects_setup,
                    'parents_added': r.parents_added,
                    'attendance_configured': r.attendance_configured,
                    'grading_configured': r.grading_configured,
                },
                'progress': {'completed': completed, 'total': total},
                'notes': r.notes,
                'admin_notes': r.admin_notes,
                'assigned_at': r.assigned_at.isoformat() if r.assigned_at else None,
                'completed_at': r.completed_at.isoformat() if r.completed_at else None,
                'thread': _build_thread(r),
                'unread_school_messages': r.school_messages.filter(is_read=False).count(),
                'preferred_slots': r.preferred_slots or [],
                'scheduling_submitted_at': r.scheduling_submitted_at.isoformat() if r.scheduling_submitted_at else None,
            })

        return Response({'schools': data, 'total': len(data)})


# ─────────────────────────────────────────────────────────────
# Update checklist / notes / status
# ─────────────────────────────────────────────────────────────

class OnboardingUpdateView(IsOnboardingAgent):
    """
    PATCH /api/onboarding/schools/<record_id>/update/
    Updates checklist items, notes, and status for a school assigned to the current agent.
    """

    CHECKLIST_FIELDS = [
        'students_imported', 'teachers_added', 'classes_setup',
        'subjects_setup', 'parents_added', 'attendance_configured',
        'grading_configured',
    ]

    def patch(self, request, record_id):
        try:
            record = OnboardingRecord.objects.select_related('school').get(
                id=record_id,
                agent=request.onboarding_agent,
            )
        except OnboardingRecord.DoesNotExist:
            return Response(
                {'error': 'Record not found or not assigned to you.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        update_fields = ['updated_at']

        for field in self.CHECKLIST_FIELDS:
            if field in request.data:
                setattr(record, field, bool(request.data[field]))
                update_fields.append(field)

        new_note = str(request.data.get('new_note', '')).strip()
        if new_note:
            record.notes = _append_note(record.notes, new_note)
            update_fields.append('notes')

        new_status = request.data.get('status')
        if new_status in ('in_progress', 'completed', 'skipped'):
            record.status = new_status
            update_fields.append('status')
            if new_status == 'completed' and not record.completed_at:
                record.completed_at = timezone.now()
                update_fields.append('completed_at')

        record.save(update_fields=update_fields)

        completed, total = record.get_checklist_progress()
        return Response({
            'message': 'Updated successfully.',
            'progress': {'completed': completed, 'total': total},
            'status': record.status,
        })


# ─────────────────────────────────────────────────────────────
# Contacts assigned to this onboarding agent
# ─────────────────────────────────────────────────────────────

class OnboardingContactsView(IsOnboardingAgent):
    """
    GET /api/onboarding/contacts/?status=active|resolved
    Returns contact inquiries assigned to this agent.
    """

    def get(self, request):
        status_filter = request.query_params.get('status', 'active')
        qs = ContactInquiry.objects.filter(assigned_agent=request.onboarding_agent)

        if status_filter == 'resolved':
            qs = qs.filter(status='resolved')
        else:
            qs = qs.exclude(status='resolved')

        data = []
        for inq in qs:
            data.append({
                'id': str(inq.id),
                'school_name': inq.school_name,
                'contact_name': inq.contact_name,
                'email': inq.email,
                'phone': inq.phone or '',
                'message': inq.message,
                'expected_students': inq.expected_students,
                'expected_staff': inq.expected_staff,
                'status': inq.status,
                'admin_notes': inq.admin_notes or '',
                'created_at': inq.created_at.isoformat(),
                'assigned_at': inq.assigned_at.isoformat() if inq.assigned_at else None,
                'resolved_at': inq.resolved_at.isoformat() if inq.resolved_at else None,
                'replies': [_serialize_reply(r) for r in inq.replies.all()],
            })

        return Response({'contacts': data, 'total': len(data)})


class OnboardingContactUpdateView(IsOnboardingAgent):
    """
    PATCH /api/onboarding/contacts/<inquiry_id>/update/
    Agent can mark as in_progress or resolved, and add notes.
    """

    def patch(self, request, inquiry_id):
        try:
            inq = ContactInquiry.objects.get(id=inquiry_id, assigned_agent=request.onboarding_agent)
        except ContactInquiry.DoesNotExist:
            return Response({'error': 'Contact not found or not assigned to you.'}, status=404)

        update_fields = ['updated_at']

        new_status = request.data.get('status')
        if new_status in ('in_progress', 'resolved'):
            inq.status = new_status
            update_fields.append('status')
            if new_status == 'resolved' and not inq.resolved_at:
                inq.resolved_at = timezone.now()
                update_fields.append('resolved_at')

        note = (request.data.get('new_note') or '').strip()
        if note:
            inq.admin_notes = _append_note(inq.admin_notes, note)
            update_fields.append('admin_notes')

        inq.save(update_fields=list(set(update_fields)))
        return Response({'message': 'Updated.', 'status': inq.status})


# ─────────────────────────────────────────────────────────────
# Support tickets assigned to this onboarding agent
# ─────────────────────────────────────────────────────────────

class OnboardingSupportView(IsOnboardingAgent):
    """
    GET /api/onboarding/support/?status=open|resolved
    Returns support tickets assigned to this agent.
    """

    def get(self, request):
        status_filter = request.query_params.get('status', 'open')
        qs = SupportTicket.objects.select_related('school').filter(
            assigned_agent=request.onboarding_agent
        )

        if status_filter == 'resolved':
            qs = qs.filter(status='resolved')
        else:
            qs = qs.exclude(status='resolved')

        data = []
        for t in qs.order_by('-created_at'):
            data.append({
                'id': str(t.id),
                'school_name': t.school.name,
                'school_slug': t.school.slug,
                'submitted_by_name': t.submitted_by_name,
                'submitted_by_email': t.submitted_by_email,
                'subject': t.subject,
                'message': t.message,
                'status': t.status,
                'agent_notes': t.agent_notes,
                'admin_notes': t.admin_notes,
                'created_at': t.created_at.isoformat(),
                'assigned_at': t.assigned_at.isoformat() if t.assigned_at else None,
                'resolved_at': t.resolved_at.isoformat() if t.resolved_at else None,
                'replies': [_serialize_reply(r) for r in t.replies.all()],
            })

        return Response({'tickets': data, 'total': len(data)})


class OnboardingSupportDetailView(IsOnboardingAgent):
    """
    PATCH /api/onboarding/support/<ticket_id>/
    Agent can update status and add notes.
    """

    def patch(self, request, ticket_id):
        try:
            ticket = SupportTicket.objects.get(
                id=ticket_id, assigned_agent=request.onboarding_agent
            )
        except SupportTicket.DoesNotExist:
            return Response({'error': 'Ticket not found or not assigned to you.'}, status=404)

        update_fields = ['updated_at']

        new_status = request.data.get('status')
        if new_status in ('in_progress', 'resolved'):
            ticket.status = new_status
            update_fields.append('status')
            if new_status == 'resolved' and not ticket.resolved_at:
                ticket.resolved_at = timezone.now()
                update_fields.append('resolved_at')

        note = (request.data.get('new_note') or '').strip()
        if note:
            ticket.agent_notes = _append_note(ticket.agent_notes, note)
            update_fields.append('agent_notes')

        ticket.save(update_fields=list(set(update_fields)))
        return Response({'message': 'Updated.', 'status': ticket.status})


# ─────────────────────────────────────────────────────────────
# Reply helpers
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


def _send_agent_reply_email(reply, reply_url=None):
    """Send the reply email from an onboarding agent and update email_sent flag."""
    from .insightwick_emails import send_insightwick_email
    body_html = f'''
        <p>Hi {reply.recipient_name or 'there'},</p>
        <p>You have received a reply from the InsightWick onboarding team regarding your enquiry.</p>
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
        recipient_email=reply.recipient_email,
        recipient_name=reply.recipient_name or 'School Admin',
        subject='Reply from InsightWick Support',
        heading='Reply from InsightWick Support',
        body_html=body_html,
        cta_text='Reply to this message' if reply_url else None,
        cta_url=reply_url,
    )
    reply.email_sent = sent
    reply.save(update_fields=['email_sent'])


class OnboardingSupportReplyView(IsOnboardingAgent):
    """
    POST /api/onboarding/support/<ticket_id>/reply/
    Onboarding agent sends a reply to the school that submitted the support ticket.
    """

    def post(self, request, ticket_id):
        try:
            ticket = SupportTicket.objects.select_related('school').get(
                id=ticket_id, assigned_agent=request.onboarding_agent
            )
        except SupportTicket.DoesNotExist:
            return Response({'error': 'Ticket not found or not assigned to you.'}, status=404)

        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=400)

        reply = StaffReply.objects.create(
            support_ticket=ticket,
            sent_by_agent=request.onboarding_agent,
            sent_by_admin=False,
            sender_name=request.onboarding_agent.get_full_name(),
            message=message,
            recipient_email=ticket.submitted_by_email,
            recipient_name=ticket.submitted_by_name,
        )
        _send_agent_reply_email(reply)

        return Response({
            'message': 'Reply sent.',
            'reply': _serialize_reply(reply),
            'email_sent': reply.email_sent,
        })


class OnboardingContactReplyView(IsOnboardingAgent):
    """
    POST /api/onboarding/contacts/<inquiry_id>/reply/
    Onboarding agent sends a reply to the contact inquiry submitter.
    """

    def post(self, request, inquiry_id):
        try:
            inq = ContactInquiry.objects.get(
                id=inquiry_id, assigned_agent=request.onboarding_agent
            )
        except ContactInquiry.DoesNotExist:
            return Response({'error': 'Contact not found or not assigned to you.'}, status=404)

        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=400)

        reply = StaffReply.objects.create(
            contact_inquiry=inq,
            sent_by_agent=request.onboarding_agent,
            sent_by_admin=False,
            sender_name=request.onboarding_agent.get_full_name(),
            message=message,
            recipient_email=inq.email,
            recipient_name=inq.contact_name,
        )
        _send_agent_reply_email(reply)

        return Response({
            'message': 'Reply sent.',
            'reply': _serialize_reply(reply),
            'email_sent': reply.email_sent,
        })


class OnboardingSchoolReplyView(IsOnboardingAgent):
    """
    POST /api/onboarding/schools/<record_id>/reply/
    Onboarding agent sends a reply to the school in their queue.
    """

    def post(self, request, record_id):
        try:
            record = OnboardingRecord.objects.select_related('school').get(
                id=record_id, agent=request.onboarding_agent
            )
        except OnboardingRecord.DoesNotExist:
            return Response({'error': 'School record not found or not assigned to you.'}, status=404)

        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=400)

        reply = StaffReply.objects.create(
            onboarding_record=record,
            sent_by_agent=request.onboarding_agent,
            sent_by_admin=False,
            sender_name=request.onboarding_agent.get_full_name(),
            message=message,
            recipient_email=record.school.email,
            recipient_name=record.school.name,
        )
        reply_url = f"{settings.FRONTEND_URL}/conversation/{record.conversation_token}"
        _send_agent_reply_email(reply, reply_url=reply_url)

        # Mark any unread school messages as read now that agent is active
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
