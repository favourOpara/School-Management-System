from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from django.db.models import Q, Avg, Count
from django.db import transaction

from .models import (
    FeeStructure, StudentFeeRecord, GradingScale, GradingConfiguration, 
    GradeComponent, StudentGrade, AttendanceRecord, GradeSummary, ConfigurationTemplate
)
from .serializers import (
    FeeStructureSerializer, StudentFeeRecordSerializer, GradingScaleSerializer,
    GradingConfigurationSerializer, StudentGradeSerializer,
    GradeSummarySerializer, ConfigurationTemplateSerializer, CopyConfigurationSerializer,
    ApplyTemplateSerializer, AttendanceRecordSerializer
)
from users.views import IsAdminRole
from users.models import CustomUser
from academics.models import Subject, ClassSession, StudentSession, Class, Assessment, AssessmentSubmission


# Custom permission for teachers and admins
class IsTeacherOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['teacher', 'admin']


# ============================================================================
# FEE STRUCTURE VIEWS
# ============================================================================

class CreateFeeStructureView(generics.CreateAPIView):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


class ListFeeStructuresView(generics.ListAPIView):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


class UpdateFeeStructureView(generics.RetrieveUpdateAPIView):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'


class DeleteFeeStructureView(generics.DestroyAPIView):
    queryset = FeeStructure.objects.all()
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'


class ListStudentFeeRecordsView(generics.ListAPIView):
    queryset = StudentFeeRecord.objects.all()
    serializer_class = StudentFeeRecordSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        fee_id = self.request.query_params.get('fee_id')
        if fee_id:
            return self.queryset.filter(fee_structure_id=fee_id)
        return self.queryset


class FeeStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request, fee_id):
        try:
            fee = FeeStructure.objects.get(id=fee_id)
        except FeeStructure.DoesNotExist:
            return Response({"detail": "Fee structure not found."},
                            status=status.HTTP_404_NOT_FOUND)

        students = CustomUser.objects.filter(
            role='student',
            classroom__in=fee.classes.all()
        )

        grouped = {}
        for student in students:
            cls = student.classroom
            if not cls:
                continue

            cid = cls.id
            cname = cls.name

            rec, _ = StudentFeeRecord.objects.get_or_create(
                student=student,
                fee_structure=fee,
                defaults={"amount_paid": 0, "payment_status": "UNPAID"}
            )

            paid_amt = rec.amount_paid
            outstanding = fee.amount - paid_amt

            if paid_amt >= fee.amount and rec.payment_status != 'PAID':
                rec.payment_status = 'PAID'
                rec.save(update_fields=['payment_status'])

            if cid not in grouped:
                grouped[cid] = {
                    "classId": cid,
                    "className": cname,
                    "students": [],
                    "paid": 0,
                    "outstanding": 0,
                }

            grouped[cid]["students"].append({
                "record_id": rec.id,
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.last_name}",
                "username": student.username,
                "academic_year": student.academic_year,
                "fee_name": fee.name,
                "fee_amount": fee.amount,
                "amount_paid": paid_amt,
                "outstanding": outstanding,
                "payment_status": rec.payment_status,
            })

            grouped[cid]["paid"] += paid_amt
            grouped[cid]["outstanding"] += outstanding

        return Response(list(grouped.values()))


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_fee_payment(request, record_id):
    from schooladmin.models import FeePaymentHistory
    from decimal import Decimal

    try:
        rec = StudentFeeRecord.objects.get(id=record_id)
    except StudentFeeRecord.DoesNotExist:
        return Response({"detail": "Fee record not found."},
                        status=status.HTTP_404_NOT_FOUND)

    amt = request.data.get("amount_paid")
    if amt is None:
        return Response({"detail": "amount_paid is required."},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        amt = Decimal(str(amt))
    except (ValueError, TypeError):
        return Response({"detail": "amount_paid must be a number."},
                        status=status.HTTP_400_BAD_REQUEST)

    # Store previous values for history
    previous_total = rec.amount_paid
    fee_amount = rec.fee_structure.amount
    previous_balance = fee_amount - previous_total
    new_balance = fee_amount - amt

    # Only create history if amount changed
    if amt != previous_total:
        payment_amount = amt - previous_total
        transaction_type = 'payment' if payment_amount > 0 else 'adjustment'

        # Create payment history record
        FeePaymentHistory.objects.create(
            fee_record=rec,
            transaction_type=transaction_type,
            amount=abs(payment_amount),
            previous_total=previous_total,
            new_total=amt,
            balance_before=previous_balance,
            balance_after=new_balance,
            payment_method=request.data.get('payment_method', ''),
            transaction_reference=request.data.get('transaction_reference', ''),
            remarks=request.data.get('remarks', ''),
            recorded_by=request.user
        )

    rec.amount_paid = amt
    rec.payment_status = 'PAID' if amt >= fee_amount else ('PARTIAL' if amt > 0 else 'UNPAID')
    rec.save(update_fields=['amount_paid', 'payment_status'])

    serializer = StudentFeeRecordSerializer(rec)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_fee_payment_history(request, record_id):
    """
    Get payment history for a specific fee record
    """
    from schooladmin.models import FeePaymentHistory

    try:
        rec = StudentFeeRecord.objects.select_related(
            'student', 'fee_structure'
        ).get(id=record_id)
    except StudentFeeRecord.DoesNotExist:
        return Response(
            {"detail": "Fee record not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get payment history
    history = FeePaymentHistory.objects.filter(
        fee_record=rec
    ).select_related('recorded_by').order_by('-transaction_date')

    history_data = [{
        'transaction_type': h.transaction_type,
        'amount': float(h.amount),
        'previous_total': float(h.previous_total),
        'new_total': float(h.new_total),
        'balance_before': float(h.balance_before),
        'balance_after': float(h.balance_after),
        'payment_method': h.payment_method,
        'transaction_reference': h.transaction_reference,
        'remarks': h.remarks,
        'recorded_by': f"{h.recorded_by.first_name} {h.recorded_by.last_name}" if h.recorded_by else 'System',
        'transaction_date': h.transaction_date.isoformat()
    } for h in history]

    return Response({
        'student_name': f"{rec.student.first_name} {rec.student.last_name}",
        'fee_name': rec.fee_structure.name,
        'total_fee': float(rec.fee_structure.amount),
        'amount_paid': float(rec.amount_paid),
        'balance': float(rec.fee_structure.amount - rec.amount_paid),
        'payment_status': rec.payment_status,
        'history': history_data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def generate_fee_receipt(request, record_id):
    """
    Generate and send fee receipt to parent
    """
    from schooladmin.models import FeeReceipt, FeePaymentHistory
    from logs.models import Notification
    from datetime import datetime
    import random
    import string

    try:
        rec = StudentFeeRecord.objects.select_related(
            'student', 'fee_structure'
        ).get(id=record_id)
    except StudentFeeRecord.DoesNotExist:
        return Response(
            {"detail": "Fee record not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Generate unique receipt number
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_suffix = ''.join(random.choices(string.digits, k=4))
    receipt_number = f"RCT-{timestamp}-{random_suffix}"

    # Get remarks from request
    remarks = request.data.get('remarks', '')

    # Create receipt
    receipt = FeeReceipt.objects.create(
        student=rec.student,
        receipt_number=receipt_number,
        academic_year=rec.fee_structure.academic_year,
        term=rec.fee_structure.term,
        total_fees=rec.fee_structure.amount,
        amount_paid=rec.amount_paid,
        balance=rec.fee_structure.amount - rec.amount_paid,
        status='paid' if rec.amount_paid >= rec.fee_structure.amount else ('partial' if rec.amount_paid > 0 else 'pending'),
        remarks=remarks,
        issued_by=request.user
    )

    # Get parent(s)
    parents = rec.student.parents.all()

    # Send notification to parent(s)
    for parent in parents:
        Notification.objects.create(
            recipient=parent,
            notification_type='fee_receipt',
            title='New Fee Receipt',
            message=f"A new fee receipt (#{receipt.receipt_number}) has been issued for {rec.student.first_name} {rec.student.last_name}. Total: ₦{rec.fee_structure.amount}, Paid: ₦{rec.amount_paid}, Balance: ₦{receipt.balance}",
            priority='normal',
            extra_data={
                'receipt_id': receipt.id,
                'student_name': f"{rec.student.first_name} {rec.student.last_name}",
                'receipt_number': receipt.receipt_number
            }
        )

    # Mark notification as sent
    receipt.notification_sent = True
    receipt.notification_sent_at = datetime.now()
    receipt.save()

    return Response({
        'success': True,
        'receipt_id': receipt.id,
        'receipt_number': receipt.receipt_number,
        'message': f'Receipt generated and sent to {parents.count()} parent(s)'
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def fee_dashboard_view(request):
    academic_year = request.GET.get('academic_year')
    term = request.GET.get('term')

    if not academic_year or not term:
        return Response({"detail": "Missing academic_year or term."}, status=400)

    fees = FeeStructure.objects.filter(academic_year=academic_year, term=term)
    response_data = []

    for fee in fees:
        # Get all student sessions for the classes in this fee structure
        # and the specified academic year and term (including historic data)
        student_sessions = StudentSession.objects.filter(
            class_session__classroom__in=fee.classes.all(),
            class_session__academic_year=academic_year,
            class_session__term=term
        ).select_related('student', 'class_session__classroom')

        grouped = {}

        for student_session in student_sessions:
            student = student_session.student
            cls = student_session.class_session.classroom

            cid = cls.id
            cname = cls.name

            rec, _ = StudentFeeRecord.objects.get_or_create(
                student=student,
                fee_structure=fee,
                defaults={"amount_paid": 0, "payment_status": "UNPAID"}
            )

            paid_amt = rec.amount_paid
            outstanding = fee.amount - paid_amt

            if paid_amt >= fee.amount and rec.payment_status != 'PAID':
                rec.payment_status = 'PAID'
                rec.save(update_fields=['payment_status'])

            if cid not in grouped:
                grouped[cid] = {
                    "classId": cid,
                    "className": cname,
                    "fee_structure_id": fee.id,
                    "students": [],
                    "paid": 0,
                    "outstanding": 0,
                }

            grouped[cid]["students"].append({
                "record_id": rec.id,
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.last_name}",
                "username": student.username,
                "academic_year": academic_year,
                "fee_name": fee.name,
                "fee_amount": fee.amount,
                "amount_paid": paid_amt,
                "outstanding": outstanding,
                "payment_status": rec.payment_status,
            })

            grouped[cid]["paid"] += paid_amt
            grouped[cid]["outstanding"] += outstanding

        response_data.extend(grouped.values())

    return Response(response_data)


# ============================================================================
# GRADING SYSTEM VIEWS
# ============================================================================

class GradingScaleListCreateView(generics.ListCreateAPIView):
    queryset = GradingScale.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = GradingScaleSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


class GradingScaleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = GradingScale.objects.all()
    serializer_class = GradingScaleSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'


class GradingConfigurationListCreateView(generics.ListCreateAPIView):
    queryset = GradingConfiguration.objects.all().order_by('-academic_year', 'term')
    serializer_class = GradingConfigurationSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        queryset = super().get_queryset()
        academic_year = self.request.query_params.get('academic_year')
        term = self.request.query_params.get('term')
        include_inactive = self.request.query_params.get('include_inactive', 'true').lower() == 'true'

        # By default, show all configurations (active and inactive) for historical access
        # Only filter by is_active if explicitly requested
        if not include_inactive:
            queryset = queryset.filter(is_active=True)

        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        if term:
            queryset = queryset.filter(term=term)

        return queryset


class GradingConfigurationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = GradingConfiguration.objects.all()
    serializer_class = GradingConfigurationSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'


class CopyGradingConfigurationView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def post(self, request):
        serializer = CopyConfigurationSerializer(data=request.data)
        if serializer.is_valid():
            source_config = serializer.validated_data['source_config']
            target_academic_year = serializer.validated_data['target_academic_year']
            target_term = serializer.validated_data['target_term']
            
            new_config = source_config.copy_to_session(
                target_academic_year, 
                target_term, 
                request.user
            )
            
            response_serializer = GradingConfigurationSerializer(new_config)
            return Response({
                'message': f'Configuration copied to {target_academic_year} - {target_term}',
                'configuration': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ConfigurationTemplateListCreateView(generics.ListCreateAPIView):
    queryset = ConfigurationTemplate.objects.filter(is_active=True).order_by('name')
    serializer_class = ConfigurationTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


class ConfigurationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ConfigurationTemplate.objects.all()
    serializer_class = ConfigurationTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'


class ApplyConfigurationTemplateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def post(self, request):
        serializer = ApplyTemplateSerializer(data=request.data)
        if serializer.is_valid():
            template = serializer.validated_data['template']
            academic_year = serializer.validated_data['academic_year']
            term = serializer.validated_data['term']
            
            new_config = template.apply_to_session(academic_year, term, request.user)
            
            response_serializer = GradingConfigurationSerializer(new_config)
            return Response({
                'message': f'Template "{template.name}" applied to {academic_year} - {term}',
                'configuration': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudentGradeListCreateView(generics.ListCreateAPIView):
    queryset = StudentGrade.objects.all().order_by('-date_entered')
    serializer_class = StudentGradeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if user.role == 'admin':
            pass
        elif user.role == 'teacher':
            queryset = queryset.filter(subject__teacher=user)
        else:
            return StudentGrade.objects.none()
        
        student_id = self.request.query_params.get('student')
        subject_id = self.request.query_params.get('subject')
        component_type = self.request.query_params.get('component_type')
        academic_year = self.request.query_params.get('academic_year')
        term = self.request.query_params.get('term')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if component_type:
            queryset = queryset.filter(component__component_type=component_type)
        if academic_year and term:
            queryset = queryset.filter(
                grading_config__academic_year=academic_year,
                grading_config__term=term
            )
        
        return queryset
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsTeacherOrAdmin()]
        return super().get_permissions()


class StudentGradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = StudentGrade.objects.all()
    serializer_class = StudentGradeSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if user.role == 'admin':
            return queryset
        elif user.role == 'teacher':
            return queryset.filter(subject__teacher=user)
        else:
            return StudentGrade.objects.none()


# ============================================================================
# GRADING-RELATED ATTENDANCE MANAGEMENT
# ============================================================================

class AttendanceRecordListCreateView(generics.ListCreateAPIView):
    queryset = AttendanceRecord.objects.all().order_by('-date')
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsTeacherOrAdmin]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        class_session_id = self.request.query_params.get('class_session')
        student_id = self.request.query_params.get('student')
        date = self.request.query_params.get('date')
        academic_year = self.request.query_params.get('academic_year')
        term = self.request.query_params.get('term')
        
        if class_session_id:
            queryset = queryset.filter(class_session_id=class_session_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if date:
            queryset = queryset.filter(date=date)
        if academic_year and term:
            queryset = queryset.filter(
                class_session__academic_year=academic_year,
                class_session__term=term
            )
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        if 'attendance_records' in request.data:
            attendance_data = request.data['attendance_records']
            created_records = []
            
            with transaction.atomic():
                for record_data in attendance_data:
                    existing = AttendanceRecord.objects.filter(
                        student_id=record_data['student'],
                        class_session_id=record_data['class_session'],
                        date=record_data['date']
                    ).first()
                    
                    if existing:
                        existing.is_present = record_data['is_present']
                        existing.recorded_by = request.user
                        existing.save()
                        created_records.append(existing)
                    else:
                        record_data['recorded_by'] = request.user.id
                        serializer = self.get_serializer(data=record_data)
                        if serializer.is_valid():
                            record = serializer.save()
                            created_records.append(record)
                        else:
                            return Response({
                                'detail': 'Validation error in attendance data',
                                'errors': serializer.errors
                            }, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'message': f'Successfully processed {len(created_records)} attendance records',
                'count': len(created_records)
            }, status=status.HTTP_201_CREATED)
        
        return super().create(request, *args, **kwargs)


class AttendanceRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = AttendanceRecord.objects.all()
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsTeacherOrAdmin]
    lookup_field = 'pk'


# ============================================================================
# GRADE SUMMARY VIEWS
# ============================================================================

class GradeSummaryListView(generics.ListAPIView):
    queryset = GradeSummary.objects.all().order_by('-total_score')
    serializer_class = GradeSummarySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if user.role == 'admin':
            pass
        elif user.role == 'teacher':
            queryset = queryset.filter(subject__teacher=user)
        elif user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role == 'parent':
            children = user.children.all()
            queryset = queryset.filter(student__in=children)
        else:
            return GradeSummary.objects.none()
        
        student_id = self.request.query_params.get('student')
        subject_id = self.request.query_params.get('subject')
        academic_year = self.request.query_params.get('academic_year')
        term = self.request.query_params.get('term')
        
        if student_id and user.role in ['admin', 'teacher']:
            queryset = queryset.filter(student_id=student_id)
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if academic_year and term:
            queryset = queryset.filter(
                grading_config__academic_year=academic_year,
                grading_config__term=term
            )
        
        return queryset


# ============================================================================
# RESULTS MANAGEMENT VIEWS (NEW)
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_subjects_by_session(request):
    """
    Get all subjects for a specific class session
    Filters: academic_year, term, class_id, department (optional)
    """
    academic_year = request.GET.get('academic_year')
    term = request.GET.get('term')
    class_id = request.GET.get('class_id')
    department = request.GET.get('department')
    
    if not all([academic_year, term, class_id]):
        return Response(
            {"detail": "academic_year, term, and class_id are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        class_obj = Class.objects.get(id=class_id)
    except Class.DoesNotExist:
        return Response(
            {"detail": "Class not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get the class session
    try:
        class_session = ClassSession.objects.get(
            classroom=class_obj,
            academic_year=academic_year,
            term=term
        )
    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "No class session found for the selected filters"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get subjects for this class session
    subjects = Subject.objects.filter(class_session=class_session)
    
    # Filter by department if provided (for senior classes)
    if department:
        subjects = subjects.filter(department=department)
    
    # Get student count for each subject
    subjects_data = []
    for subject in subjects:
        # Base query for students in this class session
        student_query = StudentSession.objects.filter(
            class_session=class_session,
        )
        
        # Determine if we should filter by department
        should_filter_by_department = False
        if hasattr(subject, 'department') and subject.department:
            # Clean the department string and check if it's a specific department
            subject_dept = str(subject.department).strip().lower()
            # Only filter if it's a specific department (not general/all/empty)
            if subject_dept and subject_dept not in ['general', 'all', 'none']:
                should_filter_by_department = True
        
        # Apply department filter only for department-specific subjects
        if should_filter_by_department:
            # Filter students whose department matches the subject's department
            student_query = student_query.filter(student__department__iexact=subject.department)
        
        student_count = student_query.count()
        
        subject_dict = {
            'id': subject.id,
            'name': subject.name,
            'teacher': f"{subject.teacher.first_name} {subject.teacher.last_name}" if subject.teacher else "Not Assigned",
            'teacher_id': subject.teacher.id if subject.teacher else None,
            'student_count': student_count,
            'class_session_id': class_session.id
        }
        
        # Only add code if it exists
        if hasattr(subject, 'code'):
            subject_dict['code'] = subject.code
        
        # Only add department if it exists
        if hasattr(subject, 'department'):
            subject_dict['department'] = subject.department
        
        subjects_data.append(subject_dict)
    
    return Response({
        'class_session': {
            'id': class_session.id,
            'class_name': class_obj.name,
            'academic_year': academic_year,
            'term': term
        },
        'subjects': subjects_data
    })


# Fix in schooladmin/views.py - Replace the get_subject_grades function

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_subject_grades(request, subject_id):
    """
    Get all students and their grades for a specific subject
    Returns: student list with attendance, assignment, test, exam scores
    """
    from academics.models import AssignmentSubmission
    from decimal import Decimal
    
    try:
        subject = Subject.objects.get(id=subject_id)
    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    class_session = subject.class_session

    # Get grading config for this subject's session (not necessarily active)
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=class_session.academic_year,
            term=class_session.term
        )
    except GradingConfiguration.DoesNotExist:
        # Check if any grading configurations exist at all
        all_configs = GradingConfiguration.objects.all().count()
        return Response(
            {
                "detail": f"No grading configuration found for {class_session.academic_year} - {class_session.term}. Please set up grading configuration first.",
                "academic_year": class_session.academic_year,
                "term": class_session.term,
                "total_configs_in_system": all_configs,
                "help": "Go to Grading Configuration in Settings to create a configuration for this session."
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student')
    
    should_filter_by_department = False
    if hasattr(subject, 'department') and subject.department:
        subject_dept = str(subject.department).strip().lower()
        if subject_dept and subject_dept not in ['general', 'all', 'none']:
            should_filter_by_department = True
    
    if should_filter_by_department:
        student_sessions = student_sessions.filter(student__department__iexact=subject.department)
    
    students_data = []
    for student_session in student_sessions:
        student = student_session.student
        
        grade_summary, created = GradeSummary.objects.get_or_create(
            student=student,
            subject=subject,
            grading_config=grading_config,
            defaults={
                'attendance_score': 0,
                'assignment_score': 0,
                'test_score': 0,
                'exam_score': 0,
            }
        )
        
        # Calculate assignment grade from submissions
        released_assignments = AssignmentSubmission.objects.filter(
            student=student,
            assignment__subject=subject,
            status='graded',
            grade_released=True
        ).select_related('assignment')
        
        assignment_details = []
        assignment_percentages = []
        
        for submission in released_assignments:
            if submission.score and submission.assignment.max_score:
                percentage = (float(submission.score) / float(submission.assignment.max_score)) * 100
                assignment_percentages.append(percentage)
                assignment_details.append({
                    'assignment_title': submission.assignment.title,
                    'score': float(submission.score),
                    'max_score': submission.assignment.max_score,
                    'percentage': round(percentage, 2),
                    'graded_at': submission.graded_at.isoformat() if submission.graded_at else None,
                    'feedback': submission.feedback
                })
        
        # Calculate average and scale to grading config percentage
        calculated_assignment_score = Decimal('0.00')
        if assignment_percentages:
            avg_percentage = sum(assignment_percentages) / len(assignment_percentages)
            calculated_assignment_score = Decimal(str((avg_percentage / 100) * grading_config.assignment_percentage))
            calculated_assignment_score = round(calculated_assignment_score, 2)

            # Update grade summary if different (using Decimal comparison)
            if abs(grade_summary.assignment_score - calculated_assignment_score) > Decimal('0.01'):
                grade_summary.assignment_score = calculated_assignment_score
                grade_summary.recalculate_total_score()
                grade_summary.save()

        # Calculate test score from test assessments (test_1, test_2, mid_term)
        from academics.models import AssessmentSubmission as TestSubmission, Assessment

        test_submissions = TestSubmission.objects.filter(
            student=student,
            assessment__subject=subject,
            assessment__is_active=True
        ).filter(
            Q(assessment__assessment_type='test_1') |
            Q(assessment__assessment_type='test_2') |
            Q(assessment__assessment_type='mid_term')
        ).select_related('assessment')

        test_details = []
        test_percentages = []

        for submission in test_submissions:
            if submission.score is not None and submission.max_score:
                percentage = (float(submission.score) / float(submission.max_score)) * 100
                test_percentages.append(percentage)
                test_details.append({
                    'test_title': submission.assessment.title,
                    'test_type': submission.assessment.get_assessment_type_display(),
                    'score': float(submission.score),
                    'max_score': float(submission.max_score),
                    'percentage': round(percentage, 2),
                    'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None,
                    'is_graded': submission.is_graded
                })

        # Calculate average test score and scale to grading config percentage
        calculated_test_score = Decimal('0.00')
        if test_percentages:
            avg_percentage = sum(test_percentages) / len(test_percentages)
            calculated_test_score = Decimal(str((avg_percentage / 100) * grading_config.test_percentage))
            calculated_test_score = round(calculated_test_score, 2)

            # Update grade summary if different
            if abs(grade_summary.test_score - calculated_test_score) > Decimal('0.01'):
                grade_summary.test_score = calculated_test_score
                grade_summary.recalculate_total_score()
                grade_summary.save()

        # Calculate exam score from final exams
        exam_submissions = TestSubmission.objects.filter(
            student=student,
            assessment__subject=subject,
            assessment__assessment_type='final_exam',
            assessment__is_active=True
        ).select_related('assessment')

        exam_details = []
        exam_percentages = []

        for submission in exam_submissions:
            if submission.score is not None and submission.max_score:
                percentage = (float(submission.score) / float(submission.max_score)) * 100
                exam_percentages.append(percentage)
                exam_details.append({
                    'exam_title': submission.assessment.title,
                    'score': float(submission.score),
                    'max_score': float(submission.max_score),
                    'percentage': round(percentage, 2),
                    'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None,
                    'is_graded': submission.is_graded
                })

        # Calculate average exam score and scale to grading config percentage
        calculated_exam_score = Decimal('0.00')
        if exam_percentages:
            avg_percentage = sum(exam_percentages) / len(exam_percentages)
            calculated_exam_score = Decimal(str((avg_percentage / 100) * grading_config.exam_percentage))
            calculated_exam_score = round(calculated_exam_score, 2)

            # Update grade summary if different
            if abs(grade_summary.exam_score - calculated_exam_score) > Decimal('0.01'):
                grade_summary.exam_score = calculated_exam_score
                grade_summary.recalculate_total_score()
                grade_summary.save()

        students_data.append({
            'id': student.id,
            'username': student.username,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'full_name': f"{student.first_name} {student.last_name}",
            'date_of_birth': student.date_of_birth,
            'gender': student.gender,
            'department': getattr(student, 'department', None),
            'grade_summary_id': grade_summary.id,
            'attendance_score': float(grade_summary.attendance_score),
            'assignment_score': float(grade_summary.assignment_score),
            'assignment_count': len(assignment_details),
            'assignment_details': assignment_details,
            'test_score': float(grade_summary.test_score),
            'test_count': len(test_details),
            'test_details': test_details,
            'exam_score': float(grade_summary.exam_score),
            'exam_count': len(exam_details),
            'exam_details': exam_details,
            'total_score': float(grade_summary.total_score),
            'letter_grade': grade_summary.letter_grade,
            'attendance_finalized': grade_summary.attendance_finalized,
        })
    
    subject_info = {
        'id': subject.id,
        'name': subject.name,
        'teacher': f"{subject.teacher.first_name} {subject.teacher.last_name}" if subject.teacher else "Not Assigned",
    }
    
    if hasattr(subject, 'code'):
        subject_info['code'] = subject.code
    
    return Response({
        'subject': subject_info,
        'class_session': {
            'id': class_session.id,
            'class_name': class_session.classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
        },
        'grading_config': {
            'id': grading_config.id,
            'attendance_percentage': grading_config.attendance_percentage,
            'assignment_percentage': grading_config.assignment_percentage,
            'test_percentage': grading_config.test_percentage,
            'exam_percentage': grading_config.exam_percentage,
        },
        'students': students_data
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_student_grade(request, grade_summary_id):
    """
    Update individual grade components for a student
    Validates that grades don't exceed their respective percentages
    SYNCS test scores to AssessmentSubmission when component_type='test'
    """
    try:
        grade_summary = GradeSummary.objects.select_related(
            'grading_config', 'student', 'subject'
        ).get(id=grade_summary_id)
    except GradeSummary.DoesNotExist:
        return Response(
            {"detail": "Grade summary not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    grading_config = grade_summary.grading_config

    # Get the component being updated
    component_type = request.data.get('component_type')  # 'attendance', 'assignment', 'test', 'exam'
    score = request.data.get('score')

    if component_type not in ['attendance', 'assignment', 'test', 'exam']:
        return Response(
            {"detail": "Invalid component_type. Must be one of: attendance, assignment, test, exam"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if score is None:
        return Response(
            {"detail": "score is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        score = float(score)
    except ValueError:
        return Response(
            {"detail": "score must be a valid number"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate score doesn't exceed the component's maximum percentage
    max_percentage = getattr(grading_config, f'{component_type}_percentage')

    if score < 0 or score > max_percentage:
        return Response(
            {"detail": f"{component_type.capitalize()} score must be between 0 and {max_percentage}%"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Update the score
    setattr(grade_summary, f'{component_type}_score', score)

    # If updating attendance manually, mark it as finalized
    if component_type == 'attendance':
        grade_summary.attendance_finalized = True

    # Mark test/exam as manually entered for proper sync tracking
    if component_type == 'test':
        grade_summary.test_manual_entry = True
    elif component_type == 'exam':
        grade_summary.exam_manual_entry = True

    # Recalculate total score
    grade_summary.recalculate_total_score()
    grade_summary.save()

    # SYNC TEST SCORES TO ASSESSMENT SUBMISSION
    if component_type == 'test':
        try:
            from academics.models import Assessment, AssessmentSubmission

            # Get all test assessments for this subject
            test_assessments = Assessment.objects.filter(
                subject=grade_summary.subject,
                is_active=True,
                assessment_type__in=['test_1', 'test_2', 'mid_term']
            )

            if test_assessments.exists():
                # Calculate what each test should be worth in storage format
                # score is /30 (GradeSummary format)
                # Need to convert to /3 (AssessmentSubmission format)

                max_test_marks = float(grading_config.test_percentage)  # 30
                assessment_total = float(test_assessments.first().total_marks)  # 3
                scale_factor = assessment_total / max_test_marks  # 0.1

                # Convert score from /30 to /3
                stored_score = score * scale_factor

                # Distribute evenly across all test assessments
                score_per_test = stored_score / test_assessments.count()

                print(f"=== SYNC TEST SCORE TO SUBMISSIONS (update_student_grade) ===")
                print(f"Student: {grade_summary.student.get_full_name()}")
                print(f"Subject: {grade_summary.subject.name}")
                print(f"GradeSummary test_score: {score}")
                print(f"Test assessments count: {test_assessments.count()}")
                print(f"Stored score (total): {stored_score}")
                print(f"Score per test: {score_per_test}")

                # Update or create submissions for each test
                for assessment in test_assessments:
                    submission, created = AssessmentSubmission.objects.get_or_create(
                        student=grade_summary.student,
                        assessment=assessment,
                        defaults={
                            'time_taken': 0,
                            'max_score': assessment.total_marks,
                            'score': score_per_test,
                            'is_graded': True
                        }
                    )

                    if not created:
                        submission.score = score_per_test
                        submission.is_graded = True
                        submission.save()
                        print(f"✓ Updated submission for {assessment.title}: {score_per_test}")
                    else:
                        print(f"✓ Created submission for {assessment.title}: {score_per_test}")

                print(f"=========================================================")

        except Exception as sync_error:
            print(f"WARNING: Failed to sync test score to submissions: {str(sync_error)}")
            import traceback
            traceback.print_exc()
            # Don't fail the request, just log the error

    # SYNC EXAM SCORES TO ASSESSMENT SUBMISSION
    if component_type == 'exam':
        try:
            from academics.models import Assessment, AssessmentSubmission

            # Get exam assessments for this subject
            exam_assessments = Assessment.objects.filter(
                subject=grade_summary.subject,
                is_active=True,
                assessment_type='final_exam'
            )

            if exam_assessments.exists():
                # Calculate what the exam should be worth in assessment format
                # score is /exam_percentage (GradeSummary format, e.g., /60)
                # Need to convert to /assessment.total_marks

                max_exam_marks = float(grading_config.exam_percentage)  # e.g., 60
                assessment = exam_assessments.first()
                assessment_total = float(assessment.total_marks)

                # Convert from percentage to assessment scale
                # score/max_exam_marks = stored_score/assessment_total
                stored_score = (score / max_exam_marks) * assessment_total

                print(f"=== SYNC EXAM SCORE TO SUBMISSIONS (update_student_grade) ===")
                print(f"Student: {grade_summary.student.get_full_name()}")
                print(f"Subject: {grade_summary.subject.name}")
                print(f"GradeSummary exam_score: {score}")
                print(f"Assessment total marks: {assessment_total}")
                print(f"Stored score: {stored_score}")

                # Update or create submission
                submission, created = AssessmentSubmission.objects.get_or_create(
                    student=grade_summary.student,
                    assessment=assessment,
                    defaults={
                        'time_taken': 0,
                        'max_score': assessment.total_marks,
                        'score': stored_score,
                        'is_graded': True
                    }
                )

                if not created:
                    submission.score = stored_score
                    submission.is_graded = True
                    submission.save()
                    print(f"✓ Updated submission for {assessment.title}: {stored_score}")
                else:
                    print(f"✓ Created submission for {assessment.title}: {stored_score}")

                print(f"=========================================================")

        except Exception as sync_error:
            print(f"WARNING: Failed to sync exam score to submissions: {str(sync_error)}")
            import traceback
            traceback.print_exc()
            # Don't fail the request, just log the error

    return Response({
        'message': f'{component_type.capitalize()} score updated successfully',
        'grade_summary': {
            'id': grade_summary.id,
            'student': f"{grade_summary.student.first_name} {grade_summary.student.last_name}",
            'attendance_score': float(grade_summary.attendance_score),
            'assignment_score': float(grade_summary.assignment_score),
            'test_score': float(grade_summary.test_score),
            'exam_score': float(grade_summary.exam_score),
            'total_score': float(grade_summary.total_score),
            'letter_grade': grade_summary.letter_grade,
            'attendance_finalized': grade_summary.attendance_finalized,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def bulk_update_grades(request):
    """
    Update multiple students' grades at once
    Expects: {
        'grades': [
            {'grade_summary_id': 1, 'component_type': 'attendance', 'score': 8.5},
            {'grade_summary_id': 2, 'component_type': 'test', 'score': 25},
            ...
        ]
    }
    SYNCS test scores to AssessmentSubmission when component_type='test'
    """
    grades_data = request.data.get('grades', [])

    if not grades_data:
        return Response(
            {"detail": "grades array is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    updated_count = 0
    errors = []

    with transaction.atomic():
        for grade_data in grades_data:
            grade_summary_id = grade_data.get('grade_summary_id')
            component_type = grade_data.get('component_type')
            score = grade_data.get('score')

            try:
                grade_summary = GradeSummary.objects.select_related('grading_config', 'subject', 'student').get(id=grade_summary_id)
                grading_config = grade_summary.grading_config

                # Validate
                if component_type not in ['attendance', 'assignment', 'test', 'exam']:
                    errors.append(f"Invalid component_type for grade_summary {grade_summary_id}")
                    continue

                score = float(score)
                max_percentage = getattr(grading_config, f'{component_type}_percentage')

                if score < 0 or score > max_percentage:
                    errors.append(f"Score {score} exceeds maximum {max_percentage}% for {component_type}")
                    continue

                # Update
                setattr(grade_summary, f'{component_type}_score', score)

                if component_type == 'attendance':
                    grade_summary.attendance_finalized = True

                grade_summary.recalculate_total_score()
                grade_summary.save()
                updated_count += 1

                # SYNC TEST SCORES TO ASSESSMENT SUBMISSION
                if component_type == 'test':
                    try:
                        from academics.models import Assessment, AssessmentSubmission

                        # Get all test assessments for this subject
                        test_assessments = Assessment.objects.filter(
                            subject=grade_summary.subject,
                            is_active=True,
                            assessment_type__in=['test_1', 'test_2', 'mid_term']
                        )

                        if test_assessments.exists():
                            # Calculate what each test should be worth in storage format
                            # score is /30 (GradeSummary format)
                            # Need to convert to /3 (AssessmentSubmission format)

                            max_test_marks = float(grading_config.test_percentage)  # 30
                            assessment_total = float(test_assessments.first().total_marks)  # 3
                            scale_factor = assessment_total / max_test_marks  # 0.1

                            # Convert score from /30 to /3
                            stored_score = score * scale_factor

                            # Distribute evenly across all test assessments
                            score_per_test = stored_score / test_assessments.count()

                            print(f"=== SYNC TEST SCORE TO SUBMISSIONS ===")
                            print(f"Student: {grade_summary.student.get_full_name()}")
                            print(f"Subject: {grade_summary.subject.name}")
                            print(f"GradeSummary test_score: {score}")
                            print(f"Test assessments count: {test_assessments.count()}")
                            print(f"Stored score (total): {stored_score}")
                            print(f"Score per test: {score_per_test}")

                            # Update or create submissions for each test
                            for assessment in test_assessments:
                                submission, created = AssessmentSubmission.objects.get_or_create(
                                    student=grade_summary.student,
                                    assessment=assessment,
                                    defaults={
                                        'time_taken': 0,
                                        'max_score': assessment.total_marks,
                                        'score': score_per_test,
                                        'is_graded': True
                                    }
                                )

                                if not created:
                                    submission.score = score_per_test
                                    submission.is_graded = True
                                    submission.save()
                                    print(f"✓ Updated submission for {assessment.title}: {score_per_test}")
                                else:
                                    print(f"✓ Created submission for {assessment.title}: {score_per_test}")

                            print(f"=====================================")

                    except Exception as sync_error:
                        print(f"WARNING: Failed to sync test score to submissions: {str(sync_error)}")
                        import traceback
                        traceback.print_exc()
                        # Don't fail the request, just log the error

            except GradeSummary.DoesNotExist:
                errors.append(f"Grade summary {grade_summary_id} not found")
            except Exception as e:
                errors.append(f"Error updating grade_summary {grade_summary_id}: {str(e)}")
                import traceback
                traceback.print_exc()

    return Response({
        'message': f'Successfully updated {updated_count} grades',
        'updated_count': updated_count,
        'errors': errors if errors else None
    })


# ============================================================================
# ATTENDANCE SYNC VIEWS (NEW - SYNC ATTENDANCE TO GRADES)
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def sync_attendance_to_grades(request):
    """
    Calculate attendance percentages from schooladmin.AttendanceRecord and update grade summaries
    This syncs attendance marked via the dashboard to the grading system
    """
    academic_year = request.data.get('academic_year')
    term = request.data.get('term')
    
    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Get grading configuration for this session (allow historical access)
        grading_config = GradingConfiguration.objects.get(
            academic_year=academic_year,
            term=term
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": f"No grading configuration found for {academic_year} - {term}. Please set up grading configuration first."},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get all class sessions for this academic year and term
    class_sessions = ClassSession.objects.filter(
        academic_year=academic_year,
        term=term
    )
    
    if not class_sessions.exists():
        return Response(
            {"detail": f"No class sessions found for {academic_year} - {term}"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if there are any attendance records at all
    total_attendance_records = AttendanceRecord.objects.filter(
        class_session__in=class_sessions
    ).count()
    
    print(f"DEBUG: Found {total_attendance_records} total attendance records for {academic_year} - {term}")
    print(f"DEBUG: Processing {class_sessions.count()} class sessions")
    
    if total_attendance_records == 0:
        return Response(
            {"detail": f"No attendance records found for {academic_year} - {term}. Please mark attendance first using the dashboard."},
            status=status.HTTP_404_NOT_FOUND
        )
    
    updated_count = 0
    skipped_count = 0
    no_attendance_count = 0
    errors_list = []
    
    # Process each class session
    for class_session in class_sessions:
        print(f"\nDEBUG: Processing class session {class_session.id} - {class_session.classroom.name}")
        
        # Get all subjects for this class session
        subjects = Subject.objects.filter(class_session=class_session)
        print(f"DEBUG: Found {subjects.count()} subjects in this class session")
        
        # Get all students in this class session
        student_sessions = StudentSession.objects.filter(
            class_session=class_session,
        ).select_related('student')
        
        print(f"DEBUG: Found {student_sessions.count()} students in this class session")
        
        for subject in subjects:
            print(f"\nDEBUG: Processing subject {subject.id} - {subject.name}")
            
            # Filter students by department if subject has one
            filtered_students = student_sessions
            
            if hasattr(subject, 'department') and subject.department:
                subject_dept = str(subject.department).strip().lower()
                if subject_dept and subject_dept not in ['general', 'all', 'none']:
                    filtered_students = filtered_students.filter(
                        student__department__iexact=subject.department
                    )
                    print(f"DEBUG: Filtered to {filtered_students.count()} students for department {subject.department}")
            
            for student_session in filtered_students:
                student = student_session.student
                
                # Get or create grade summary
                grade_summary, created = GradeSummary.objects.get_or_create(
                    student=student,
                    subject=subject,
                    grading_config=grading_config,
                    defaults={
                        'attendance_score': 0,
                        'assignment_score': 0,
                        'test_score': 0,
                        'exam_score': 0,
                    }
                )
                
                if created:
                    print(f"DEBUG: Created new grade summary for {student.username} in {subject.name}")
                
                # Skip if attendance is already finalized (manually set by admin)
                if grade_summary.attendance_finalized:
                    skipped_count += 1
                    print(f"DEBUG: Skipped {student.username} - attendance already finalized")
                    continue
                
                try:
                    # Get attendance records from schooladmin.AttendanceRecord
                    # This is where attendance is actually stored when marked via dashboard
                    student_attendance = AttendanceRecord.objects.filter(
                        student=student,
                        class_session=class_session
                    )
                    
                    total_days = student_attendance.count()
                    present_days = student_attendance.filter(is_present=True).count()
                    
                    print(f"DEBUG: {student.username} in {subject.name}: {present_days}/{total_days} days present")
                    
                    if total_days > 0:
                        # Calculate percentage
                        attendance_percentage = (present_days / total_days) * 100
                        
                        # Scale to the attendance component's weight
                        max_attendance_score = grading_config.attendance_percentage
                        attendance_score = (attendance_percentage / 100) * max_attendance_score
                        
                        # Update grade summary
                        old_score = grade_summary.attendance_score
                        grade_summary.attendance_score = round(attendance_score, 2)
                        grade_summary.recalculate_total_score()
                        grade_summary.save()
                        
                        updated_count += 1
                        print(f"DEBUG: ✓ Updated {student.username} - {subject.name}: {old_score} -> {attendance_score}% ({present_days}/{total_days} days, {attendance_percentage:.1f}%)")
                    else:
                        # No attendance records for this student
                        no_attendance_count += 1
                        if grade_summary.attendance_score != 0:
                            grade_summary.attendance_score = 0
                            grade_summary.recalculate_total_score()
                            grade_summary.save()
                        print(f"DEBUG: ✗ No attendance records for {student.username} in {subject.name}")
                        
                except Exception as e:
                    error_msg = f"Error for student {student.username} in subject {subject.name}: {str(e)}"
                    print(f"DEBUG ERROR: {error_msg}")
                    import traceback
                    traceback.print_exc()
                    errors_list.append(error_msg)
                    continue
    
    print(f"\nDEBUG: ===== SYNC COMPLETE =====")
    print(f"DEBUG: Updated: {updated_count}")
    print(f"DEBUG: Skipped: {skipped_count}")
    print(f"DEBUG: No attendance: {no_attendance_count}")
    
    response_data = {
        'message': f'Successfully synced attendance grades for {academic_year} - {term}',
        'updated_count': updated_count,
        'skipped_count': skipped_count,
        'no_attendance_count': no_attendance_count,
        'note': f'{skipped_count} students skipped (attendance finalized). {no_attendance_count} students have no attendance records.'
    }
    
    if errors_list:
        response_data['errors'] = errors_list
    
    return Response(response_data)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def sync_class_attendance_to_grades(request):
    """
    Sync attendance for a specific class session
    Useful for syncing one class at a time
    """
    class_session_id = request.data.get('class_session_id')
    
    if not class_session_id:
        return Response(
            {"detail": "class_session_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        class_session = ClassSession.objects.get(id=class_session_id)
    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get grading configuration (allow historical access)
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=class_session.academic_year,
            term=class_session.term
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": f"No grading configuration found for {class_session.academic_year} - {class_session.term}"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get all subjects for this class session
    subjects = Subject.objects.filter(class_session=class_session)
    
    # Get all students
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student')
    
    updated_count = 0
    skipped_count = 0
    
    for subject in subjects:
        for student_session in student_sessions:
            student = student_session.student
            
            # Get or create grade summary
            grade_summary, created = GradeSummary.objects.get_or_create(
                student=student,
                subject=subject,
                grading_config=grading_config,
                defaults={
                    'attendance_score': 0,
                    'assignment_score': 0,
                    'test_score': 0,
                    'exam_score': 0,
                }
            )
            
            # Skip if finalized
            if grade_summary.attendance_finalized:
                skipped_count += 1
                continue
            
            # Calculate attendance
            try:
                student_attendance = AttendanceRecord.objects.filter(
                    student=student,
                    class_session=class_session
                )
                
                total_days = student_attendance.count()
                present_days = student_attendance.filter(is_present=True).count()
                
                if total_days > 0:
                    attendance_percentage = (present_days / total_days) * 100
                    max_attendance_score = grading_config.attendance_percentage
                    attendance_score = (attendance_percentage / 100) * max_attendance_score
                    
                    grade_summary.attendance_score = round(attendance_score, 2)
                    grade_summary.recalculate_total_score()
                    grade_summary.save()
                    updated_count += 1
                    
            except Exception as e:
                print(f"Error: {str(e)}")
                continue
    
    return Response({
        'message': f'Successfully synced attendance for {class_session.classroom.name}',
        'updated_count': updated_count,
        'skipped_count': skipped_count
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def calculate_grade_summaries(request):
    """Recalculate grade summaries"""
    academic_year = request.data.get('academic_year')
    term = request.data.get('term')
    
    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=academic_year,
            term=term,
            is_active=True
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": "No grading configuration found for this session"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    subjects = Subject.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term
    )
    
    updated_count = 0
    for subject in subjects:
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session,
            is_active=True
        )
        
        for student_session in student_sessions:
            student = student_session.student
            
            summary, created = GradeSummary.objects.get_or_create(
                student=student,
                subject=subject,
                grading_config=grading_config,
                defaults={
                    'attendance_score': 0,
                    'assignment_score': 0,
                    'test_score': 0,
                    'exam_score': 0,
                }
            )
            
            components = grading_config.components.all()
            
            for component in components:
                grades = StudentGrade.objects.filter(
                    student=student,
                    subject=subject,
                    component=component
                )
                
                if grades.exists():
                    total_percentage = sum(grade.percentage_score for grade in grades)
                    avg_percentage = total_percentage / grades.count()
                    
                    if component.component_type == 'attendance':
                        summary.attendance_score = avg_percentage
                    elif component.component_type == 'assignment':
                        summary.assignment_score = avg_percentage
                    elif component.component_type == 'test':
                        summary.test_score = avg_percentage
                    elif component.component_type == 'exam':
                        summary.exam_score = avg_percentage
            
            summary.recalculate_total_score()
            summary.save()
            updated_count += 1
    
    return Response({
        'message': f'Recalculated {updated_count} grade summaries for {academic_year} - {term}',
        'updated_count': updated_count
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validate_grading_configuration(request):
    """Validate if grading configuration percentages total 100%"""
    attendance = request.GET.get('attendance_percentage', 0)
    assignment = request.GET.get('assignment_percentage', 0)
    test = request.GET.get('test_percentage', 0)
    exam = request.GET.get('exam_percentage', 0)
    
    try:
        attendance = int(attendance)
        assignment = int(assignment)
        test = int(test)
        exam = int(exam)
    except ValueError:
        return Response(
            {"detail": "All percentages must be valid integers"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    total = attendance + assignment + test + exam
    is_valid = total == 100
    
    errors = []
    if not (5 <= attendance <= 20):
        errors.append("Attendance percentage must be between 5% and 20%")
    if not (5 <= assignment <= 20):
        errors.append("Assignment percentage must be between 5% and 20%")
    
    return Response({
        'is_valid': is_valid and len(errors) == 0,
        'total_percentage': total,
        'remaining_percentage': 100 - total,
        'errors': errors,
        'breakdown': {
            'attendance': attendance,
            'assignment': assignment,
            'test': test,
            'exam': exam
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def grading_dashboard(request):
    """Get overview of grading system for dashboard"""
    user = request.user
    
    configurations = GradingConfiguration.objects.filter(is_active=True).order_by('-academic_year', 'term')
    grading_scales = GradingScale.objects.filter(is_active=True).order_by('name')
    
    recent_grades_query = StudentGrade.objects.order_by('-date_entered')[:10]
    if user.role == 'teacher':
        recent_grades_query = recent_grades_query.filter(subject__teacher=user)
    elif user.role == 'student':
        recent_grades_query = recent_grades_query.filter(student=user)
    elif user.role != 'admin':
        recent_grades_query = StudentGrade.objects.none()
    
    config_serializer = GradingConfigurationSerializer(configurations, many=True)
    scale_serializer = GradingScaleSerializer(grading_scales, many=True)
    grade_serializer = StudentGradeSerializer(recent_grades_query, many=True)
    
    return Response({
        'configurations': config_serializer.data,
        'grading_scales': scale_serializer.data,
        'recent_grades': grade_serializer.data,
        'user_role': user.role
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_grades_view(request):
    """
    Get current student's grades (attendance and released assignment grades only)
    Students can only see their own grades
    Supports filtering by academic_year and term
    """
    user = request.user
    
    if user.role != 'student':
        return Response(
            {"detail": "Only students can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get filter parameters from query string
    academic_year = request.GET.get('academic_year')
    term = request.GET.get('term')
    
    # If no filters provided, get the most recent active configuration
    if not academic_year or not term:
        try:
            latest_config = GradingConfiguration.objects.filter(is_active=True).order_by('-academic_year', 'term').first()
            
            if not latest_config:
                return Response(
                    {"detail": "No active grading configuration found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            academic_year = latest_config.academic_year
            term = latest_config.term
            
        except Exception as e:
            return Response(
                {"detail": f"Error fetching grading configuration: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # Get available academic years and terms for this student
    from academics.models import StudentSession, Subject, AssignmentSubmission, Assessment, AssessmentSubmission
    
    all_student_sessions = StudentSession.objects.filter(
        student=user
    ).select_related('class_session').order_by('-class_session__academic_year', 'class_session__term')
    
    # Build available filters
    available_sessions = []
    seen_combinations = set()
    
    for session in all_student_sessions:
        combo = (session.class_session.academic_year, session.class_session.term)
        if combo not in seen_combinations:
            seen_combinations.add(combo)
            available_sessions.append({
                'academic_year': session.class_session.academic_year,
                'term': session.class_session.term
            })
    
    # Get subjects for the selected academic year and term
    student_sessions = StudentSession.objects.filter(
        student=user,
        class_session__academic_year=academic_year,
        class_session__term=term
    ).select_related('class_session')
    
    if not student_sessions.exists():
        return Response({
            'academic_year': academic_year,
            'term': term,
            'available_sessions': available_sessions,
            'subjects': [],
            'message': 'You were not enrolled in any subjects for this term'
        })
    
    # Get all subjects from these sessions
    class_session_ids = student_sessions.values_list('class_session_id', flat=True)
    subjects = Subject.objects.filter(
        class_session_id__in=class_session_ids
    ).select_related('teacher', 'class_session__classroom')
    
    # Get grading configuration for this specific term
    grading_config = GradingConfiguration.objects.filter(
        academic_year=academic_year,
        term=term
    ).first()
    
    if not grading_config:
        return Response({
            'academic_year': academic_year,
            'term': term,
            'available_sessions': available_sessions,
            'subjects': [],
            'message': 'No grading configuration found for this term'
        })
    
    subjects_data = []
    
    for subject in subjects:
        # Get grade summary for this subject
        grade_summary = GradeSummary.objects.filter(
            student=user,
            subject=subject,
            grading_config=grading_config
        ).first()
        
        # Get assignment submissions with released grades
        released_assignments = AssignmentSubmission.objects.filter(
            student=user,
            assignment__subject=subject,
            status='graded',
            grade_released=True
        ).select_related('assignment').order_by('-graded_at')
        
        # Calculate average assignment grade
        assignment_grades = []
        for submission in released_assignments:
            if submission.score and submission.assignment.max_score:
                percentage = (float(submission.score) / float(submission.assignment.max_score)) * 100
                assignment_grades.append({
                    'assignment_title': submission.assignment.title,
                    'score': float(submission.score),
                    'max_score': submission.assignment.max_score,
                    'percentage': round(percentage, 2),
                    'graded_at': submission.graded_at.isoformat() if submission.graded_at else None,
                    'feedback': submission.feedback
                })
        
        # Calculate average assignment percentage
        avg_assignment_percentage = 0
        if assignment_grades:
            avg_assignment_percentage = sum(g['percentage'] for g in assignment_grades) / len(assignment_grades)

        # Get released test assessments and scores
        test_assessments = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            is_released=True,
            assessment_type__in=['test_1', 'test_2', 'mid_term']
        )

        test_scores = []
        test_visible = False
        avg_test_percentage = 0

        if test_assessments.exists():
            test_visible = True
            for assessment in test_assessments:
                try:
                    submission = AssessmentSubmission.objects.get(
                        student=user,
                        assessment=assessment
                    )
                    if submission.score and assessment.total_marks:
                        percentage = (float(submission.score) / float(assessment.total_marks)) * 100
                        test_scores.append({
                            'test_title': assessment.title,
                            'test_type': assessment.get_assessment_type_display(),
                            'score': float(submission.score),
                            'max_score': float(assessment.total_marks),
                            'percentage': round(percentage, 2),
                            'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None
                        })
                except AssessmentSubmission.DoesNotExist:
                    # Student hasn't submitted this test
                    test_scores.append({
                        'test_title': assessment.title,
                        'test_type': assessment.get_assessment_type_display(),
                        'score': 0,
                        'max_score': float(assessment.total_marks),
                        'percentage': 0,
                        'submitted_at': None,
                        'not_submitted': True
                    })

            # Calculate average test percentage (only for submitted tests)
            submitted_tests = [t for t in test_scores if not t.get('not_submitted', False)]
            if submitted_tests:
                avg_test_percentage = sum(t['percentage'] for t in submitted_tests) / len(submitted_tests)

        # Get released exam assessments and scores
        exam_assessments = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            is_released=True,
            assessment_type='final_exam'
        )

        exam_scores = []
        exam_visible = False
        avg_exam_percentage = 0

        if exam_assessments.exists():
            exam_visible = True
            for assessment in exam_assessments:
                try:
                    submission = AssessmentSubmission.objects.get(
                        student=user,
                        assessment=assessment
                    )
                    if submission.score and assessment.total_marks:
                        percentage = (float(submission.score) / float(assessment.total_marks)) * 100
                        exam_scores.append({
                            'exam_title': assessment.title,
                            'score': float(submission.score),
                            'max_score': float(assessment.total_marks),
                            'percentage': round(percentage, 2),
                            'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None
                        })
                except AssessmentSubmission.DoesNotExist:
                    # Student hasn't submitted this exam
                    exam_scores.append({
                        'exam_title': assessment.title,
                        'score': 0,
                        'max_score': float(assessment.total_marks),
                        'percentage': 0,
                        'submitted_at': None,
                        'not_submitted': True
                    })

            # Calculate average exam percentage (only for submitted exams)
            submitted_exams = [e for e in exam_scores if not e.get('not_submitted', False)]
            if submitted_exams:
                avg_exam_percentage = sum(e['percentage'] for e in submitted_exams) / len(submitted_exams)

        # Check for manual test scores from GradeSummary (entered in Results section)
        manual_test_score = 0
        manual_test_visible = False
        if grade_summary and grade_summary.test_score and float(grade_summary.test_score) > 0:
            manual_test_score = float(grade_summary.test_score)
            manual_test_visible = True

        # Check for manual exam scores from GradeSummary (entered in Results section)
        manual_exam_score = 0
        manual_exam_visible = False
        if grade_summary and grade_summary.exam_score and float(grade_summary.exam_score) > 0:
            manual_exam_score = float(grade_summary.exam_score)
            manual_exam_visible = True

        # Combine manual and online test visibility
        combined_test_visible = test_visible or manual_test_visible
        combined_exam_visible = exam_visible or manual_exam_visible

        subjects_data.append({
            'subject_id': subject.id,
            'subject_name': subject.name,
            'subject_code': getattr(subject, 'code', None),
            'teacher_name': f"{subject.teacher.first_name} {subject.teacher.last_name}" if subject.teacher else "Not Assigned",
            'class_name': subject.class_session.classroom.name if subject.class_session.classroom else "Unknown",
            'department': subject.department,

            # Attendance score
            'attendance_score': float(grade_summary.attendance_score) if grade_summary else 0,
            'attendance_max': grading_config.attendance_percentage,
            'attendance_percentage': round((float(grade_summary.attendance_score) / grading_config.attendance_percentage * 100), 2) if grade_summary and grade_summary.attendance_score else 0,

            # Assignment grades (only released)
            'assignment_count': len(assignment_grades),
            'assignment_average': round(avg_assignment_percentage, 2),
            'assignment_details': assignment_grades,

            # Manual test score from GradeSummary (Results section)
            'manual_test_score': manual_test_score,
            'manual_test_max': grading_config.test_percentage,
            'manual_test_visible': manual_test_visible,

            # Online test scores (only released)
            'test_visible': combined_test_visible,
            'test_count': len(test_scores),
            'test_average': round(avg_test_percentage, 2),
            'test_details': test_scores,

            # Manual exam score from GradeSummary (Results section)
            'manual_exam_score': manual_exam_score,
            'manual_exam_max': grading_config.exam_percentage,
            'manual_exam_visible': manual_exam_visible,

            # Online exam scores (only released)
            'exam_visible': combined_exam_visible,
            'exam_count': len(exam_scores),
            'exam_average': round(avg_exam_percentage, 2),
            'exam_details': exam_scores,

            # Last updated
            'last_updated': grade_summary.last_calculated.isoformat() if grade_summary else None
        })
    
    return Response({
        'academic_year': academic_year,
        'term': term,
        'available_sessions': available_sessions,
        'grading_config': {
            'attendance_percentage': grading_config.attendance_percentage,
            'assignment_percentage': grading_config.assignment_percentage,
            'test_percentage': grading_config.test_percentage,
            'exam_percentage': grading_config.exam_percentage,
        },
        'grading_scale': {
            'a_min': grading_config.grading_scale.a_min_score,
            'b_min': grading_config.grading_scale.b_min_score,
            'c_min': grading_config.grading_scale.c_min_score,
            'd_min': grading_config.grading_scale.d_min_score,
        },
        'subjects': subjects_data,
        'total_subjects': len(subjects_data)
    })


# ============================================================================
# TEACHER MANUAL GRADING VIEWS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def get_teacher_subjects_for_grading(request):
    """
    Get all subjects assigned to the teacher for manual grading
    Returns subjects where no online assessments have been set
    """
    from academics.models import Assessment

    user = request.user

    # Get subjects where user is the teacher
    subjects = Subject.objects.filter(
        teacher=user
    ).select_related('class_session', 'class_session__classroom')

    subjects_data = []
    for subject in subjects:
        class_session = subject.class_session

        # Check if there are any assessments (tests or exams) for this subject
        has_tests = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            assessment_type__in=['test_1', 'test_2', 'mid_term']
        ).exists()

        has_exams = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            assessment_type='final_exam'
        ).exists()

        # Teacher can only manually grade if NO assessments exist
        can_grade_test = not has_tests
        can_grade_exam = not has_exams

        subjects_data.append({
            'id': subject.id,
            'name': subject.name,
            'class_name': class_session.classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
            'can_grade_test': can_grade_test,
            'can_grade_exam': can_grade_exam,
            'has_tests': has_tests,
            'has_exams': has_exams
        })

    return Response({
        'subjects': subjects_data,
        'count': len(subjects_data)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def get_students_for_manual_grading(request, subject_id):
    """
    Get all students for a subject with their current test/exam scores
    and whether they can still be edited
    """
    from academics.models import Assessment
    from decimal import Decimal

    user = request.user

    try:
        subject = Subject.objects.get(id=subject_id)
    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check if user is the teacher for this subject
    if subject.teacher != user and user.role != 'admin':
        return Response(
            {"detail": "You are not authorized to grade this subject"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check grading capability
    has_tests = Assessment.objects.filter(
        subject=subject,
        is_active=True,
        assessment_type__in=['test_1', 'test_2', 'mid_term']
    ).exists()

    has_exams = Assessment.objects.filter(
        subject=subject,
        is_active=True,
        assessment_type='final_exam'
    ).exists()

    can_grade_test = not has_tests
    can_grade_exam = not has_exams

    class_session = subject.class_session

    # Get grading configuration (allow historical access)
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=class_session.academic_year,
            term=class_session.term
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": f"No grading configuration found for {class_session.academic_year} - {class_session.term}"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get all students in the class
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student')

    students_data = []
    for student_session in student_sessions:
        student = student_session.student

        # Get or create grade summary
        grade_summary, created = GradeSummary.objects.get_or_create(
            student=student,
            subject=subject,
            grading_config=grading_config,
            defaults={
                'attendance_score': 0,
                'assignment_score': 0,
                'test_score': 0,
                'exam_score': 0,
            }
        )

        students_data.append({
            'id': student.id,
            'username': student.username,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'full_name': f"{student.first_name} {student.last_name}",
            'grade_summary_id': grade_summary.id,
            'test_score': float(grade_summary.test_score),
            'exam_score': float(grade_summary.exam_score),
            'test_locked': grade_summary.test_manual_entry,  # Already entered once
            'exam_locked': grade_summary.exam_manual_entry,  # Already entered once
        })

    return Response({
        'subject': {
            'id': subject.id,
            'name': subject.name,
            'class_name': class_session.classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
        },
        'grading_config': {
            'test_percentage': grading_config.test_percentage,
            'exam_percentage': grading_config.exam_percentage,
        },
        'can_grade_test': can_grade_test,
        'can_grade_exam': can_grade_exam,
        'students': students_data,
        'count': len(students_data)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def save_manual_grades(request, subject_id):
    """
    Save manual test/exam grades for students
    Can only be done once per student per component
    """
    from decimal import Decimal
    from academics.models import Assessment

    user = request.user

    try:
        subject = Subject.objects.get(id=subject_id)
    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check if user is the teacher for this subject
    if subject.teacher != user and user.role != 'admin':
        return Response(
            {"detail": "You are not authorized to grade this subject"},
            status=status.HTTP_403_FORBIDDEN
        )

    grades = request.data.get('grades', [])
    grade_type = request.data.get('grade_type')  # 'test' or 'exam'

    if grade_type not in ['test', 'exam']:
        return Response(
            {"detail": "Invalid grade type. Must be 'test' or 'exam'"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check if online assessments exist
    if grade_type == 'test':
        has_assessments = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            assessment_type__in=['test_1', 'test_2', 'mid_term']
        ).exists()
    else:
        has_assessments = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            assessment_type='final_exam'
        ).exists()

    if has_assessments:
        return Response(
            {"detail": f"Cannot manually grade {grade_type}s because online assessments exist for this subject"},
            status=status.HTTP_400_BAD_REQUEST
        )

    class_session = subject.class_session

    # Get grading configuration (allow historical access)
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=class_session.academic_year,
            term=class_session.term
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": f"No grading configuration found for {class_session.academic_year} - {class_session.term}"},
            status=status.HTTP_404_NOT_FOUND
        )

    max_percentage = grading_config.test_percentage if grade_type == 'test' else grading_config.exam_percentage
    updated_count = 0
    errors = []

    with transaction.atomic():
        for grade_data in grades:
            student_id = grade_data.get('student_id')
            score = grade_data.get('score')

            try:
                student = CustomUser.objects.get(id=student_id, role='student')

                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )

                # Check if already manually entered
                if grade_type == 'test' and grade_summary.test_manual_entry:
                    errors.append(f"{student.username}: Test grade already entered and locked")
                    continue

                if grade_type == 'exam' and grade_summary.exam_manual_entry:
                    errors.append(f"{student.username}: Exam grade already entered and locked")
                    continue

                # Validate score
                score_decimal = Decimal(str(score))
                if score_decimal < 0 or score_decimal > max_percentage:
                    errors.append(f"{student.username}: Score must be between 0 and {max_percentage}")
                    continue

                # Update the grade
                if grade_type == 'test':
                    grade_summary.test_score = score_decimal
                    grade_summary.test_manual_entry = True
                else:
                    grade_summary.exam_score = score_decimal
                    grade_summary.exam_manual_entry = True

                grade_summary.recalculate_total_score()
                grade_summary.save()
                updated_count += 1

            except CustomUser.DoesNotExist:
                errors.append(f"Student with ID {student_id} not found")
            except GradeSummary.DoesNotExist:
                errors.append(f"Grade summary not found for student ID {student_id}")
            except Exception as e:
                errors.append(f"Error for student ID {student_id}: {str(e)}")

    return Response({
        'message': f'Successfully updated {updated_count} {grade_type} grades',
        'updated_count': updated_count,
        'errors': errors if errors else None
    }, status=status.HTTP_200_OK if not errors else status.HTTP_207_MULTI_STATUS)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_test_completion_stats(request):
    """
    Calculate test completion statistics for all classes in a given academic year and term.

    Returns the percentage of students who have completed tests for all their subjects in each class.
    100% means all students in the class have completed tests for all their subjects.
    """
    academic_year = request.GET.get('academic_year')
    term = request.GET.get('term')

    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term parameters are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        print(f"Fetching test stats for {academic_year} - {term}")

        # Get all class sessions for the selected academic year and term
        class_sessions = ClassSession.objects.filter(
            academic_year=academic_year,
            term=term
        ).select_related('classroom')

        print(f"Found {class_sessions.count()} class sessions")

        if not class_sessions.exists():
            return Response({
                'stats': [],
                'academic_year': academic_year,
                'term': term,
                'message': f'No class sessions found for {academic_year} - {term}'
            })

        class_stats = []

        for class_session in class_sessions:
            try:
                print(f"Processing class: {class_session.classroom.name}")

                # Get all active students in this class
                student_sessions = StudentSession.objects.filter(
                    class_session=class_session,
                ).select_related('student')

                total_students = student_sessions.count()
                print(f"  Total students: {total_students}")

                if total_students == 0:
                    class_stats.append({
                        'class_id': class_session.classroom.id,
                        'class_name': class_session.classroom.name,
                        'session_id': class_session.id,
                        'total_students': 0,
                        'students_completed': 0,
                        'completion_percentage': 0,
                        'total_subjects': 0,
                    })
                    continue

                # Get all subjects for this class
                subjects = Subject.objects.filter(
                    class_session=class_session
                )

                total_subjects = subjects.count()
                print(f"  Total subjects: {total_subjects}")

                if total_subjects == 0:
                    class_stats.append({
                        'class_id': class_session.classroom.id,
                        'class_name': class_session.classroom.name,
                        'session_id': class_session.id,
                        'total_students': total_students,
                        'students_completed': 0,
                        'completion_percentage': 0,
                        'total_subjects': 0,
                    })
                    continue

                # Count how many subjects have test assessments (online or manual)
                subjects_with_tests = 0
                subjects_with_online_tests = []

                # Get the grading config for this term
                grading_config = GradingConfiguration.objects.filter(
                    academic_year=academic_year,
                    term=term,
                    is_active=True
                ).first()

                for subject in subjects:
                    has_online_test = Assessment.objects.filter(
                        subject=subject,
                        is_active=True,
                        is_released=True,
                        assessment_type__in=['test_1', 'test_2', 'mid_term']
                    ).exists()

                    if has_online_test:
                        subjects_with_tests += 1
                        subjects_with_online_tests.append(subject.id)
                    elif grading_config:
                        # Check if any student has manual test score for this subject
                        has_manual_test = GradeSummary.objects.filter(
                            subject=subject,
                            grading_config=grading_config,
                            test_score__gt=0
                        ).exists()
                        if has_manual_test:
                            subjects_with_tests += 1

                print(f"  Subjects with tests (online + manual): {subjects_with_tests}")

                # If no tests are set up (neither online nor manual), mark all as 0% completion
                if subjects_with_tests == 0:
                    class_stats.append({
                        'class_id': class_session.classroom.id,
                        'class_name': class_session.classroom.name,
                        'session_id': class_session.id,
                        'total_students': total_students,
                        'students_completed': 0,
                        'completion_percentage': 0,
                        'total_subjects': total_subjects,
                        'total_possible_submissions': 0,
                    })
                    continue

                # Count total test submissions vs total possible submissions
                # Include ALL subjects (even those without tests yet) in the calculation
                total_possible_submissions = total_students * total_subjects
                total_actual_submissions = 0

                for subject in subjects:
                    # Check if there are any test assessments for this subject (online)
                    test_assessments = Assessment.objects.filter(
                        subject=subject,
                        is_active=True,
                        is_released=True,
                        assessment_type__in=['test_1', 'test_2', 'mid_term']
                    )

                    # Check if there are manually entered tests for this subject
                    has_manual_test_for_subject = False
                    if grading_config:
                        has_manual_test_for_subject = GradeSummary.objects.filter(
                            subject=subject,
                            grading_config=grading_config,
                            test_score__gt=0
                        ).exists()

                    # Count completions for this subject (will be 0 if no tests exist)
                    subject_submissions = 0

                    if test_assessments.exists() or has_manual_test_for_subject:
                        # This subject has tests, count how many students completed it
                        for student_session in student_sessions:
                            student = student_session.student

                            # Check if student has submitted test for this subject (online)
                            has_submission = AssessmentSubmission.objects.filter(
                                student=student,
                                assessment__in=test_assessments
                            ).exists() if test_assessments.exists() else False

                            # Check if test was manually entered in GradeSummary
                            has_manual_entry = False
                            if grading_config and not has_submission:
                                try:
                                    grade_summary = GradeSummary.objects.get(
                                        student=student,
                                        subject=subject,
                                        grading_config=grading_config
                                    )
                                    has_manual_entry = float(grade_summary.test_score or 0) > 0
                                except GradeSummary.DoesNotExist:
                                    pass

                            # Count if student completed via either submission or manual entry
                            if has_submission or has_manual_entry:
                                subject_submissions += 1

                    total_actual_submissions += subject_submissions

                completion_percentage = round((total_actual_submissions / total_possible_submissions) * 100) if total_possible_submissions > 0 else 0
                print(f"  Completed: {total_actual_submissions}/{total_possible_submissions} submissions ({completion_percentage}%)")

                class_stats.append({
                    'class_id': class_session.classroom.id,
                    'class_name': class_session.classroom.name,
                    'session_id': class_session.id,
                    'total_students': total_students,
                    'students_completed': total_actual_submissions,
                    'completion_percentage': completion_percentage,
                    'total_subjects': total_subjects,
                    'total_possible_submissions': total_possible_submissions,
                })

            except Exception as class_error:
                print(f"  Error processing class {class_session.classroom.name}: {str(class_error)}")
                import traceback
                traceback.print_exc()
                # Continue with next class
                continue

        # Sort by completion percentage (lowest first to highlight classes needing attention)
        class_stats.sort(key=lambda x: x['completion_percentage'])

        print(f"Returning {len(class_stats)} class stats")

        return Response({
            'stats': class_stats,
            'academic_year': academic_year,
            'term': term,
            'message': 'success'
        })

    except Exception as e:
        print(f"Error in get_test_completion_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error calculating test statistics: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_subjects_for_tests(request, class_session_id):
    """
    Get all subjects for a class session with test completion statistics.
    Used when clicking on a class in the Tests Average tile.

    Returns subjects with:
    - subject_id, subject_name
    - total_students in the class
    - students_completed (students who submitted tests for this subject)
    - completion_percentage
    - has_tests (whether this subject has any test assessments - online or manual)
    """
    try:
        class_session = ClassSession.objects.select_related('classroom').get(id=class_session_id)

        # Get all subjects for this class
        subjects = Subject.objects.filter(class_session=class_session)

        # Get total students in this class
        total_students = StudentSession.objects.filter(
            class_session=class_session,
        ).count()

        # Get grading config for checking manual entries
        grading_config = GradingConfiguration.objects.filter(
            academic_year=class_session.academic_year,
            term=class_session.term,
            is_active=True
        ).first()

        subject_stats = []

        for subject in subjects:
            # Check if subject has test assessments (online)
            test_assessments = Assessment.objects.filter(
                subject=subject,
                is_active=True,
                is_released=True,
                assessment_type__in=['test_1', 'test_2', 'mid_term']
            )

            has_online_tests = test_assessments.exists()
            has_manual_tests = False
            students_completed = 0

            if has_online_tests:
                # Count students who submitted at least one test for this subject (online)
                students_with_submissions = AssessmentSubmission.objects.filter(
                    assessment__in=test_assessments
                ).values_list('student', flat=True).distinct()
                students_completed = len(students_with_submissions)
            elif grading_config:
                # Check for manual test scores in GradeSummary
                manual_test_scores = GradeSummary.objects.filter(
                    subject=subject,
                    grading_config=grading_config,
                    test_score__gt=0
                )
                has_manual_tests = manual_test_scores.exists()
                if has_manual_tests:
                    students_completed = manual_test_scores.count()

            has_tests = has_online_tests or has_manual_tests
            completion_percentage = round((students_completed / total_students) * 100) if total_students > 0 else 0

            subject_stats.append({
                'subject_id': subject.id,
                'subject_name': subject.name,
                'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'No teacher assigned',
                'total_students': total_students,
                'students_completed': students_completed,
                'completion_percentage': completion_percentage,
                'has_tests': has_tests,
                'has_online_tests': has_online_tests,
                'has_manual_tests': has_manual_tests,
                'test_count': test_assessments.count() if has_online_tests else (1 if has_manual_tests else 0)
            })

        return Response({
            'class_name': class_session.classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
            'subjects': subject_stats
        })

    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error fetching class subjects: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error fetching subjects: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subject_test_scores(request, subject_id):
    """
    Get all students and their test scores for a specific subject.
    Used when clicking on a subject in the class subjects modal.

    Returns:
    - subject details
    - list of students with their test scores for each assessment
    - whether scores are locked/unlocked
    - SCALED scores based on GradingConfiguration.test_percentage
    """
    try:
        subject = Subject.objects.select_related('class_session__classroom', 'teacher').get(id=subject_id)

        # Get grading configuration for this session
        try:
            grading_config = GradingConfiguration.objects.get(
                academic_year=subject.class_session.academic_year,
                term=subject.class_session.term,
                is_active=True
            )
            # Use test_percentage as the max marks (e.g., 30)
            max_test_marks = float(grading_config.test_percentage)
        except GradingConfiguration.DoesNotExist:
            # Fallback to 30 if no config exists
            max_test_marks = 30.0
            print(f"WARNING: No grading config found for {subject.class_session.academic_year} - {subject.class_session.term}")

        # Get all test assessments for this subject
        test_assessments = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            assessment_type__in=['test_1', 'test_2', 'mid_term']
        ).order_by('assessment_type')

        # Get all students in this class (including historic data)
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session
        ).select_related('student').order_by('student__last_name', 'student__first_name')

        students_data = []
        has_online_tests = test_assessments.exists()
        has_manual_tests = False

        # Check if there are manual test scores in GradeSummary
        if not has_online_tests:
            try:
                grading_config_obj = GradingConfiguration.objects.get(
                    academic_year=subject.class_session.academic_year,
                    term=subject.class_session.term,
                    is_active=True
                )
                has_manual_tests = GradeSummary.objects.filter(
                    subject=subject,
                    grading_config=grading_config_obj,
                    test_score__gt=0
                ).exists()
            except GradingConfiguration.DoesNotExist:
                pass

        for student_session in student_sessions:
            student = student_session.student
            test_scores = []

            if has_online_tests:
                # Handle online assessments
                for assessment in test_assessments:
                    # Calculate scaling factor: if assessment.total_marks=3 and max_test_marks=30, scale_factor=10
                    scale_factor = max_test_marks / float(assessment.total_marks) if float(assessment.total_marks) > 0 else 1

                    # Get submission for this student and assessment
                    try:
                        submission = AssessmentSubmission.objects.get(
                            student=student,
                            assessment=assessment
                        )
                        # Scale the score: if submission.score=3 and scale_factor=10, display as 30
                        scaled_score = float(submission.score) * scale_factor if submission.score else 0

                        test_scores.append({
                            'assessment_id': assessment.id,
                            'assessment_type': assessment.assessment_type,
                            'assessment_type_display': assessment.get_assessment_type_display(),
                            'title': assessment.title,
                            'score': round(scaled_score, 2),  # Display scaled score
                            'total_marks': max_test_marks,  # Display max marks from grading config
                            'is_submitted': True,
                            'is_released': assessment.is_released,
                            'submission_id': submission.id,
                            'is_manual': False
                        })
                    except AssessmentSubmission.DoesNotExist:
                        test_scores.append({
                            'assessment_id': assessment.id,
                            'assessment_type': assessment.assessment_type,
                            'assessment_type_display': assessment.get_assessment_type_display(),
                            'title': assessment.title,
                            'score': 0,
                            'total_marks': max_test_marks,  # Display max marks from grading config
                            'is_submitted': False,
                            'is_released': assessment.is_released,
                            'submission_id': None,
                            'is_manual': False
                        })
            elif has_manual_tests:
                # Handle manual test scores from GradeSummary
                try:
                    grading_config_obj = GradingConfiguration.objects.get(
                        academic_year=subject.class_session.academic_year,
                        term=subject.class_session.term,
                        is_active=True
                    )
                    grade_summary = GradeSummary.objects.filter(
                        student=student,
                        subject=subject,
                        grading_config=grading_config_obj
                    ).first()

                    test_scores.append({
                        'assessment_id': None,
                        'assessment_type': 'manual',
                        'assessment_type_display': 'Manual Test Score',
                        'title': 'Test Score (Manual Entry)',
                        'score': float(grade_summary.test_score) if grade_summary and grade_summary.test_score else 0,
                        'total_marks': max_test_marks,
                        'is_submitted': grade_summary and float(grade_summary.test_score or 0) > 0,
                        'is_released': True,  # Manual scores are always released
                        'submission_id': grade_summary.id if grade_summary else None,
                        'is_manual': True
                    })
                except GradingConfiguration.DoesNotExist:
                    pass

            students_data.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'username': student.username,
                'test_scores': test_scores
            })

        # Build assessments list for response
        if has_online_tests:
            assessments_list = [{
                'id': a.id,
                'type': a.assessment_type,
                'type_display': a.get_assessment_type_display(),
                'title': a.title,
                'total_marks': max_test_marks,
                'is_released': a.is_released,
                'is_manual': False
            } for a in test_assessments]
        elif has_manual_tests:
            assessments_list = [{
                'id': None,
                'type': 'manual',
                'type_display': 'Manual Test Score',
                'title': 'Test Score (Manual Entry)',
                'total_marks': max_test_marks,
                'is_released': True,
                'is_manual': True
            }]
        else:
            assessments_list = []

        return Response({
            'subject_id': subject.id,
            'subject_name': subject.name,
            'class_name': subject.class_session.classroom.name,
            'academic_year': subject.class_session.academic_year,
            'term': subject.class_session.term,
            'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'No teacher assigned',
            'students': students_data,
            'assessments': assessments_list,
            'max_test_marks': max_test_marks,
            'has_manual_tests': has_manual_tests,
            'has_online_tests': has_online_tests
        })

    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error fetching test scores: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error fetching test scores: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_test_score(request):
    """
    Update a student's test score for a specific assessment OR manual test score.
    Creates a submission if one doesn't exist (for manual grading).
    SCALES score from /30 (frontend) to /3 (database storage).
    SYNCS with GradeSummary.test_score.

    Body:
    - student_id: ID of the student (required if no submission_id)
    - assessment_id: ID of the assessment (required if no submission_id, can be null for manual)
    - submission_id: ID of the AssessmentSubmission (optional - will be used if exists)
    - score: New score value in SCALED format (/30) (required)
    - is_manual: Boolean to indicate if this is a manual test score (optional)
    - subject_id: ID of the subject (required for manual scores when no assessment_id)
    """
    try:
        submission_id = request.data.get('submission_id')
        student_id = request.data.get('student_id')
        assessment_id = request.data.get('assessment_id')
        scaled_score = request.data.get('score')  # This comes as /30
        is_manual = request.data.get('is_manual', False)
        subject_id = request.data.get('subject_id')

        print(f"=== UPDATE TEST SCORE (SCALED) ===")
        print(f"Submission ID: {submission_id}")
        print(f"Student ID: {student_id}")
        print(f"Assessment ID: {assessment_id}")
        print(f"Scaled Score (from frontend): {scaled_score}")
        print(f"Is Manual: {is_manual}")
        print(f"Subject ID: {subject_id}")

        if scaled_score is None:
            return Response(
                {"detail": "score is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle MANUAL test score updates (no assessment, direct GradeSummary update)
        if is_manual or (not assessment_id and subject_id):
            print(f"=== MANUAL TEST SCORE UPDATE ===")
            from django.contrib.auth import get_user_model
            from decimal import Decimal
            User = get_user_model()

            if not student_id or not subject_id:
                return Response(
                    {"detail": "student_id and subject_id are required for manual test scores"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                student = User.objects.get(id=student_id)
                subject = Subject.objects.select_related('class_session').get(id=subject_id)
            except (User.DoesNotExist, Subject.DoesNotExist):
                return Response(
                    {"detail": "Student or Subject not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get grading configuration
            try:
                grading_config = GradingConfiguration.objects.get(
                    academic_year=subject.class_session.academic_year,
                    term=subject.class_session.term,
                    is_active=True
                )
                max_test_marks = float(grading_config.test_percentage)
            except GradingConfiguration.DoesNotExist:
                max_test_marks = 30.0
                grading_config = None
                print(f"WARNING: No grading config found, using default max_test_marks=30")

            # Validate score
            if float(scaled_score) > max_test_marks:
                return Response(
                    {"detail": f"Score cannot exceed {max_test_marks}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not grading_config:
                return Response(
                    {"detail": "Grading configuration not found for this term"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update or create GradeSummary directly
            grade_summary, created = GradeSummary.objects.get_or_create(
                student=student,
                subject=subject,
                grading_config=grading_config,
                defaults={'test_score': Decimal(str(round(float(scaled_score), 2)))}
            )

            if not created:
                grade_summary.test_score = Decimal(str(round(float(scaled_score), 2)))
                grade_summary.test_manual_entry = True  # Mark as manually entered
                grade_summary.recalculate_total_score()
                grade_summary.save()
                print(f"✓ GradeSummary updated: test_score={grade_summary.test_score}")
            else:
                grade_summary.test_manual_entry = True
                grade_summary.recalculate_total_score()
                grade_summary.save()
                print(f"✓ GradeSummary created: test_score={grade_summary.test_score}")

            print(f"======================")

            return Response({
                'message': 'Manual test score updated successfully',
                'submission_id': grade_summary.id,  # Return GradeSummary ID for manual scores
                'new_score': float(scaled_score),
                'student_name': student.get_full_name(),
                'is_manual': True
            })

        # Handle ONLINE test score updates (AssessmentSubmission)
        # If submission_id exists, update it
        if submission_id:
            try:
                submission = AssessmentSubmission.objects.select_related('assessment__subject__class_session', 'student').get(id=submission_id)
            except AssessmentSubmission.DoesNotExist:
                return Response(
                    {"detail": "Submission not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        # Otherwise, create or get submission using student_id and assessment_id
        elif student_id and assessment_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()

            try:
                student = User.objects.get(id=student_id)
                assessment = Assessment.objects.select_related('subject__class_session').get(id=assessment_id)
            except (User.DoesNotExist, Assessment.DoesNotExist):
                return Response(
                    {"detail": "Student or Assessment not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get or create submission for manual grading
            submission, created = AssessmentSubmission.objects.get_or_create(
                student=student,
                assessment=assessment,
                defaults={
                    'time_taken': 0,  # Manual entry, no time taken
                    'max_score': assessment.total_marks,
                    'score': 0,
                    'is_graded': True  # Mark as manually graded
                }
            )

            if created:
                print(f"Created new submission for manual grading")
        else:
            return Response(
                {"detail": "Either submission_id OR (student_id AND assessment_id) OR (student_id AND subject_id for manual) are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get grading configuration for scaling
        try:
            grading_config = GradingConfiguration.objects.get(
                academic_year=submission.assessment.subject.class_session.academic_year,
                term=submission.assessment.subject.class_session.term,
                is_active=True
            )
            max_test_marks = float(grading_config.test_percentage)  # e.g., 30
        except GradingConfiguration.DoesNotExist:
            max_test_marks = 30.0
            print(f"WARNING: No grading config found, using default max_test_marks=30")

        # Calculate scale factor to convert from display (/30) to storage (/3)
        scale_factor = float(submission.assessment.total_marks) / max_test_marks
        # If max_test_marks=30 and total_marks=3, scale_factor=0.1
        # If scaled_score=30, stored_score=30*0.1=3

        stored_score = float(scaled_score) * scale_factor

        print(f"Student: {submission.student.get_full_name()}")
        print(f"Assessment: {submission.assessment.title}")
        print(f"Old score (stored): {submission.score}")
        print(f"Max test marks (config): {max_test_marks}")
        print(f"Assessment total marks (DB): {submission.assessment.total_marks}")
        print(f"Scale factor (to storage): {scale_factor}")
        print(f"Scaled score (display /30): {scaled_score}")
        print(f"Stored score (DB /3): {stored_score}")

        # Validate scaled score doesn't exceed max test marks
        if float(scaled_score) > max_test_marks:
            return Response(
                {"detail": f"Score cannot exceed {max_test_marks}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update submission with stored score
        submission.score = stored_score
        submission.is_graded = True
        submission.save()

        print(f"✓ Submission updated")

        # SYNC TO GRADE SUMMARY
        # Calculate average of all test submissions for this student/subject
        try:
            from decimal import Decimal

            subject = submission.assessment.subject
            student = submission.student

            # Get all test assessments for this subject
            test_assessments = Assessment.objects.filter(
                subject=subject,
                is_active=True,
                assessment_type__in=['test_1', 'test_2', 'mid_term']
            )

            # Get all submissions for this student
            test_submissions = AssessmentSubmission.objects.filter(
                student=student,
                assessment__in=test_assessments
            )

            if test_submissions.exists():
                # Calculate average score (in stored format /3)
                total_stored = sum(float(sub.score) for sub in test_submissions)
                count = test_submissions.count()
                avg_stored = total_stored / count

                # Scale to /30 for GradeSummary
                avg_scaled = avg_stored / scale_factor

                print(f"Test submissions count: {count}")
                print(f"Average stored score: {avg_stored}")
                print(f"Average scaled score (for GradeSummary): {avg_scaled}")

                # Update or create GradeSummary
                grade_summary, created = GradeSummary.objects.get_or_create(
                    student=student,
                    subject=subject,
                    grading_config=grading_config,
                    defaults={'test_score': Decimal(str(round(avg_scaled, 2)))}
                )

                if not created:
                    grade_summary.test_score = Decimal(str(round(avg_scaled, 2)))
                    grade_summary.recalculate_total_score()
                    grade_summary.save()
                    print(f"✓ GradeSummary updated: test_score={grade_summary.test_score}")
                else:
                    print(f"✓ GradeSummary created: test_score={grade_summary.test_score}")

        except Exception as sync_error:
            print(f"WARNING: Failed to sync with GradeSummary: {str(sync_error)}")
            # Don't fail the request, just log the error

        print(f"======================")

        return Response({
            'message': 'Score updated successfully and synced with grade summary',
            'submission_id': submission.id,
            'new_score': float(scaled_score),  # Return scaled score
            'student_name': submission.student.get_full_name()
        })

    except Exception as e:
        print(f"Error updating test score: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error updating score: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def unlock_test_scores(request):
    """
    Unlock test scores (release assessments) with filters.

    Body:
    - academic_year: Academic year (optional)
    - term: Term (optional)
    - subject_id: Specific subject (optional)
    - class_session_id: Specific class session (optional)

    If no filters provided, unlocks ALL test assessments.
    """
    try:
        academic_year = request.data.get('academic_year')
        term = request.data.get('term')
        subject_id = request.data.get('subject_id')
        class_session_id = request.data.get('class_session_id')

        # Start with all test assessments
        assessments = Assessment.objects.filter(
            is_active=True,
            assessment_type__in=['test_1', 'test_2', 'mid_term']
        )

        # Apply filters
        if subject_id:
            assessments = assessments.filter(subject_id=subject_id)

        if class_session_id:
            assessments = assessments.filter(subject__class_session_id=class_session_id)

        if academic_year:
            assessments = assessments.filter(subject__class_session__academic_year=academic_year)

        if term:
            assessments = assessments.filter(subject__class_session__term=term)

        count = assessments.count()
        assessments.update(is_released=True)

        return Response({
            'message': f'Successfully unlocked test scores for {count} assessment(s)',
            'count': count
        })

    except Exception as e:
        print(f"Error unlocking test scores: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error unlocking test scores: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# REPORT SHEET API
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_students_for_report(request):
    """
    Get all students for report generation.

    Query Parameters:
    - academic_year: Academic year (required)
    - term: Term (required)
    - class_id: Class ID (optional) - if provided, filters by class

    Returns list of students with basic info.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')
    class_id = request.query_params.get('class_id')

    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # If class_id is provided, filter by specific class
        if class_id:
            from academics.models import Class
            classroom = Class.objects.get(id=class_id)

            class_session = ClassSession.objects.filter(
                classroom=classroom,
                academic_year=academic_year,
                term=term
            ).first()

            if not class_session:
                return Response(
                    {"detail": "No class session found for the specified parameters"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get all students in this specific class session
            # DO NOT filter by is_active - we need historical students too!
            student_sessions = StudentSession.objects.filter(
                class_session=class_session,
            ).select_related('student').order_by('student__last_name', 'student__first_name')

            class_name = classroom.name
        else:
            # No class_id provided - get all students for this academic year and term
            all_class_sessions = ClassSession.objects.filter(
                academic_year=academic_year,
                term=term
            )

            # DO NOT filter by is_active - we need to access historical student data!
            student_sessions = StudentSession.objects.filter(
                class_session__in=all_class_sessions,
            ).select_related('student').order_by('student__last_name', 'student__first_name')

            class_name = 'All Classes'

        students = []
        for ss in student_sessions:
            student = ss.student
            students.append({
                'id': student.id,
                'username': student.username,
                'full_name': student.get_full_name(),
                'first_name': student.first_name,
                'last_name': student.last_name
            })

        return Response({
            'students': students,
            'class_name': class_name,
            'academic_year': academic_year,
            'term': term
        })

    except Exception as e:
        print(f"Error fetching students: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error fetching students: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def get_report_grade(score):
    """Return grade based on custom report sheet scale"""
    if score >= 75:
        return 'A1'
    elif score >= 70:
        return 'B2'
    elif score >= 65:
        return 'B3'
    elif score >= 60:
        return 'C4'
    elif score >= 55:
        return 'C5'
    elif score >= 50:
        return 'C6'
    elif score >= 45:
        return 'D7'
    elif score >= 40:
        return 'E8'
    else:
        return 'F9'


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_report_sheet(request, student_id):
    """
    Get complete report sheet data for a specific student.

    Report Structure:
    - 1st Test = Attendance + Assignment scores combined
    - 2nd Test = Test scores
    - Exam = Exam scores
    - Total = Sum of all (out of 100)
    - Grades = Custom grading scale (A1-F9)

    Query Parameters:
    - academic_year: Academic year (required)
    - term: Term (required)

    Returns:
    - Student information (ID, name, class, department, photo)
    - All subjects with scores from GradeSummary
    - Grand total, average, and class position
    """
    from academics.models import Subject
    from django.contrib.auth import get_user_model

    User = get_user_model()

    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Get student
        student = User.objects.get(id=student_id, role='student')

        # Get student's class session for this academic year and term
        # DO NOT filter by is_active - we need to access historical reports!
        student_session = StudentSession.objects.filter(
            student=student,
            class_session__academic_year=academic_year,
            class_session__term=term
        ).select_related('class_session__classroom').first()

        if not student_session:
            return Response(
                {"detail": f"Student not enrolled in {academic_year} - {term}"},
                status=status.HTTP_404_NOT_FOUND
            )

        class_session = student_session.class_session

        # Security check: If the requester is NOT an admin/teacher, verify eligibility
        if request.user.role not in ['admin', 'teacher']:
            # Check if report has been released
            if not student_session.report_sent:
                return Response(
                    {"detail": "Report sheet has not been released yet"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Check if fees are paid
            fee_records = StudentFeeRecord.objects.filter(
                student=student,
                fee_structure__academic_year=academic_year
            )

            if fee_records.exists():
                for fee_record in fee_records:
                    if fee_record.payment_status != 'PAID':
                        return Response(
                            {"detail": "Report sheet access denied. Please complete your fee payment."},
                            status=status.HTTP_403_FORBIDDEN
                        )
            else:
                # No fee records - means fees not set up, deny access
                return Response(
                    {"detail": "Report sheet access denied. Fee records not found."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Get grading configuration
        # DO NOT filter by is_active - we need to access historical grading configs!
        try:
            grading_config = GradingConfiguration.objects.get(
                academic_year=academic_year,
                term=term
            )
        except GradingConfiguration.DoesNotExist:
            return Response(
                {"detail": "No grading configuration found for this session"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all subjects for this student
        subjects = Subject.objects.filter(
            class_session=class_session
        ).select_related('teacher')

        # Filter by department if student has one
        if student_session.student.department:
            subjects = subjects.filter(
                Q(department=student_session.student.department) |
                Q(department='General')
            )

        subjects_data = []

        for subject in subjects:
            # Get GradeSummary for this student and subject
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )

                # Get the grading configuration percentages
                attendance_percent = grading_config.attendance_percentage
                assignment_percent = grading_config.assignment_percentage
                test_percent = grading_config.test_percentage
                exam_percent = grading_config.exam_percentage

                # The scores in GradeSummary are already weighted percentages
                # Scale them to report sheet format:
                # TEST 1 (20 marks) = Attendance + Assignment scaled to 20
                # TEST 2 (20 marks) = Test score scaled to 20
                # EXAM (60 marks) = Exam score scaled to 60

                # Calculate what TEST 1 should be out of (attendance_percent + assignment_percent)
                test1_max = attendance_percent + assignment_percent

                # Scale scores to report sheet format (Test1=20, Test2=20, Exam=60)
                first_test_score = (float(grade_summary.attendance_score) + float(grade_summary.assignment_score)) * (20 / test1_max) if test1_max > 0 else 0
                second_test_score = float(grade_summary.test_score) * (20 / test_percent) if test_percent > 0 else 0
                exam_score = float(grade_summary.exam_score) * (60 / exam_percent) if exam_percent > 0 else 0

                # Calculate total from scaled scores (should equal 100)
                total_score = first_test_score + second_test_score + exam_score

                # Get report sheet grade
                letter_grade = get_report_grade(total_score)

                subjects_data.append({
                    'subject_name': subject.name,
                    'first_test_score': round(first_test_score, 2),  # Attendance + Assignment scaled to 20
                    'second_test_score': round(second_test_score, 2),  # Test scaled to 20
                    'exam_score': round(exam_score, 2),  # Exam scaled to 60
                    'total_score': round(total_score, 2),  # Sum of scaled scores
                    'letter_grade': letter_grade
                })

            except GradeSummary.DoesNotExist:
                # If no grade summary exists, show zeros
                subjects_data.append({
                    'subject_name': subject.name,
                    'first_test_score': 0,
                    'second_test_score': 0,
                    'exam_score': 0,
                    'total_score': 0,
                    'letter_grade': 'F9'
                })

        # Calculate grand total and average
        grand_total = sum(s['total_score'] for s in subjects_data)
        average = round(grand_total / len(subjects_data), 2) if subjects_data else 0

        # Calculate class position
        # Get all students in this class and calculate their averages
        all_students = StudentSession.objects.filter(
            class_session=class_session,
        ).select_related('student')

        student_averages = []
        for ss in all_students:
            student_subjects = Subject.objects.filter(class_session=class_session)
            if ss.student.department:
                student_subjects = student_subjects.filter(
                    Q(department=ss.student.department) |
                    Q(department='General')
                )

            total = 0
            count = 0
            for subj in student_subjects:
                # Get GradeSummary for this student and subject
                try:
                    grade_summary = GradeSummary.objects.get(
                        student=ss.student,
                        subject=subj,
                        grading_config=grading_config
                    )
                    total += float(grade_summary.total_score)
                    count += 1
                except GradeSummary.DoesNotExist:
                    pass

            student_avg = total / count if count > 0 else 0
            student_averages.append({
                'student_id': ss.student.id,
                'average': student_avg
            })

        # Sort by average descending and find position
        student_averages.sort(key=lambda x: x['average'], reverse=True)
        position = next((i + 1 for i, s in enumerate(student_averages) if s['student_id'] == student_id), None)

        # Student photo URL - build absolute URL
        photo_url = None
        if hasattr(student, 'profile_picture') and student.profile_picture:
            photo_url = request.build_absolute_uri(student.profile_picture.url)

        return Response({
            'student': {
                'id': student.id,
                'student_id': student.username,  # Student ID like FHS026
                'name': student.get_full_name(),
                'class': class_session.classroom.name,
                'department': student_session.student.department or '',
                'photo_url': photo_url
            },
            'session': {
                'academic_year': academic_year,
                'term': term
            },
            'grading_config': {
                # Report sheet uses standardized format: 20/20/60
                'first_test_max': 20,  # 1st Test (Attendance + Assignment)
                'second_test_max': 20,  # 2nd Test
                'exam_max': 60,  # Exam
                'total_max': 100
            },
            'subjects': subjects_data,
            'summary': {
                'grand_total': round(grand_total, 2),
                'average': average,
                'position': position,
                'total_students': len(student_averages)
            }
        })

    except User.DoesNotExist:
        return Response(
            {"detail": "Student not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error generating report sheet: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error generating report sheet: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def check_chromium_status(request):
    """
    Diagnostic endpoint to check if Chromium is available for PDF generation
    """
    import os
    import glob
    import subprocess

    result = {
        "chromium_found": False,
        "chromium_path": None,
        "environment_variable": os.environ.get('CHROMIUM_EXECUTABLE_PATH'),
        "searched_paths": []
    }

    # Check all possible locations
    nix_chromiums = glob.glob('/nix/store/*/bin/chromium')
    if nix_chromiums:
        result["searched_paths"].append(f"Nix store chromium: {', '.join(nix_chromiums[:3])}")
        if os.path.exists(nix_chromiums[0]):
            result["chromium_found"] = True
            result["chromium_path"] = nix_chromiums[0]

    # Also check for chromium-unwrapped in nix store
    if not result["chromium_found"]:
        nix_chromiums_unwrapped = glob.glob('/nix/store/*/bin/chromium-unwrapped')
        if nix_chromiums_unwrapped:
            result["searched_paths"].append(f"Nix store chromium-unwrapped: {', '.join(nix_chromiums_unwrapped[:3])}")
            if os.path.exists(nix_chromiums_unwrapped[0]):
                result["chromium_found"] = True
                result["chromium_path"] = nix_chromiums_unwrapped[0]

    possible_paths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-unwrapped',
    ]
    for path in possible_paths:
        result["searched_paths"].append(f"Checked: {path} - {'EXISTS' if os.path.exists(path) else 'NOT FOUND'}")
        if not result["chromium_found"] and os.path.exists(path):
            result["chromium_found"] = True
            result["chromium_path"] = path

    # Try 'which' command for multiple variants
    for cmd in ['chromium', 'chromium-unwrapped', 'chromium-browser']:
        try:
            which_result = subprocess.run(['which', cmd], capture_output=True, text=True, timeout=5)
            result["searched_paths"].append(f"'which {cmd}': {which_result.stdout.strip() if which_result.returncode == 0 else 'NOT FOUND'}")
            if not result["chromium_found"] and which_result.returncode == 0 and which_result.stdout.strip():
                result["chromium_found"] = True
                result["chromium_path"] = which_result.stdout.strip()
        except Exception as e:
            result["searched_paths"].append(f"'which {cmd}': ERROR - {str(e)}")

    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_report_sheet(request, student_id):
    """
    Download report sheet as PDF without preview
    Uses Playwright to convert HTML to PDF with exact web design
    """
    from django.template.loader import render_to_string
    from django.http import HttpResponse
    from django.contrib.auth import get_user_model
    from playwright.sync_api import sync_playwright
    from datetime import datetime
    import tempfile
    import os

    User = get_user_model()

    # Get query parameters
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Reuse get_report_sheet logic to get all the data
    try:
        student = User.objects.get(id=student_id, role='student')
    except User.DoesNotExist:
        return Response(
            {"detail": "Student not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get grading configuration (historical access allowed)
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=academic_year,
            term=term
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": "No grading configuration found for this session"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get student's class session (historical access allowed)
    student_session = StudentSession.objects.filter(
        student=student,
        class_session__academic_year=academic_year,
        class_session__term=term
    ).select_related('class_session', 'class_session__classroom').first()

    if not student_session:
        return Response(
            {"detail": "Student not enrolled in any class for this period"},
            status=status.HTTP_404_NOT_FOUND
        )

    class_session = student_session.class_session

    # Get all subjects for this student
    from academics.models import Subject
    subjects = Subject.objects.filter(
        class_session=class_session
    ).select_related('teacher')

    # Filter by department if student has one
    if student_session.student.department:
        subjects = subjects.filter(
            Q(department=student_session.student.department) |
            Q(department='General')
        )

    subjects_data = []

    for subject in subjects:
        # Get GradeSummary for this student and subject
        try:
            grade_summary = GradeSummary.objects.get(
                student=student,
                subject=subject,
                grading_config=grading_config
            )

            # Get the grading configuration percentages
            attendance_percent = grading_config.attendance_percentage
            assignment_percent = grading_config.assignment_percentage
            test_percent = grading_config.test_percentage
            exam_percent = grading_config.exam_percentage

            # The scores in GradeSummary are already weighted percentages
            # Scale them to report sheet format:
            # TEST 1 (20 marks) = Attendance + Assignment scaled to 20
            # TEST 2 (20 marks) = Test score scaled to 20
            # EXAM (60 marks) = Exam score scaled to 60

            # Calculate what TEST 1 should be out of (attendance_percent + assignment_percent)
            test1_max = attendance_percent + assignment_percent

            # Scale scores to report sheet format (Test1=20, Test2=20, Exam=60)
            first_test_score = (float(grade_summary.attendance_score) + float(grade_summary.assignment_score)) * (20 / test1_max) if test1_max > 0 else 0
            second_test_score = float(grade_summary.test_score) * (20 / test_percent) if test_percent > 0 else 0
            exam_score = float(grade_summary.exam_score) * (60 / exam_percent) if exam_percent > 0 else 0

            # Calculate total from scaled scores (should equal 100)
            total_score = first_test_score + second_test_score + exam_score
            letter_grade = get_report_grade(total_score)

            subjects_data.append({
                'subject_name': subject.name,
                'first_test_score': round(first_test_score, 2),
                'second_test_score': round(second_test_score, 2),
                'exam_score': round(exam_score, 2),
                'total_score': round(total_score, 2),
                'letter_grade': letter_grade
            })

        except GradeSummary.DoesNotExist:
            subjects_data.append({
                'subject_name': subject.name,
                'first_test_score': 0,
                'second_test_score': 0,
                'exam_score': 0,
                'total_score': 0,
                'letter_grade': 'F9'
            })

    # Calculate grand total and average
    grand_total = sum(s['total_score'] for s in subjects_data)
    average = round(grand_total / len(subjects_data), 2) if subjects_data else 0

    # Calculate class position
    all_students = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student')

    student_averages = []
    for ss in all_students:
        student_subjects = Subject.objects.filter(class_session=class_session)
        if ss.student.department:
            student_subjects = student_subjects.filter(
                Q(department=ss.student.department) |
                Q(department='General')
            )

        total = 0
        count = 0
        for subj in student_subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=ss.student,
                    subject=subj,
                    grading_config=grading_config
                )
                total += float(grade_summary.total_score)
                count += 1
            except GradeSummary.DoesNotExist:
                pass

        student_avg = total / count if count > 0 else 0
        student_averages.append({
            'student_id': ss.student.id,
            'average': student_avg
        })

    # Sort by average descending and find position
    student_averages.sort(key=lambda x: x['average'], reverse=True)
    position = next((i + 1 for i, s in enumerate(student_averages) if s['student_id'] == student_id), None)

    # Student photo URL - convert to base64 for PDF embedding
    photo_url = None
    if hasattr(student, 'profile_picture') and student.profile_picture:
        try:
            import base64
            import requests
            from django.conf import settings

            # Fetch image from Cloudinary URL and convert to base64
            photo_url_raw = student.profile_picture.url

            # Download image from Cloudinary
            response = requests.get(photo_url_raw, timeout=10)
            response.raise_for_status()

            # Convert to base64
            encoded_string = base64.b64encode(response.content).decode()

            # Determine the image format from URL or content-type
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            photo_url = f'data:{content_type};base64,{encoded_string}'
        except Exception as e:
            print(f"Error encoding student photo: {e}")
            photo_url = None

    # Logo URL - convert to base64 for PDF embedding
    logo_url = None
    try:
        import base64
        from django.conf import settings
        import os
        # Try to find the logo in the frontend public directory
        logo_path = os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo.png')
        if os.path.exists(logo_path):
            with open(logo_path, 'rb') as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode()
                logo_url = f'data:image/png;base64,{encoded_string}'
    except Exception as e:
        print(f"Error encoding logo: {e}")
        logo_url = None

    # Determine term text
    term_text = "ONE" if term == "First Term" else "TWO" if term == "Second Term" else "THREE"

    # Prepare context for template
    context = {
        'student': {
            'id': student.id,
            'student_id': student.username,
            'name': student.get_full_name(),
            'class': class_session.classroom.name,
            'department': student_session.student.department or '',
            'photo_url': photo_url
        },
        'session': {
            'academic_year': academic_year,
            'term': term
        },
        'term_text': term_text,
        'grading_config': {
            'first_test_max': 20,
            'second_test_max': 20,
            'exam_max': 60,
            'total_max': 100
        },
        'subjects': subjects_data,
        'summary': {
            'grand_total': round(grand_total, 2),
            'average': average,
            'position': position,
            'total_students': len(student_averages)
        },
        'logo_url': logo_url,
        'generated_date': datetime.now().strftime('%m/%d/%Y, %H:%M:%S')
    }

    # Render HTML template
    html_content = render_to_string('report_sheet.html', context)

    # Use Playwright to convert HTML to PDF
    try:
        with sync_playwright() as p:
            import os
            import subprocess
            import glob

            # Try to find chromium executable
            chromium_path = None

            # Method 1: Check environment variable (can be set in Railway)
            chromium_path = os.environ.get('CHROMIUM_EXECUTABLE_PATH')

            # Method 2: Try glob pattern for nix store
            if not chromium_path:
                nix_chromiums = glob.glob('/nix/store/*/bin/chromium')
                if nix_chromiums:
                    chromium_path = nix_chromiums[0]

            # Method 2b: Try chromium-unwrapped in nix store
            if not chromium_path:
                nix_chromiums_unwrapped = glob.glob('/nix/store/*/bin/chromium-unwrapped')
                if nix_chromiums_unwrapped:
                    chromium_path = nix_chromiums_unwrapped[0]

            # Method 3: Check common locations
            if not chromium_path:
                possible_paths = [
                    '/usr/bin/chromium',
                    '/usr/bin/chromium-browser',
                    '/usr/bin/google-chrome',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/chromium-unwrapped',
                ]
                for path in possible_paths:
                    if os.path.exists(path):
                        chromium_path = path
                        break

            # Method 4: Try to find using 'which' command
            if not chromium_path:
                try:
                    result = subprocess.run(['which', 'chromium'], capture_output=True, text=True, timeout=5)
                    if result.returncode == 0 and result.stdout.strip():
                        chromium_path = result.stdout.strip()
                except:
                    pass

            # Launch browser - ALWAYS use a specific executable path or fail gracefully
            if chromium_path and os.path.exists(chromium_path):
                print(f"✓ Using chromium at: {chromium_path}")
                browser = p.chromium.launch(
                    executable_path=chromium_path,
                    args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                )
            else:
                # No chromium found - return error message instead of crashing
                error_msg = f"Chromium browser not found. Searched paths: {', '.join(['/nix/store/*/bin/chromium', '/usr/bin/chromium'])}"
                print(f"✗ {error_msg}")
                return Response(
                    {"detail": "PDF generation unavailable. Chromium browser not installed on server."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

            page = browser.new_page()

            # Set content and wait for it to load
            page.set_content(html_content, wait_until='networkidle')

            # Generate PDF with minimal margins to fit on one page
            pdf_bytes = page.pdf(
                format='A4',
                print_background=True,
                margin={
                    'top': '0.3in',
                    'bottom': '0.3in',
                    'left': '0.3in',
                    'right': '0.3in'
                },
                scale=0.9
            )

            browser.close()

        # Return PDF response
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="report_{student.username}_{academic_year}_{term}.pdf"'
        return response

    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error generating PDF: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# EXAM COMPLETION ANALYTICS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_exam_completion_stats(request):
    """
    Calculate exam completion statistics for all classes in a given academic year and term.

    Returns the percentage of students who have completed exams for all their subjects in each class.
    100% means all students in the class have completed exams for all their subjects.
    """
    academic_year = request.GET.get('academic_year')
    term = request.GET.get('term')

    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term parameters are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        print(f"Fetching exam stats for {academic_year} - {term}")

        # Get all class sessions for the selected academic year and term
        class_sessions = ClassSession.objects.filter(
            academic_year=academic_year,
            term=term
        ).select_related('classroom')

        print(f"Found {class_sessions.count()} class sessions")

        if not class_sessions.exists():
            return Response({
                'stats': [],
                'academic_year': academic_year,
                'term': term,
                'message': f'No class sessions found for {academic_year} - {term}'
            })

        class_stats = []

        for class_session in class_sessions:
            try:
                print(f"Processing class: {class_session.classroom.name}")

                # Get all active students in this class
                student_sessions = StudentSession.objects.filter(
                    class_session=class_session,
                ).select_related('student')

                total_students = student_sessions.count()
                print(f"  Total students: {total_students}")

                if total_students == 0:
                    class_stats.append({
                        'class_id': class_session.classroom.id,
                        'class_name': class_session.classroom.name,
                        'session_id': class_session.id,
                        'total_students': 0,
                        'students_completed': 0,
                        'completion_percentage': 0,
                        'total_subjects': 0,
                    })
                    continue

                # Get all subjects for this class
                subjects = Subject.objects.filter(
                    class_session=class_session
                )

                total_subjects = subjects.count()
                print(f"  Total subjects: {total_subjects}")

                if total_subjects == 0:
                    class_stats.append({
                        'class_id': class_session.classroom.id,
                        'class_name': class_session.classroom.name,
                        'session_id': class_session.id,
                        'total_students': total_students,
                        'students_completed': 0,
                        'completion_percentage': 0,
                        'total_subjects': 0,
                    })
                    continue

                # Count how many subjects have exam assessments or manually entered exams
                subjects_with_exams = 0
                for subject in subjects:
                    # Check if there are exam assessments for this subject
                    has_exam_assessment = Assessment.objects.filter(
                        subject=subject,
                        is_active=True,
                        is_released=True,
                        assessment_type='exam'
                    ).exists()

                    # Check if there are any manually entered exam scores for this subject
                    has_manual_exam = GradeSummary.objects.filter(
                        subject=subject,
                        exam_manual_entry=True
                    ).exists()

                    if has_exam_assessment or has_manual_exam:
                        subjects_with_exams += 1

                print(f"  Subjects with exams: {subjects_with_exams}")

                # If no exams are set up, mark all as 0% completion
                if subjects_with_exams == 0:
                    class_stats.append({
                        'class_id': class_session.classroom.id,
                        'class_name': class_session.classroom.name,
                        'session_id': class_session.id,
                        'total_students': total_students,
                        'students_completed': 0,
                        'completion_percentage': 0,
                        'total_subjects': total_subjects,
                    })
                    continue

                # Count total exam submissions vs total possible submissions
                # Include ALL subjects (even those without exams yet) in the calculation
                total_possible_submissions = total_students * total_subjects
                total_actual_submissions = 0

                for subject in subjects:
                    # Check if there are any exam assessments for this subject
                    exam_assessments = Assessment.objects.filter(
                        subject=subject,
                        is_active=True,
                        is_released=True,
                        assessment_type='exam'
                    )

                    # Check if there are manually entered exams for this subject
                    has_manual_exam_for_subject = GradeSummary.objects.filter(
                        subject=subject,
                        exam_manual_entry=True
                    ).exists()

                    # Count completions for this subject (will be 0 if no exams exist)
                    subject_submissions = 0

                    if exam_assessments.exists() or has_manual_exam_for_subject:
                        # This subject has exams, count how many students completed it
                        for student_session in student_sessions:
                            student = student_session.student

                            # Check if student has submitted exam for this subject
                            has_submission = AssessmentSubmission.objects.filter(
                                student=student,
                                assessment__in=exam_assessments
                            ).exists() if exam_assessments.exists() else False

                            # Check if exam was manually entered in GradeSummary
                            has_manual_entry = False
                            try:
                                grade_summary = GradeSummary.objects.get(
                                    student=student,
                                    subject=subject
                                )
                                has_manual_entry = grade_summary.exam_manual_entry and float(grade_summary.exam_score) > 0
                            except GradeSummary.DoesNotExist:
                                pass

                            # Count if student completed via either submission or manual entry
                            if has_submission or has_manual_entry:
                                subject_submissions += 1

                    total_actual_submissions += subject_submissions

                completion_percentage = round((total_actual_submissions / total_possible_submissions) * 100) if total_possible_submissions > 0 else 0
                print(f"  Completed: {total_actual_submissions}/{total_possible_submissions} submissions ({completion_percentage}%)")

                class_stats.append({
                    'class_id': class_session.classroom.id,
                    'class_name': class_session.classroom.name,
                    'session_id': class_session.id,
                    'total_students': total_students,
                    'students_completed': total_actual_submissions,
                    'completion_percentage': completion_percentage,
                    'total_subjects': total_subjects,
                    'total_possible_submissions': total_possible_submissions,
                })

            except Exception as class_error:
                print(f"  Error processing class {class_session.classroom.name}: {str(class_error)}")
                import traceback
                traceback.print_exc()
                # Continue with next class
                continue

        # Sort by completion percentage (lowest first to highlight classes needing attention)
        class_stats.sort(key=lambda x: x['completion_percentage'])

        print(f"Returning {len(class_stats)} class stats")

        return Response({
            'stats': class_stats,
            'academic_year': academic_year,
            'term': term,
            'message': 'success'
        })

    except Exception as e:
        print(f"Error in get_exam_completion_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error calculating exam statistics: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_subjects_for_exams(request, class_session_id):
    """
    Get all subjects for a class session with exam completion statistics.
    Used when clicking on a class in the Exams Completed tile.

    Returns subjects with:
    - subject_id, subject_name
    - total_students in the class
    - students_completed (students who submitted exams for this subject)
    - completion_percentage
    - has_exams (whether this subject has any exam assessments)
    """
    try:
        class_session = ClassSession.objects.select_related('classroom').get(id=class_session_id)

        # Get all subjects for this class
        subjects = Subject.objects.filter(
            class_session=class_session
        ).select_related('teacher')

        # Get all active students in this class
        student_sessions = StudentSession.objects.filter(
            class_session=class_session,
        ).select_related('student')

        total_students = student_sessions.count()

        subject_stats = []

        for subject in subjects:
            # Check if there are any exam assessments for this subject
            exam_assessments = Assessment.objects.filter(
                subject=subject,
                is_active=True,
                is_released=True,
                assessment_type='exam'
            )

            # Check if there are manually entered exams for this subject
            has_manual_exams = GradeSummary.objects.filter(
                subject=subject,
                exam_manual_entry=True
            ).exists()

            has_exams = exam_assessments.exists() or has_manual_exams

            if not has_exams:
                subject_stats.append({
                    'subject_id': subject.id,
                    'subject_name': subject.name,
                    'total_students': total_students,
                    'students_completed': 0,
                    'completion_percentage': 0,
                    'has_exams': False,
                    'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'N/A'
                })
                continue

            # Count how many students have submitted exams for this subject
            students_completed = 0

            for student_session in student_sessions:
                student = student_session.student

                # Check if this student has submitted exam for this subject
                has_submission = AssessmentSubmission.objects.filter(
                    student=student,
                    assessment__in=exam_assessments
                ).exists() if exam_assessments.exists() else False

                # Check if exam was manually entered
                has_manual_entry = False
                try:
                    grade_summary = GradeSummary.objects.get(
                        student=student,
                        subject=subject
                    )
                    has_manual_entry = grade_summary.exam_manual_entry and float(grade_summary.exam_score) > 0
                except GradeSummary.DoesNotExist:
                    pass

                if has_submission or has_manual_entry:
                    students_completed += 1

            completion_percentage = round((students_completed / total_students) * 100) if total_students > 0 else 0

            subject_stats.append({
                'subject_id': subject.id,
                'subject_name': subject.name,
                'total_students': total_students,
                'students_completed': students_completed,
                'completion_percentage': completion_percentage,
                'has_exams': True,
                'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'N/A'
            })

        # Sort by completion percentage (lowest first)
        subject_stats.sort(key=lambda x: x['completion_percentage'])

        return Response({
            'class_name': class_session.classroom.name,
            'class_session_id': class_session.id,
            'subjects': subject_stats
        })

    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error in get_class_subjects_for_exams: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error retrieving subject data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subject_exam_scores(request, subject_id):
    """
    Get all students for a subject with their exam scores.
    Used when clicking on a subject in the Exams Completed view.

    Returns all students in the class with their exam submission data.
    Handles both Assessment-based exams and manually entered exams from GradeSummary.
    """
    try:
        subject = Subject.objects.select_related('class_session__classroom', 'teacher').get(id=subject_id)

        # Get grading configuration for this session to get exam max marks
        try:
            grading_config = GradingConfiguration.objects.get(
                academic_year=subject.class_session.academic_year,
                term=subject.class_session.term,
                is_active=True
            )
            max_exam_marks = float(grading_config.exam_percentage)
        except GradingConfiguration.DoesNotExist:
            max_exam_marks = 60.0  # Default exam marks

        # Get all students in this class (including historic data)
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session
        ).select_related('student').order_by('student__last_name', 'student__first_name')

        # Get all exam assessments for this subject
        exam_assessments = Assessment.objects.filter(
            subject=subject,
            is_active=True,
            assessment_type='exam'
        ).order_by('created_at')

        # Check if there are manually entered exams (when no Assessment records exist)
        has_manual_exams = GradeSummary.objects.filter(
            subject=subject,
            exam_manual_entry=True
        ).exists()

        student_data = []
        assessments_list = []

        if exam_assessments.exists():
            # Use Assessment-based exams
            assessments_list = [
                {
                    'id': a.id,
                    'title': a.title,
                    'type_display': 'Exam',
                    'total_marks': a.total_marks,
                    'is_released': a.is_released
                } for a in exam_assessments
            ]

            for student_session in student_sessions:
                student = student_session.student
                exam_scores = []

                for assessment in exam_assessments:
                    # Check if student has submitted this exam
                    submission = AssessmentSubmission.objects.filter(
                        student=student,
                        assessment=assessment
                    ).first()

                    exam_scores.append({
                        'assessment_id': assessment.id,
                        'title': assessment.title,
                        'total_marks': assessment.total_marks,
                        'is_released': assessment.is_released,
                        'score': float(submission.score) if submission and submission.score is not None else 0,
                        'is_submitted': submission is not None,
                        'submission_id': submission.id if submission else None
                    })

                student_data.append({
                    'student_id': student.id,
                    'student_name': student.get_full_name(),
                    'username': student.username,
                    'exam_scores': exam_scores
                })

        elif has_manual_exams:
            # Use manually entered exams from GradeSummary
            # Create a virtual "Exam" assessment
            assessments_list = [
                {
                    'id': 0,  # Virtual ID
                    'title': 'Exam',
                    'type_display': 'Exam',
                    'total_marks': max_exam_marks,
                    'is_released': True  # Manually entered scores are considered released
                }
            ]

            for student_session in student_sessions:
                student = student_session.student

                # Get exam score from GradeSummary
                try:
                    grade_summary = GradeSummary.objects.get(
                        student=student,
                        subject=subject
                    )
                    exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                    is_submitted = grade_summary.exam_manual_entry
                except GradeSummary.DoesNotExist:
                    exam_score = 0
                    is_submitted = False

                exam_scores = [{
                    'assessment_id': 0,  # Virtual ID
                    'title': 'Exam',
                    'total_marks': max_exam_marks,
                    'is_released': True,
                    'score': exam_score,
                    'is_submitted': is_submitted,
                    'submission_id': None
                }]

                student_data.append({
                    'student_id': student.id,
                    'student_name': student.get_full_name(),
                    'username': student.username,
                    'exam_scores': exam_scores
                })

        return Response({
            'subject_name': subject.name,
            'subject_id': subject.id,
            'class_name': subject.class_session.classroom.name,
            'academic_year': subject.class_session.academic_year,
            'term': subject.class_session.term,
            'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'N/A',
            'assessments': assessments_list,
            'students': student_data
        })

    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error in get_subject_exam_scores: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error retrieving exam scores: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_exam_score(request):
    """
    Update a student's exam score for a specific assessment OR manual exam score.
    Creates a submission if one doesn't exist (for manual grading).
    SYNCS with GradeSummary.exam_score.

    Body:
    - student_id: ID of the student (required if no submission_id)
    - assessment_id: ID of the assessment (required if no submission_id, can be 0 for manual)
    - submission_id: ID of the AssessmentSubmission (optional - will be used if exists)
    - score: New score value (required)
    - is_manual: Boolean to indicate if this is a manual exam score (optional)
    - subject_id: ID of the subject (required for manual scores when assessment_id is 0)
    """
    try:
        submission_id = request.data.get('submission_id')
        student_id = request.data.get('student_id')
        assessment_id = request.data.get('assessment_id')
        score_value = request.data.get('score')
        is_manual = request.data.get('is_manual', False)
        subject_id = request.data.get('subject_id')

        print(f"=== UPDATE EXAM SCORE ===")
        print(f"Submission ID: {submission_id}")
        print(f"Student ID: {student_id}")
        print(f"Assessment ID: {assessment_id}")
        print(f"Score: {score_value}")
        print(f"Is Manual: {is_manual}")
        print(f"Subject ID: {subject_id}")

        if score_value is None:
            return Response(
                {"detail": "score is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle MANUAL exam score updates (assessment_id=0 or is_manual=true)
        if is_manual or assessment_id == 0 or (not assessment_id and subject_id):
            print(f"=== MANUAL EXAM SCORE UPDATE ===")
            from django.contrib.auth import get_user_model
            from decimal import Decimal
            User = get_user_model()

            if not student_id or not subject_id:
                return Response(
                    {"detail": "student_id and subject_id are required for manual exam scores"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                student = User.objects.get(id=student_id)
                subject = Subject.objects.select_related('class_session').get(id=subject_id)
            except (User.DoesNotExist, Subject.DoesNotExist):
                return Response(
                    {"detail": "Student or Subject not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get grading configuration
            try:
                grading_config = GradingConfiguration.objects.get(
                    academic_year=subject.class_session.academic_year,
                    term=subject.class_session.term,
                    is_active=True
                )
                max_exam_marks = float(grading_config.exam_percentage)
            except GradingConfiguration.DoesNotExist:
                max_exam_marks = 60.0
                grading_config = None
                print(f"WARNING: No grading config found, using default max_exam_marks=60")

            # Validate score
            if float(score_value) > max_exam_marks:
                return Response(
                    {"detail": f"Score cannot exceed {max_exam_marks}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not grading_config:
                return Response(
                    {"detail": "Grading configuration not found for this term"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update or create GradeSummary directly
            grade_summary, created = GradeSummary.objects.get_or_create(
                student=student,
                subject=subject,
                grading_config=grading_config,
                defaults={'exam_score': Decimal(str(round(float(score_value), 2)))}
            )

            if not created:
                grade_summary.exam_score = Decimal(str(round(float(score_value), 2)))

            grade_summary.exam_manual_entry = True  # Mark as manually entered
            grade_summary.recalculate_total_score()
            grade_summary.save()
            print(f"✓ GradeSummary updated: exam_score={grade_summary.exam_score}, exam_manual_entry=True")

            print(f"======================")

            return Response({
                'message': 'Manual exam score updated successfully',
                'submission_id': None,
                'new_score': float(score_value),
                'student_name': student.get_full_name(),
                'is_manual': True
            })

        # Handle ONLINE exam score updates (AssessmentSubmission)
        if submission_id:
            try:
                submission = AssessmentSubmission.objects.select_related('assessment__subject__class_session', 'student').get(id=submission_id)
            except AssessmentSubmission.DoesNotExist:
                return Response(
                    {"detail": "Submission not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        elif student_id and assessment_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()

            try:
                student = User.objects.get(id=student_id)
                assessment = Assessment.objects.select_related('subject__class_session').get(id=assessment_id)
            except (User.DoesNotExist, Assessment.DoesNotExist):
                return Response(
                    {"detail": "Student or Assessment not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get or create submission for manual grading
            submission, created = AssessmentSubmission.objects.get_or_create(
                student=student,
                assessment=assessment,
                defaults={
                    'time_taken': 0,
                    'max_score': assessment.total_marks,
                    'score': 0,
                    'is_graded': True
                }
            )

            if created:
                print(f"Created new submission for manual exam grading")
        else:
            return Response(
                {"detail": "Either submission_id OR (student_id AND assessment_id) OR (student_id AND subject_id for manual) are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get grading configuration
        try:
            grading_config = GradingConfiguration.objects.get(
                academic_year=submission.assessment.subject.class_session.academic_year,
                term=submission.assessment.subject.class_session.term,
                is_active=True
            )
            max_exam_marks = float(grading_config.exam_percentage)
        except GradingConfiguration.DoesNotExist:
            max_exam_marks = 60.0
            print(f"WARNING: No grading config found, using default max_exam_marks=60")

        # Validate score
        if float(score_value) > submission.assessment.total_marks:
            return Response(
                {"detail": f"Score cannot exceed {submission.assessment.total_marks}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        print(f"Student: {submission.student.get_full_name()}")
        print(f"Assessment: {submission.assessment.title}")
        print(f"Old score: {submission.score}")
        print(f"New score: {score_value}")

        # Update submission
        submission.score = float(score_value)
        submission.is_graded = True
        submission.save()

        print(f"✓ Submission updated")

        # SYNC TO GRADE SUMMARY
        try:
            from decimal import Decimal

            subject = submission.assessment.subject
            student = submission.student

            # For exam, we just use the score directly (not averaged like tests)
            # Convert to percentage of exam_percentage
            exam_percentage = (float(score_value) / float(submission.assessment.total_marks)) * max_exam_marks

            print(f"Exam percentage calculation: ({score_value} / {submission.assessment.total_marks}) * {max_exam_marks} = {exam_percentage}")

            # Update or create GradeSummary
            grade_summary, created = GradeSummary.objects.get_or_create(
                student=student,
                subject=subject,
                grading_config=grading_config,
                defaults={'exam_score': Decimal(str(round(exam_percentage, 2)))}
            )

            if not created:
                grade_summary.exam_score = Decimal(str(round(exam_percentage, 2)))
                grade_summary.recalculate_total_score()
                grade_summary.save()
                print(f"✓ GradeSummary updated: exam_score={grade_summary.exam_score}")
            else:
                print(f"✓ GradeSummary created: exam_score={grade_summary.exam_score}")

        except Exception as sync_error:
            print(f"WARNING: Failed to sync with GradeSummary: {str(sync_error)}")
            import traceback
            traceback.print_exc()

        print(f"======================")

        return Response({
            'message': 'Exam score updated successfully and synced with grade summary',
            'submission_id': submission.id,
            'new_score': float(score_value),
            'student_name': submission.student.get_full_name()
        })

    except Exception as e:
        print(f"Error updating exam score: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error updating exam score: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_report_access_stats(request):
    """
    Get report sheet access statistics based on fee payment and grade completion.
    
    Returns statistics for 4 categories:
    1. Complete: Fees paid + Grades complete
    2. Fees paid, Grades incomplete
    3. Fees unpaid, Grades complete
    4. Fees unpaid, Grades incomplete
    """
    from academics.models import StudentSession
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    
    # Get current or selected academic year and term
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')
    
    # Get grading configuration to determine which session to check
    if academic_year and term:
        try:
            # Allow historical grading configs
            grading_config = GradingConfiguration.objects.get(
                academic_year=academic_year,
                term=term
            )
        except GradingConfiguration.DoesNotExist:
            # Debug: Show what configs actually exist
            all_configs = GradingConfiguration.objects.all().values_list('academic_year', 'term', 'is_active')
            print(f"DEBUG: Looking for config {academic_year} - {term}")
            print(f"DEBUG: Available configs: {list(all_configs)}")
            return Response(
                {
                    "detail": f"No grading configuration found for {academic_year} - {term}",
                    "searched_for": {"academic_year": academic_year, "term": term},
                    "available_configs": [{"academic_year": c[0], "term": c[1], "is_active": c[2]} for c in all_configs]
                },
                status=status.HTTP_404_NOT_FOUND
            )
    else:
        # Get current active grading configuration
        grading_config = GradingConfiguration.objects.filter(is_active=True).first()
        if not grading_config:
            return Response(
                {"detail": "No active grading configuration found"},
                status=status.HTTP_404_NOT_FOUND
            )
        academic_year = grading_config.academic_year
        term = grading_config.term

    # Get all student sessions for this academic year and term (include inactive for historical data)
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term
    ).select_related('student', 'class_session__classroom')
    
    # Initialize counters
    complete_fees_complete_grades = 0
    complete_fees_incomplete_grades = 0
    incomplete_fees_complete_grades = 0
    incomplete_fees_incomplete_grades = 0
    
    total_students = student_sessions.count()
    
    for student_session in student_sessions:
        student = student_session.student

        # Check fee payment status
        # Get all fee records for this student in the current academic year
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_complete = False
        if fee_records.exists():
            # Check if all fees are paid
            # Fees are complete if ALL fee records have payment_status == 'PAID'
            all_paid = True
            for fee_record in fee_records:
                if fee_record.payment_status != 'PAID':
                    all_paid = False
                    break
            fees_complete = all_paid
        else:
            # If no fee records exist, consider fees as INCOMPLETE
            # (fees haven't been set up/assigned for this student yet)
            fees_complete = False

        # Check grade completion status
        # Get all subjects for this student's class
        from academics.models import Subject
        from django.db.models import Q

        subjects = Subject.objects.filter(
            class_session=student_session.class_session
        )

        # Filter by department if student has one
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = False
        if subjects.exists():
            # Check if ALL subjects have COMPLETE grades
            # Complete means: Test 1 (attendance + assignment), Test 2 (test), Exam, and Total are all filled
            all_graded = True
            for subject in subjects:
                try:
                    grade_summary = GradeSummary.objects.get(
                        student=student,
                        subject=subject,
                        grading_config=grading_config
                    )

                    # Get all score components
                    attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                    assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                    test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                    exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                    total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

                    # Test 1 = attendance + assignment (must be > 0)
                    test1_complete = (attendance_score + assignment_score) > 0

                    # Test 2 = test score (must be > 0)
                    test2_complete = test_score > 0

                    # Exam (must be > 0)
                    exam_complete = exam_score > 0

                    # Total (must be > 0)
                    total_complete = total_score > 0

                    # Grades are complete only if ALL components are filled
                    if not (test1_complete and test2_complete and exam_complete and total_complete):
                        all_graded = False
                        break

                except GradeSummary.DoesNotExist:
                    # No grade summary = grades incomplete
                    all_graded = False
                    break

            grades_complete = all_graded
        else:
            # If no subjects, consider grades as incomplete (students must have subjects)
            grades_complete = False
        
        # Categorize the student
        # Section 1: Only count students who haven't received their report yet
        if fees_complete and grades_complete:
            # Only count if report hasn't been sent yet
            if not student_session.report_sent:
                complete_fees_complete_grades += 1
        elif fees_complete and not grades_complete:
            complete_fees_incomplete_grades += 1
        elif not fees_complete and grades_complete:
            incomplete_fees_complete_grades += 1
        else:  # not fees_complete and not grades_complete
            incomplete_fees_incomplete_grades += 1
    
    # Calculate percentages
    complete_percentage = round((complete_fees_complete_grades / total_students) * 100, 1) if total_students > 0 else 0
    fees_paid_grades_incomplete_percentage = round((complete_fees_incomplete_grades / total_students) * 100, 1) if total_students > 0 else 0
    fees_unpaid_grades_complete_percentage = round((incomplete_fees_complete_grades / total_students) * 100, 1) if total_students > 0 else 0
    fees_unpaid_grades_incomplete_percentage = round((incomplete_fees_incomplete_grades / total_students) * 100, 1) if total_students > 0 else 0
    
    return Response({
        'academic_year': academic_year,
        'term': term,
        'total_students': total_students,
        'statistics': {
            'complete': {
                'count': complete_fees_complete_grades,
                'percentage': complete_percentage,
                'label': 'Complete (Fees Paid & Grades Complete)'
            },
            'fees_paid_grades_incomplete': {
                'count': complete_fees_incomplete_grades,
                'percentage': fees_paid_grades_incomplete_percentage,
                'label': 'Fees Paid, Grades Incomplete'
            },
            'fees_unpaid_grades_complete': {
                'count': incomplete_fees_complete_grades,
                'percentage': fees_unpaid_grades_complete_percentage,
                'label': 'Fees Unpaid, Grades Complete'
            },
            'fees_unpaid_grades_incomplete': {
                'count': incomplete_fees_incomplete_grades,
                'percentage': fees_unpaid_grades_incomplete_percentage,
                'label': 'Fees Unpaid, Grades Incomplete'
            }
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_report_sheets(request):
    """
    Send report sheets to students and parents who have complete fees and grades.
    Only sends to students who haven't received their reports yet.
    Creates notifications for both student and parent.

    This is a one-time send - once sent, reports won't be sent again to the same students.
    """
    from academics.models import StudentSession
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from logs.models import Notification
    from django.db.models import Q
    from django.utils import timezone

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send report sheets"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current or selected academic year and term
    academic_year = request.data.get('academic_year')
    term = request.data.get('term')

    # Get grading configuration (allow historical access)
    if academic_year and term:
        try:
            grading_config = GradingConfiguration.objects.get(
                academic_year=academic_year,
                term=term
            )
        except GradingConfiguration.DoesNotExist:
            return Response(
                {"detail": f"No grading configuration found for {academic_year} - {term}"},
                status=status.HTTP_404_NOT_FOUND
            )
    else:
        # Get current active grading configuration
        grading_config = GradingConfiguration.objects.filter(is_active=True).first()
        if not grading_config:
            return Response(
                {"detail": "No active grading configuration found"},
                status=status.HTTP_404_NOT_FOUND
            )
        academic_year = grading_config.academic_year
        term = grading_config.term

    # Get all student sessions for this academic year and term (include inactive for historical data)
    # Filter to only get students who haven't received their reports yet
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        report_sent=False  # Only get students who haven't received reports
    ).select_related('student', 'class_session__classroom')

    from academics.models import Subject

    # Track eligible students (complete fees + grades, not yet sent)
    eligible_sessions = []

    for student_session in student_sessions:
        student = student_session.student

        # Check fee payment status
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_complete = False
        if fee_records.exists():
            all_paid = all(fee_record.payment_status == 'PAID' for fee_record in fee_records)
            fees_complete = all_paid

        if not fees_complete:
            continue  # Skip if fees not complete

        # Check grade completion status
        subjects = Subject.objects.filter(
            class_session=student_session.class_session
        )

        # Filter by department if student has one
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = True
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )

                # Get all score components
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

                # Check all components are filled
                test1_complete = (attendance_score + assignment_score) > 0
                test2_complete = test_score > 0
                exam_complete = exam_score > 0
                total_complete = total_score > 0

                if not (test1_complete and test2_complete and exam_complete and total_complete):
                    grades_complete = False
                    break

            except GradeSummary.DoesNotExist:
                grades_complete = False
                break

        # Only include if both fees and grades are complete
        if fees_complete and grades_complete:
            eligible_sessions.append(student_session)

    if not eligible_sessions:
        return Response(
            {"detail": "No eligible students found. All complete students have already received their reports."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Mark all eligible sessions as sent and create notifications
    sent_count = 0
    student_notifications_created = 0
    parent_notifications_created = 0

    for student_session in eligible_sessions:
        # Mark report as sent
        student_session.report_sent = True
        student_session.report_sent_date = timezone.now()
        student_session.report_sent_by = request.user
        student_session.save()

        # Create notification for student
        Notification.objects.create(
            recipient=student_session.student,
            title="Report Sheet Available",
            message=f"Your report sheet for {term}, {academic_year} is now available. Visit the Report Sheet section to view and download it.",
            notification_type="report_release",
            priority="high"
        )
        student_notifications_created += 1

        # Create notification for parent(s)
        parents = student_session.student.parents.all()
        for parent in parents:
            Notification.objects.create(
                recipient=parent,
                title="Report Sheet Available",
                message=f"{student_session.student.get_full_name()}'s report sheet for {term}, {academic_year} is now available. Visit the Grade Report section to view and download it.",
                notification_type="report_release",
                priority="high"
            )
            parent_notifications_created += 1

        sent_count += 1

    return Response({
        "message": f"Report sheets sent successfully to {sent_count} student(s)",
        "details": {
            "students_sent": sent_count,
            "student_notifications": student_notifications_created,
            "parent_notifications": parent_notifications_created,
            "academic_year": academic_year,
            "term": term
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_eligible_classes_for_reports(request):
    """
    Get classes that have students with complete fees and grades who haven't received reports yet.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get all student sessions for this term that haven't received reports
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True,
        report_sent=False
    ).select_related('student', 'class_session__classroom')

    # Group by class and count eligible students
    class_data = {}

    for student_session in student_sessions:
        student = student_session.student
        class_session = student_session.class_session

        # Check fee completion
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_complete = False
        if fee_records.exists():
            fees_complete = all(fr.payment_status == 'PAID' for fr in fee_records)

        if not fees_complete:
            continue

        # Check grade completion
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = True
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0 and total_score > 0):
                    grades_complete = False
                    break
            except GradeSummary.DoesNotExist:
                grades_complete = False
                break

        if grades_complete:
            class_id = class_session.id
            if class_id not in class_data:
                class_data[class_id] = {
                    'id': class_id,
                    'name': class_session.classroom.name,
                    'academic_year': academic_year,
                    'term': term,
                    'eligible_count': 0
                }
            class_data[class_id]['eligible_count'] += 1

    # Sort by class name
    classes_list = sorted(class_data.values(), key=lambda x: x['name'])

    return Response({
        'classes': classes_list,
        'academic_year': academic_year,
        'term': term
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_eligible_students_in_class(request, class_session_id):
    """
    Get students in a specific class who have complete fees and grades but haven't received reports yet.
    """
    from academics.models import StudentSession, Subject, ClassSession
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Get the class session
    try:
        class_session = ClassSession.objects.get(id=class_session_id)
    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get grading configuration
    grading_config = GradingConfiguration.objects.filter(
        academic_year=class_session.academic_year,
        term=class_session.term,
        is_active=True
    ).first()

    if not grading_config:
        return Response(
            {"detail": "No grading configuration found for this session"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get all student sessions for this class that haven't received reports
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
        report_sent=False
    ).select_related('student')

    eligible_students = []

    for student_session in student_sessions:
        student = student_session.student

        # Check fee completion
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=class_session.academic_year
        )

        fees_complete = False
        if fee_records.exists():
            fees_complete = all(fr.payment_status == 'PAID' for fr in fee_records)

        if not fees_complete:
            continue

        # Check grade completion
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = True
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0 and total_score > 0):
                    grades_complete = False
                    break
            except GradeSummary.DoesNotExist:
                grades_complete = False
                break

        if grades_complete:
            eligible_students.append({
                'id': student.id,
                'student_session_id': student_session.id,
                'username': student.username,
                'full_name': student.get_full_name(),
                'department': student.department or 'General'
            })

    # Sort by name
    eligible_students.sort(key=lambda x: x['full_name'])

    return Response({
        'class_name': class_session.classroom.name,
        'academic_year': class_session.academic_year,
        'term': class_session.term,
        'students': eligible_students
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_incomplete_grades_classes(request):
    """
    Get classes that have students with fees paid but incomplete grades.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get all student sessions for this term
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True
    ).select_related('student', 'class_session__classroom')

    # Group by class and count students with incomplete grades
    class_data = {}

    for student_session in student_sessions:
        student = student_session.student
        class_session = student_session.class_session

        # Check fee completion
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_complete = False
        if fee_records.exists():
            fees_complete = all(fr.payment_status == 'PAID' for fr in fee_records)

        if not fees_complete:
            continue  # Only include students with fees paid

        # Check grade completion
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = True
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0 and total_score > 0):
                    grades_complete = False
                    break
            except GradeSummary.DoesNotExist:
                grades_complete = False
                break

        # Only count students with fees paid but incomplete grades
        if not grades_complete:
            class_id = class_session.id
            if class_id not in class_data:
                class_data[class_id] = {
                    'id': class_id,
                    'name': class_session.classroom.name,
                    'academic_year': academic_year,
                    'term': term,
                    'affected_count': 0
                }
            class_data[class_id]['affected_count'] += 1

    # Sort by class name
    classes_list = sorted(class_data.values(), key=lambda x: x['name'])

    return Response({
        'classes': classes_list,
        'academic_year': academic_year,
        'term': term
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_incomplete_grades_students(request, class_session_id):
    """
    Get students in a specific class who have fees paid but incomplete grades.
    Returns the list of incomplete subjects for each student.
    """
    from academics.models import StudentSession, Subject, ClassSession
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Get the class session
    try:
        class_session = ClassSession.objects.get(id=class_session_id)
    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get grading configuration
    grading_config = GradingConfiguration.objects.filter(
        academic_year=class_session.academic_year,
        term=class_session.term,
        is_active=True
    ).first()

    if not grading_config:
        return Response(
            {"detail": "No grading configuration found for this session"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get all student sessions for this class
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student')

    affected_students = []

    for student_session in student_sessions:
        student = student_session.student

        # Check fee completion
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=class_session.academic_year
        )

        fees_complete = False
        if fee_records.exists():
            fees_complete = all(fr.payment_status == 'PAID' for fr in fee_records)

        if not fees_complete:
            continue  # Only include students with fees paid

        # Check grade completion and collect incomplete subjects
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        incomplete_subjects = []
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

                # Determine which components are missing
                missing_components = []
                if not ((attendance_score + assignment_score) > 0):
                    missing_components.append('Test 1')
                if not (test_score > 0):
                    missing_components.append('Test 2')
                if not (exam_score > 0):
                    missing_components.append('Exam')
                if not (total_score > 0):
                    missing_components.append('Total')

                if missing_components:
                    incomplete_subjects.append({
                        'name': subject.name,
                        'missing': missing_components
                    })
            except GradeSummary.DoesNotExist:
                incomplete_subjects.append({
                    'name': subject.name,
                    'missing': ['All scores']
                })

        # Only include students with incomplete grades
        if incomplete_subjects:
            affected_students.append({
                'id': student.id,
                'student_session_id': student_session.id,
                'username': student.username,
                'full_name': student.get_full_name(),
                'department': student.department or 'General',
                'incomplete_subjects': incomplete_subjects
            })

    # Sort by name
    affected_students.sort(key=lambda x: x['full_name'])

    return Response({
        'class_name': class_session.classroom.name,
        'academic_year': class_session.academic_year,
        'term': class_session.term,
        'students': affected_students
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_incomplete_grades_students(request):
    """
    Search for students with fees paid but incomplete grades across all classes.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    query = request.query_params.get('q', '').strip()
    if not query:
        return Response({'students': []})

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Search for students matching the query
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True
    ).filter(
        Q(student__username__icontains=query) |
        Q(student__first_name__icontains=query) |
        Q(student__last_name__icontains=query)
    ).select_related('student', 'class_session__classroom')[:20]

    matching_students = []

    for student_session in student_sessions:
        student = student_session.student
        class_session = student_session.class_session

        # Check fee completion
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_complete = False
        if fee_records.exists():
            fees_complete = all(fr.payment_status == 'PAID' for fr in fee_records)

        if not fees_complete:
            continue  # Only include students with fees paid

        # Check grade completion and collect incomplete subjects
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        incomplete_subjects = []
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

                # Determine which components are missing
                missing_components = []
                if not ((attendance_score + assignment_score) > 0):
                    missing_components.append('Test 1')
                if not (test_score > 0):
                    missing_components.append('Test 2')
                if not (exam_score > 0):
                    missing_components.append('Exam')
                if not (total_score > 0):
                    missing_components.append('Total')

                if missing_components:
                    incomplete_subjects.append({
                        'name': subject.name,
                        'missing': missing_components
                    })
            except GradeSummary.DoesNotExist:
                incomplete_subjects.append({
                    'name': subject.name,
                    'missing': ['All scores']
                })

        # Only include students with incomplete grades
        if incomplete_subjects:
            matching_students.append({
                'id': student.id,
                'student_session_id': student_session.id,
                'username': student.username,
                'full_name': student.get_full_name(),
                'department': student.department or 'General',
                'class_name': class_session.classroom.name,
                'incomplete_subjects': incomplete_subjects
            })

    return Response({
        'students': matching_students,
        'academic_year': academic_year,
        'term': term
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_incomplete_grade_notification(request):
    """
    Send notification to a single student about their incomplete grades.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from logs.models import Notification
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send notifications"},
            status=status.HTTP_403_FORBIDDEN
        )

    student_id = request.data.get('student_id')
    if not student_id:
        return Response(
            {"detail": "student_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        student = CustomUser.objects.get(id=student_id, role='student')
    except CustomUser.DoesNotExist:
        return Response(
            {"detail": "Student not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get student's current session
    student_session = StudentSession.objects.filter(
        student=student,
        class_session__academic_year=grading_config.academic_year,
        class_session__term=grading_config.term,
        is_active=True
    ).select_related('class_session').first()

    if not student_session:
        return Response(
            {"detail": "Student session not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get incomplete subjects
    subjects = Subject.objects.filter(class_session=student_session.class_session)
    if student.department:
        subjects = subjects.filter(
            Q(department=student.department) | Q(department='General')
        )

    incomplete_subjects = []
    for subject in subjects:
        try:
            grade_summary = GradeSummary.objects.get(
                student=student,
                subject=subject,
                grading_config=grading_config
            )
            attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
            assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
            test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
            exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
            total_score = float(grade_summary.total_score) if grade_summary.total_score else 0

            missing_components = []
            if not ((attendance_score + assignment_score) > 0):
                missing_components.append('Test 1')
            if not (test_score > 0):
                missing_components.append('Test 2')
            if not (exam_score > 0):
                missing_components.append('Exam')

            if missing_components:
                incomplete_subjects.append({
                    'name': subject.name,
                    'missing': missing_components
                })
        except GradeSummary.DoesNotExist:
            incomplete_subjects.append({
                'name': subject.name,
                'missing': ['All assessments']
            })

    if not incomplete_subjects:
        return Response(
            {"detail": "Student has no incomplete grades"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Build notification message
    subject_list = []
    for subj in incomplete_subjects:
        missing_str = ', '.join(subj['missing'])
        subject_list.append(f"- {subj['name']}: {missing_str}")

    message = f"You have incomplete grades for the following subjects that need to be completed:\n\n"
    message += '\n'.join(subject_list)
    message += f"\n\nPlease ensure you complete these assessments as soon as possible for {grading_config.term}, {grading_config.academic_year}."

    # Create notification for student
    Notification.objects.create(
        recipient=student,
        title="Incomplete Grades Reminder",
        message=message,
        notification_type="incomplete_grades",
        priority="high",
        extra_data={
            'incomplete_subjects': incomplete_subjects,
            'academic_year': grading_config.academic_year,
            'term': grading_config.term
        }
    )

    # Create notifications for parents
    parent_message = f"Your child {student.get_full_name()} has incomplete grades for the following subjects:\n\n"
    parent_message += '\n'.join(subject_list)
    parent_message += f"\n\nPlease encourage them to complete these assessments for {grading_config.term}, {grading_config.academic_year}."

    parents = student.parents.all()
    for parent in parents:
        Notification.objects.create(
            recipient=parent,
            title=f"Incomplete Grades - {student.get_full_name()}",
            message=parent_message,
            notification_type="incomplete_grades",
            priority="high",
            extra_data={
                'student_name': student.get_full_name(),
                'student_id': student.id,
                'incomplete_subjects': incomplete_subjects,
                'academic_year': grading_config.academic_year,
                'term': grading_config.term
            }
        )

    return Response({
        "message": f"Notification sent successfully to {student.get_full_name()} and parent(s)",
        "student_name": student.get_full_name(),
        "incomplete_count": len(incomplete_subjects),
        "parents_notified": parents.count()
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_bulk_incomplete_grade_notifications(request):
    """
    Send notifications to all students with fees paid but incomplete grades.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from logs.models import Notification
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send notifications"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get all student sessions for this term
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True
    ).select_related('student', 'class_session__classroom')

    notifications_sent = 0

    for student_session in student_sessions:
        student = student_session.student
        class_session = student_session.class_session

        # Check fee completion
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_complete = False
        if fee_records.exists():
            fees_complete = all(fr.payment_status == 'PAID' for fr in fee_records)

        if not fees_complete:
            continue  # Only notify students with fees paid

        # Check grade completion and collect incomplete subjects
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        incomplete_subjects = []
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                missing_components = []
                if not ((attendance_score + assignment_score) > 0):
                    missing_components.append('Test 1')
                if not (test_score > 0):
                    missing_components.append('Test 2')
                if not (exam_score > 0):
                    missing_components.append('Exam')

                if missing_components:
                    incomplete_subjects.append({
                        'name': subject.name,
                        'missing': missing_components
                    })
            except GradeSummary.DoesNotExist:
                incomplete_subjects.append({
                    'name': subject.name,
                    'missing': ['All assessments']
                })

        # Only notify students with incomplete grades
        if incomplete_subjects:
            # Build notification message
            subject_list = []
            for subj in incomplete_subjects:
                missing_str = ', '.join(subj['missing'])
                subject_list.append(f"- {subj['name']}: {missing_str}")

            message = f"You have incomplete grades for the following subjects that need to be completed:\n\n"
            message += '\n'.join(subject_list)
            message += f"\n\nPlease ensure you complete these assessments as soon as possible for {term}, {academic_year}."

            # Create notification for student
            Notification.objects.create(
                recipient=student,
                title="Incomplete Grades Reminder",
                message=message,
                notification_type="incomplete_grades",
                priority="high",
                extra_data={
                    'incomplete_subjects': incomplete_subjects,
                    'academic_year': academic_year,
                    'term': term
                }
            )

            # Create notifications for parents
            parent_message = f"Your child {student.get_full_name()} has incomplete grades for the following subjects:\n\n"
            parent_message += '\n'.join(subject_list)
            parent_message += f"\n\nPlease encourage them to complete these assessments for {term}, {academic_year}."

            parents = student.parents.all()
            for parent in parents:
                Notification.objects.create(
                    recipient=parent,
                    title=f"Incomplete Grades - {student.get_full_name()}",
                    message=parent_message,
                    notification_type="incomplete_grades",
                    priority="high",
                    extra_data={
                        'student_name': student.get_full_name(),
                        'student_id': student.id,
                        'incomplete_subjects': incomplete_subjects,
                        'academic_year': academic_year,
                        'term': term
                    }
                )

            notifications_sent += 1

    if notifications_sent == 0:
        return Response(
            {"message": "No students found with fees paid and incomplete grades"},
            status=status.HTTP_200_OK
        )

    return Response({
        "message": f"Notifications sent successfully to {notifications_sent} student(s)",
        "notifications_sent": notifications_sent,
        "academic_year": academic_year,
        "term": term
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_unpaid_fees_classes(request):
    """
    Get list of classes with students who have unpaid fees but complete grades.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q, Sum

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get all class sessions for this term
    from academics.models import ClassSession
    class_sessions = ClassSession.objects.filter(
        academic_year=academic_year,
        term=term
    ).select_related('classroom')

    classes_data = []

    for class_session in class_sessions:
        # Get students in this class
        student_sessions = StudentSession.objects.filter(
            class_session=class_session,
        ).select_related('student')

        affected_students = 0

        for student_session in student_sessions:
            student = student_session.student

            # Check fee completion - must have unpaid fees
            fee_records = StudentFeeRecord.objects.filter(
                student=student,
                fee_structure__academic_year=academic_year
            )

            fees_incomplete = False
            if fee_records.exists():
                fees_incomplete = any(fr.payment_status != 'PAID' for fr in fee_records)
            else:
                fees_incomplete = True  # No fee records means unpaid

            if not fees_incomplete:
                continue  # Skip students with complete fees

            # Check grade completion - must have complete grades
            subjects = Subject.objects.filter(class_session=class_session)
            if student.department:
                subjects = subjects.filter(
                    Q(department=student.department) | Q(department='General')
                )

            grades_complete = True
            for subject in subjects:
                try:
                    grade_summary = GradeSummary.objects.get(
                        student=student,
                        subject=subject,
                        grading_config=grading_config
                    )
                    attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                    assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                    test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                    exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                    # Check if all components are filled
                    if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                        grades_complete = False
                        break
                except GradeSummary.DoesNotExist:
                    grades_complete = False
                    break

            if grades_complete:
                affected_students += 1

        if affected_students > 0:
            classes_data.append({
                'class_session_id': class_session.id,
                'class_name': class_session.classroom.name,
                'affected_count': affected_students
            })

    return Response({
        'classes': classes_data,
        'total_affected': sum(c['affected_count'] for c in classes_data),
        'academic_year': academic_year,
        'term': term
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_unpaid_fees_students(request, class_session_id):
    """
    Get students in a class who have unpaid fees but complete grades with their balance.
    """
    from academics.models import StudentSession, Subject, ClassSession
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q, Sum

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        class_session = ClassSession.objects.get(id=class_session_id)
    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get students in this class
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student')

    students_data = []

    for student_session in student_sessions:
        student = student_session.student

        # Check fee completion and calculate balance
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_incomplete = False
        total_balance = 0

        if fee_records.exists():
            for fr in fee_records:
                if fr.payment_status != 'PAID':
                    fees_incomplete = True
                    total_balance += float(fr.fee_structure.amount - fr.amount_paid)
        else:
            fees_incomplete = True  # No fee records means unpaid

        if not fees_incomplete:
            continue  # Skip students with complete fees

        # Check grade completion
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = True
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                    grades_complete = False
                    break
            except GradeSummary.DoesNotExist:
                grades_complete = False
                break

        if grades_complete:
            students_data.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'username': student.username,
                'balance': total_balance
            })

    return Response({
        'students': students_data,
        'class_name': class_session.classroom.name,
        'class_session_id': class_session_id
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_unpaid_fees_students(request):
    """
    Search for students with unpaid fees but complete grades across all classes.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    search_query = request.query_params.get('q', '').strip()
    if len(search_query) < 2:
        return Response({'students': []}, status=status.HTTP_200_OK)

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Search for students by name
    from django.contrib.auth import get_user_model
    User = get_user_model()

    matching_students = User.objects.filter(
        role='student'
    ).filter(
        Q(first_name__icontains=search_query) |
        Q(last_name__icontains=search_query) |
        Q(username__icontains=search_query)
    )[:50]

    students_data = []

    for student in matching_students:
        # Get student's current class session
        student_session = StudentSession.objects.filter(
            student=student,
            class_session__academic_year=academic_year,
            class_session__term=term,
            is_active=True
        ).select_related('class_session__classroom').first()

        if not student_session:
            continue

        class_session = student_session.class_session

        # Check fee completion and calculate balance
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_incomplete = False
        total_balance = 0

        if fee_records.exists():
            for fr in fee_records:
                if fr.payment_status != 'PAID':
                    fees_incomplete = True
                    total_balance += float(fr.fee_structure.amount - fr.amount_paid)
        else:
            fees_incomplete = True

        if not fees_incomplete:
            continue

        # Check grade completion
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = True
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                    grades_complete = False
                    break
            except GradeSummary.DoesNotExist:
                grades_complete = False
                break

        if grades_complete:
            students_data.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'username': student.username,
                'class_name': class_session.classroom.name,
                'balance': total_balance
            })

    return Response({
        'students': students_data,
        'search_query': search_query
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_unpaid_fee_notification(request):
    """
    Send notification to a specific student about unpaid fees.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from logs.models import Notification
    from django.contrib.auth import get_user_model
    from django.db.models import Q

    User = get_user_model()

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send notifications"},
            status=status.HTTP_403_FORBIDDEN
        )

    student_id = request.data.get('student_id')
    if not student_id:
        return Response(
            {"detail": "student_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        student = User.objects.get(id=student_id, role='student')
    except User.DoesNotExist:
        return Response(
            {"detail": "Student not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Calculate balance
    fee_records = StudentFeeRecord.objects.filter(
        student=student,
        fee_structure__academic_year=academic_year
    )

    total_balance = 0
    fee_details = []

    for fr in fee_records:
        if fr.payment_status != 'PAID':
            total_balance += float(fr.fee_structure.amount - fr.amount_paid)
            fee_details.append({
                'fee_type': fr.fee_structure.name if hasattr(fr.fee_structure, 'name') else 'School Fee',
                'balance': float(fr.fee_structure.amount - fr.amount_paid)
            })

    if total_balance == 0:
        return Response(
            {"detail": "Student has no outstanding balance"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Build notification message for student
    message = f"You have an outstanding balance of ₦{total_balance:,.2f} that needs to be paid.\n\n"
    message += "Please ensure your fees are fully paid to avoid any disruption to your academic activities.\n\n"
    message += f"Academic Year: {academic_year}\nTerm: {term}\n\n"
    message += "Kindly visit the school's bursary department or make payment through the approved channels."

    # Create notification for student
    Notification.objects.create(
        recipient=student,
        title="Fee Payment Reminder",
        message=message,
        notification_type="fee_reminder",
        priority="high",
        extra_data={
            'balance': total_balance,
            'fee_details': fee_details,
            'academic_year': academic_year,
            'term': term
        }
    )

    # Create notifications for parents
    parent_message = f"Your child {student.get_full_name()} has an outstanding fee balance of ₦{total_balance:,.2f}.\n\n"
    parent_message += "Please ensure the fees are fully paid to avoid any disruption to their academic activities.\n\n"
    parent_message += f"Academic Year: {academic_year}\nTerm: {term}\n\n"
    parent_message += "Kindly visit the school's bursary department or make payment through the approved channels."

    parents = student.parents.all()
    for parent in parents:
        Notification.objects.create(
            recipient=parent,
            title=f"Fee Payment Reminder - {student.get_full_name()}",
            message=parent_message,
            notification_type="fee_reminder",
            priority="high",
            extra_data={
                'student_name': student.get_full_name(),
                'student_id': student.id,
                'balance': total_balance,
                'fee_details': fee_details,
                'academic_year': academic_year,
                'term': term
            }
        )

    return Response({
        "message": f"Notification sent successfully to {student.get_full_name()} and parent(s)",
        "student_name": student.get_full_name(),
        "balance": total_balance,
        "parents_notified": parents.count()
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_bulk_unpaid_fee_notifications(request):
    """
    Send notifications to all students with unpaid fees but complete grades.
    """
    from academics.models import StudentSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from logs.models import Notification
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send notifications"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get all student sessions for this term
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True
    ).select_related('student', 'class_session__classroom')

    notifications_sent = 0

    for student_session in student_sessions:
        student = student_session.student
        class_session = student_session.class_session

        # Check fee completion and calculate balance
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_incomplete = False
        total_balance = 0
        fee_details = []

        if fee_records.exists():
            for fr in fee_records:
                if fr.payment_status != 'PAID':
                    fees_incomplete = True
                    total_balance += float(fr.fee_structure.amount - fr.amount_paid)
                    fee_details.append({
                        'fee_type': fr.fee_structure.name if hasattr(fr.fee_structure, 'name') else 'School Fee',
                        'balance': float(fr.fee_structure.amount - fr.amount_paid)
                    })
        else:
            fees_incomplete = True

        if not fees_incomplete:
            continue  # Skip students with complete fees

        # Check grade completion
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        grades_complete = True
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                    grades_complete = False
                    break
            except GradeSummary.DoesNotExist:
                grades_complete = False
                break

        # Only notify students with unpaid fees AND complete grades
        if grades_complete and total_balance > 0:
            # Build notification message for student
            message = f"You have an outstanding balance of ₦{total_balance:,.2f} that needs to be paid.\n\n"
            message += "Please ensure your fees are fully paid to avoid any disruption to your academic activities.\n\n"
            message += f"Academic Year: {academic_year}\nTerm: {term}\n\n"
            message += "Kindly visit the school's bursary department or make payment through the approved channels."

            # Create notification for student
            Notification.objects.create(
                recipient=student,
                title="Fee Payment Reminder",
                message=message,
                notification_type="fee_reminder",
                priority="high",
                extra_data={
                    'balance': total_balance,
                    'fee_details': fee_details,
                    'academic_year': academic_year,
                    'term': term
                }
            )

            # Create notifications for parents
            parent_message = f"Your child {student.get_full_name()} has an outstanding fee balance of ₦{total_balance:,.2f}.\n\n"
            parent_message += "Please ensure the fees are fully paid to avoid any disruption to their academic activities.\n\n"
            parent_message += f"Academic Year: {academic_year}\nTerm: {term}\n\n"
            parent_message += "Kindly visit the school's bursary department or make payment through the approved channels."

            parents = student.parents.all()
            for parent in parents:
                Notification.objects.create(
                    recipient=parent,
                    title=f"Fee Payment Reminder - {student.get_full_name()}",
                    message=parent_message,
                    notification_type="fee_reminder",
                    priority="high",
                    extra_data={
                        'student_name': student.get_full_name(),
                        'student_id': student.id,
                        'balance': total_balance,
                        'fee_details': fee_details,
                        'academic_year': academic_year,
                        'term': term
                    }
                )

            notifications_sent += 1

    if notifications_sent == 0:
        return Response(
            {"message": "No students found with unpaid fees and complete grades"},
            status=status.HTTP_200_OK
        )

    return Response({
        "message": f"Notifications sent successfully to {notifications_sent} student(s)",
        "notifications_sent": notifications_sent,
        "academic_year": academic_year,
        "term": term
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_individual_report(request):
    """
    Send report sheet to a single student and their parent(s).
    """
    from academics.models import StudentSession
    from logs.models import Notification
    from django.utils import timezone

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send report sheets"},
            status=status.HTTP_403_FORBIDDEN
        )

    student_session_id = request.data.get('student_session_id')
    if not student_session_id:
        return Response(
            {"detail": "student_session_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        student_session = StudentSession.objects.select_related(
            'student', 'class_session'
        ).get(id=student_session_id)
    except StudentSession.DoesNotExist:
        return Response(
            {"detail": "Student session not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    if student_session.report_sent:
        return Response(
            {"detail": "Report has already been sent for this student"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Mark report as sent
    student_session.report_sent = True
    student_session.report_sent_date = timezone.now()
    student_session.report_sent_by = request.user
    student_session.save()

    academic_year = student_session.class_session.academic_year
    term = student_session.class_session.term

    # Create notification for student
    Notification.objects.create(
        recipient=student_session.student,
        title="Report Sheet Available",
        message=f"Your report sheet for {term}, {academic_year} is now available. Visit the Report Sheet section to view and download it.",
        notification_type="report_release",
        priority="high"
    )

    # Create notification for parent(s)
    parent_count = 0
    parents = student_session.student.parents.all()
    for parent in parents:
        Notification.objects.create(
            recipient=parent,
            title="Report Sheet Available",
            message=f"{student_session.student.get_full_name()}'s report sheet for {term}, {academic_year} is now available. Visit the Grade Report section to view and download it.",
            notification_type="report_release",
            priority="high"
        )
        parent_count += 1

    return Response({
        "message": f"Report sheet sent to {student_session.student.get_full_name()}",
        "details": {
            "student_name": student_session.student.get_full_name(),
            "parent_notifications": parent_count
        }
    }, status=status.HTTP_200_OK)


# ============================================================================
# UNPAID FEES + INCOMPLETE GRADES ANALYTICS VIEWS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_both_issues_classes(request):
    """
    Get all classes with students who have BOTH unpaid fees AND incomplete grades.
    """
    from academics.models import StudentSession, ClassSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get all class sessions for current academic year and term
    class_sessions = ClassSession.objects.filter(
        academic_year=academic_year,
        term=term
    ).select_related('classroom')

    classes_data = []

    for class_session in class_sessions:
        # Get students in this class
        student_sessions = StudentSession.objects.filter(
            class_session=class_session,
        ).select_related('student')

        students_with_both_issues = 0

        for student_session in student_sessions:
            student = student_session.student

            # Check fee completion
            fee_records = StudentFeeRecord.objects.filter(
                student=student,
                fee_structure__academic_year=academic_year
            )

            fees_incomplete = False
            if fee_records.exists():
                for fr in fee_records:
                    if fr.payment_status != 'PAID':
                        fees_incomplete = True
                        break
            else:
                fees_incomplete = True

            if not fees_incomplete:
                continue  # Skip if fees are complete

            # Check grade completion
            subjects = Subject.objects.filter(class_session=class_session)
            if student.department:
                subjects = subjects.filter(
                    Q(department=student.department) | Q(department='General')
                )

            grades_incomplete = False
            for subject in subjects:
                try:
                    grade_summary = GradeSummary.objects.get(
                        student=student,
                        subject=subject,
                        grading_config=grading_config
                    )
                    attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                    assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                    test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                    exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                    if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                        grades_incomplete = True
                        break
                except GradeSummary.DoesNotExist:
                    grades_incomplete = True
                    break

            if grades_incomplete:
                students_with_both_issues += 1

        if students_with_both_issues > 0:
            classes_data.append({
                'class_session_id': class_session.id,
                'class_name': class_session.classroom.name,
                'students_count': students_with_both_issues
            })

    # Sort by number of students (highest first)
    classes_data.sort(key=lambda x: x['students_count'], reverse=True)

    return Response({
        'classes': classes_data,
        'academic_year': academic_year,
        'term': term
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_both_issues_students(request, class_session_id):
    """
    Get students in a class who have BOTH unpaid fees AND incomplete grades.
    Returns what they owe and count of incomplete subjects.
    """
    from academics.models import StudentSession, Subject, ClassSession
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        class_session = ClassSession.objects.get(id=class_session_id)
    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year

    # Get students in this class
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student')

    students_data = []

    for student_session in student_sessions:
        student = student_session.student

        # Check fee completion and calculate balance
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_incomplete = False
        total_balance = 0

        if fee_records.exists():
            for fr in fee_records:
                if fr.payment_status != 'PAID':
                    fees_incomplete = True
                    total_balance += float(fr.fee_structure.amount - fr.amount_paid)
        else:
            fees_incomplete = True

        if not fees_incomplete:
            continue  # Skip students with complete fees

        # Check grade completion and count incomplete subjects
        subjects = Subject.objects.filter(class_session=class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        incomplete_subjects = []
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                missing = []
                if not (attendance_score + assignment_score) > 0:
                    missing.append('Test 1')
                if not test_score > 0:
                    missing.append('Test 2')
                if not exam_score > 0:
                    missing.append('Exam')

                if missing:
                    incomplete_subjects.append({
                        'name': subject.name,
                        'missing': missing
                    })
            except GradeSummary.DoesNotExist:
                incomplete_subjects.append({
                    'name': subject.name,
                    'missing': ['Test 1', 'Test 2', 'Exam']
                })

        if len(incomplete_subjects) > 0:
            students_data.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'username': student.username,
                'balance': total_balance,
                'incomplete_subjects_count': len(incomplete_subjects),
                'incomplete_subjects': incomplete_subjects
            })

    # Sort by balance (highest first)
    students_data.sort(key=lambda x: x['balance'], reverse=True)

    return Response({
        'students': students_data,
        'class_name': class_session.classroom.name
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_both_issues_notification(request):
    """
    Send notification to a student about their unpaid fees AND incomplete grades.
    """
    from logs.models import Notification
    from django.contrib.auth import get_user_model
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from academics.models import StudentSession, Subject
    from django.db.models import Q

    User = get_user_model()

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send notifications"},
            status=status.HTTP_403_FORBIDDEN
        )

    student_id = request.data.get('student_id')
    if not student_id:
        return Response(
            {"detail": "student_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        student = User.objects.get(id=student_id, role='student')
    except User.DoesNotExist:
        return Response(
            {"detail": "Student not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Calculate balance
    fee_records = StudentFeeRecord.objects.filter(
        student=student,
        fee_structure__academic_year=academic_year
    )

    total_balance = 0
    for fr in fee_records:
        if fr.payment_status != 'PAID':
            total_balance += float(fr.fee_structure.amount - fr.amount_paid)

    # Get incomplete subjects count
    student_session = StudentSession.objects.filter(
        student=student,
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True
    ).first()

    incomplete_count = 0
    if student_session:
        subjects = Subject.objects.filter(class_session=student_session.class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                    incomplete_count += 1
            except GradeSummary.DoesNotExist:
                incomplete_count += 1

    # Create notification for student
    Notification.objects.create(
        recipient=student,
        title="Unpaid Fees & Incomplete Grades Notice",
        message=f"Important: You have an outstanding balance of ₦{total_balance:,.2f} and {incomplete_count} subject(s) with incomplete grades for {term}, {academic_year}. Please settle your fees and ensure all assessments are completed to access your report sheet.",
        notification_type="fee_reminder",
        priority="high"
    )

    # Notify parents as well
    for parent in student.parents.all():
        Notification.objects.create(
            recipient=parent,
            title="Child's Unpaid Fees & Incomplete Grades",
            message=f"Important: {student.get_full_name()} has an outstanding balance of ₦{total_balance:,.2f} and {incomplete_count} subject(s) with incomplete grades for {term}, {academic_year}. Please ensure fees are settled and all assessments are completed for report sheet access.",
            notification_type="fee_reminder",
            priority="high"
        )

    return Response({
        "message": f"Notification sent to {student.get_full_name()} and their parent(s)",
        "student_name": student.get_full_name()
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_bulk_both_issues_notifications(request):
    """
    Send notifications to ALL students with BOTH unpaid fees AND incomplete grades.
    """
    from logs.models import Notification
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from academics.models import StudentSession, Subject
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send notifications"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get all active student sessions
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True
    ).select_related('student', 'class_session')

    notifications_sent = 0

    for student_session in student_sessions:
        student = student_session.student

        # Check fee completion
        fee_records = StudentFeeRecord.objects.filter(
            student=student,
            fee_structure__academic_year=academic_year
        )

        fees_incomplete = False
        total_balance = 0

        if fee_records.exists():
            for fr in fee_records:
                if fr.payment_status != 'PAID':
                    fees_incomplete = True
                    total_balance += float(fr.fee_structure.amount - fr.amount_paid)
        else:
            fees_incomplete = True

        if not fees_incomplete:
            continue

        # Check grade completion
        subjects = Subject.objects.filter(class_session=student_session.class_session)
        if student.department:
            subjects = subjects.filter(
                Q(department=student.department) | Q(department='General')
            )

        incomplete_count = 0
        for subject in subjects:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                    incomplete_count += 1
            except GradeSummary.DoesNotExist:
                incomplete_count += 1

        if incomplete_count == 0:
            continue

        # Send notification to student
        Notification.objects.create(
            recipient=student,
            title="Unpaid Fees & Incomplete Grades Notice",
            message=f"Important: You have an outstanding balance of ₦{total_balance:,.2f} and {incomplete_count} subject(s) with incomplete grades for {term}, {academic_year}. Please settle your fees and ensure all assessments are completed to access your report sheet.",
            notification_type="fee_reminder",
            priority="high"
        )

        # Notify parents
        for parent in student.parents.all():
            Notification.objects.create(
                recipient=parent,
                title="Child's Unpaid Fees & Incomplete Grades",
                message=f"Important: {student.get_full_name()} has an outstanding balance of ₦{total_balance:,.2f} and {incomplete_count} subject(s) with incomplete grades for {term}, {academic_year}. Please ensure fees are settled and all assessments are completed for report sheet access.",
                notification_type="fee_reminder",
                priority="high"
            )

        notifications_sent += 1

    return Response({
        "message": f"Notifications sent to {notifications_sent} student(s) and their parents",
        "notifications_sent": notifications_sent,
        "academic_year": academic_year,
        "term": term
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_reports_sent_stats(request):
    """
    Get statistics about reports sent by class for the current academic year and term.
    """
    from academics.models import StudentSession, ClassSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get academic year and term from query params or use active config
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    if not academic_year or not term:
        # Get current grading configuration
        grading_config = GradingConfiguration.objects.filter(is_active=True).first()
        if not grading_config:
            return Response(
                {"detail": "No active grading configuration found"},
                status=status.HTTP_404_NOT_FOUND
            )

        academic_year = grading_config.academic_year
        term = grading_config.term

    # Get all class sessions for current academic year and term
    class_sessions = ClassSession.objects.filter(
        academic_year=academic_year,
        term=term
    ).select_related('classroom').order_by('classroom__name')

    classes_data = []
    total_sent = 0
    total_not_sent = 0

    for class_session in class_sessions:
        # Get students in this class
        student_sessions = StudentSession.objects.filter(
            class_session=class_session,
        )

        sent_count = student_sessions.filter(report_sent=True).count()
        total_count = student_sessions.count()
        not_sent_count = total_count - sent_count

        if total_count > 0:
            percentage = round((sent_count / total_count) * 100)
        else:
            percentage = 0

        classes_data.append({
            'class_session_id': class_session.id,
            'class_name': class_session.classroom.name,
            'sent': sent_count,
            'not_sent': not_sent_count,
            'total': total_count,
            'percentage': percentage
        })

        total_sent += sent_count
        total_not_sent += not_sent_count

    total_students = total_sent + total_not_sent
    overall_percentage = round((total_sent / total_students) * 100) if total_students > 0 else 0

    return Response({
        "academic_year": academic_year,
        "term": term,
        "total_sent": total_sent,
        "total_not_sent": total_not_sent,
        "overall_percentage": overall_percentage,
        "classes": classes_data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_report_sent_students(request, class_session_id):
    """
    Get the report sent status for all students in a specific class.
    """
    from academics.models import StudentSession, ClassSession, Subject
    from schooladmin.models import StudentFeeRecord, GradeSummary, GradingConfiguration
    from django.db.models import Q

    # Verify user is admin
    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get class session
    try:
        class_session = ClassSession.objects.get(id=class_session_id)
    except ClassSession.DoesNotExist:
        return Response(
            {"detail": "Class session not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get current grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = grading_config.academic_year
    term = grading_config.term

    # Get students in this class
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
    ).select_related('student').order_by('student__last_name', 'student__first_name')

    students_data = []

    for student_session in student_sessions:
        student = student_session.student

        # Check if report was sent
        if student_session.report_sent:
            status_value = 'sent'
            sent_date = student_session.report_sent_date
        else:
            # Determine the reason why not sent
            # Check fee completion
            fee_records = StudentFeeRecord.objects.filter(
                student=student,
                fee_structure__academic_year=academic_year
            )

            fees_incomplete = False
            if fee_records.exists():
                for fr in fee_records:
                    if fr.payment_status != 'PAID':
                        fees_incomplete = True
                        break
            else:
                fees_incomplete = True

            # Check grade completion
            subjects = Subject.objects.filter(class_session=class_session)
            if student.department:
                subjects = subjects.filter(
                    Q(department=student.department) | Q(department='General')
                )

            grades_incomplete = False
            for subject in subjects:
                try:
                    grade_summary = GradeSummary.objects.get(
                        student=student,
                        subject=subject,
                        grading_config=grading_config
                    )
                    attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                    assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                    test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                    exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                    if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                        grades_incomplete = True
                        break
                except GradeSummary.DoesNotExist:
                    grades_incomplete = True
                    break

            # Determine status
            if fees_incomplete and grades_incomplete:
                status_value = 'both_issues'
            elif fees_incomplete:
                status_value = 'incomplete_fees'
            elif grades_incomplete:
                status_value = 'incomplete_grades'
            else:
                status_value = 'not_sent'

            sent_date = None

        students_data.append({
            'student_id': student.id,
            'student_name': student.get_full_name(),
            'username': student.username,
            'status': status_value,
            'sent_date': sent_date
        })

    return Response({
        "class_name": class_session.classroom.name,
        "academic_year": academic_year,
        "term": term,
        "students": students_data
    }, status=status.HTTP_200_OK)


# ============================================================================
# SUBJECT GRADING COMPLETION ANALYTICS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subject_grading_stats(request):
    """
    Get subjects ordered by grading completion percentage.
    Returns top subjects with most complete grades and bottom with least.
    """
    from academics.models import Subject, ClassSession
    from schooladmin.models import GradeSummary, GradingConfiguration
    from django.db.models import Count, Q

    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    academic_year = request.GET.get('academic_year')
    term = request.GET.get('term')

    # If parameters not provided, default to active session
    if not academic_year or not term:
        grading_config = GradingConfiguration.objects.filter(is_active=True).first()
        if not grading_config:
            return Response(
                {"detail": "No active grading configuration found"},
                status=status.HTTP_404_NOT_FOUND
            )
        academic_year = grading_config.academic_year
        term = grading_config.term
    else:
        # Parameters provided - allow historical access
        grading_config = GradingConfiguration.objects.filter(
            academic_year=academic_year,
            term=term
        ).first()

        if not grading_config:
            # Debug info
            all_configs = GradingConfiguration.objects.all().values_list('academic_year', 'term', 'is_active')
            return Response(
                {
                    "detail": f"No grading configuration found for {academic_year} - {term}",
                    "searched_for": {"academic_year": academic_year, "term": term},
                    "available_configs": [{"academic_year": c[0], "term": c[1], "is_active": c[2]} for c in all_configs]
                },
                status=status.HTTP_404_NOT_FOUND
            )

    # Get all class sessions for this academic year and term
    class_sessions = ClassSession.objects.filter(
        academic_year=academic_year,
        term=term
    )

    # Get all subjects for these class sessions
    subjects = Subject.objects.filter(
        class_session__in=class_sessions
    ).select_related('class_session', 'teacher')

    subject_stats = []

    for subject in subjects:
        # Get students in this class session (include inactive for historical data)
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session
        )

        # Filter by department if subject has a department
        if subject.department and subject.department != 'General':
            student_sessions = student_sessions.filter(
                student__department=subject.department
            )

        total_students = student_sessions.count()

        if total_students == 0:
            continue

        # Check grade completion for each student
        complete_count = 0
        incomplete_count = 0

        for student_session in student_sessions:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student_session.student,
                    subject=subject,
                    grading_config=grading_config
                )

                # Check if all required scores are entered
                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                # A grade is complete if it has (attendance OR assignment) AND test AND exam scores
                if (attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0:
                    complete_count += 1
                else:
                    incomplete_count += 1
            except GradeSummary.DoesNotExist:
                incomplete_count += 1

        completion_percentage = round((complete_count / total_students) * 100, 1) if total_students > 0 else 0

        subject_stats.append({
            'subject_id': subject.id,
            'subject_name': subject.name,
            'class_name': subject.class_session.classroom.name,
            'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'Not Assigned',
            'teacher_id': subject.teacher.id if subject.teacher else None,
            'total_students': total_students,
            'complete_count': complete_count,
            'incomplete_count': incomplete_count,
            'completion_percentage': completion_percentage
        })

    # Sort by completion percentage (descending)
    subject_stats.sort(key=lambda x: x['completion_percentage'], reverse=True)

    return Response({
        'academic_year': academic_year,
        'term': term,
        'total_subjects': len(subject_stats),
        'subjects': subject_stats
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subject_incomplete_students(request, subject_id):
    """
    Get students with incomplete grades for a specific subject.
    Shows what scores are missing for each student.
    """
    from academics.models import Subject
    from schooladmin.models import GradeSummary, GradingConfiguration

    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can view this data"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        subject = Subject.objects.select_related('class_session', 'teacher').get(id=subject_id)
    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    academic_year = subject.class_session.academic_year
    term = subject.class_session.term

    # Get grading configuration (allow historical access)
    grading_config = GradingConfiguration.objects.filter(
        academic_year=academic_year,
        term=term
    ).first()

    if not grading_config:
        return Response(
            {"detail": f"No grading configuration found for {academic_year} - {term}"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get students in this class (include inactive for historical data)
    student_sessions = StudentSession.objects.filter(
        class_session=subject.class_session
    ).select_related('student')

    # Filter by department if subject has a department
    if subject.department and subject.department != 'General':
        student_sessions = student_sessions.filter(
            student__department=subject.department
        )

    incomplete_students = []

    for student_session in student_sessions:
        student = student_session.student
        missing_scores = []

        try:
            grade_summary = GradeSummary.objects.get(
                student=student,
                subject=subject,
                grading_config=grading_config
            )

            attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
            assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
            test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
            exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

            # Check what's missing
            if (attendance_score + assignment_score) == 0:
                missing_scores.append('Attendance/Assignment')
            if test_score == 0:
                missing_scores.append('Test')
            if exam_score == 0:
                missing_scores.append('Exam')

            # Only add if something is missing
            if missing_scores:
                incomplete_students.append({
                    'student_id': student.id,
                    'student_name': student.get_full_name(),
                    'username': student.username,
                    'missing_scores': missing_scores,
                    'current_scores': {
                        'attendance': attendance_score,
                        'assignment': assignment_score,
                        'test': test_score,
                        'exam': exam_score
                    }
                })
        except GradeSummary.DoesNotExist:
            incomplete_students.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'username': student.username,
                'missing_scores': ['Attendance/Assignment', 'Test', 'Exam'],
                'current_scores': {
                    'attendance': 0,
                    'assignment': 0,
                    'test': 0,
                    'exam': 0
                }
            })

    # Sort by student name
    incomplete_students.sort(key=lambda x: x['student_name'])

    return Response({
        'subject_id': subject.id,
        'subject_name': subject.name,
        'class_name': subject.class_session.classroom.name,
        'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'Not Assigned',
        'teacher_id': subject.teacher.id if subject.teacher else None,
        'academic_year': academic_year,
        'term': term,
        'total_incomplete': len(incomplete_students),
        'students': incomplete_students
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notify_teachers_incomplete_grades(request):
    """
    Send notifications to teachers about incomplete grades for their subjects.
    """
    from academics.models import Subject, ClassSession
    from schooladmin.models import GradeSummary, GradingConfiguration
    from logs.models import Notification

    if request.user.role != 'admin':
        return Response(
            {"detail": "Only admins can send notifications"},
            status=status.HTTP_403_FORBIDDEN
        )

    academic_year = request.data.get('academic_year')
    term = request.data.get('term')

    if not academic_year or not term:
        return Response(
            {"detail": "academic_year and term are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get grading configuration
    grading_config = GradingConfiguration.objects.filter(
        academic_year=academic_year,
        term=term,
        is_active=True
    ).first()

    if not grading_config:
        return Response(
            {"detail": "No active grading configuration found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get all class sessions for this period
    class_sessions = ClassSession.objects.filter(
        academic_year=academic_year,
        term=term
    )

    # Get all subjects with teachers
    subjects = Subject.objects.filter(
        class_session__in=class_sessions,
        teacher__isnull=False
    ).select_related('class_session', 'teacher')

    # Group subjects by teacher
    teacher_subjects = {}

    for subject in subjects:
        # Check if this subject has incomplete grades
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session,
            is_active=True
        )

        if subject.department and subject.department != 'General':
            student_sessions = student_sessions.filter(
                student__department=subject.department
            )

        incomplete_count = 0
        total_students = student_sessions.count()

        for student_session in student_sessions:
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student_session.student,
                    subject=subject,
                    grading_config=grading_config
                )

                attendance_score = float(grade_summary.attendance_score) if grade_summary.attendance_score else 0
                assignment_score = float(grade_summary.assignment_score) if grade_summary.assignment_score else 0
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

                if not ((attendance_score + assignment_score) > 0 and test_score > 0 and exam_score > 0):
                    incomplete_count += 1
            except GradeSummary.DoesNotExist:
                incomplete_count += 1

        # Only add if there are incomplete grades
        if incomplete_count > 0:
            teacher_id = subject.teacher.id
            if teacher_id not in teacher_subjects:
                teacher_subjects[teacher_id] = {
                    'teacher': subject.teacher,
                    'subjects': []
                }

            teacher_subjects[teacher_id]['subjects'].append({
                'name': subject.name,
                'class_name': subject.class_session.classroom.name,
                'incomplete_count': incomplete_count,
                'total_students': total_students
            })

    # Send notifications to teachers
    notifications_sent = 0

    for teacher_id, data in teacher_subjects.items():
        teacher = data['teacher']
        subjects_list = data['subjects']

        # Build message
        subject_lines = []
        for subj in subjects_list:
            subject_lines.append(
                f"• {subj['name']} ({subj['class_name']}): {subj['incomplete_count']}/{subj['total_students']} students incomplete"
            )

        message = f"You have incomplete grades for the following subjects that need to be entered:\n\n"
        message += '\n'.join(subject_lines)
        message += f"\n\nPlease ensure all grades are entered for {term}, {academic_year} as soon as possible."

        # Create notification
        Notification.objects.create(
            recipient=teacher,
            title="Incomplete Grades - Action Required",
            message=message,
            notification_type="teacher_grading_reminder",
            priority="high",
            extra_data={
                'subjects': subjects_list,
                'academic_year': academic_year,
                'term': term
            }
        )
        notifications_sent += 1

    return Response({
        'message': f'Notifications sent to {notifications_sent} teacher(s)',
        'notifications_sent': notifications_sent,
        'teachers_notified': list(teacher_subjects.keys())
    }, status=status.HTTP_200_OK)


# ============================================================================
# STUDENT DASHBOARD - ATTENDANCE RANKING
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_attendance_ranking(request):
    """
    Get attendance ranking for all students in the current user's class.
    Returns students ordered by average attendance score (highest first).
    """
    user = request.user

    if user.role != 'student':
        return Response(
            {"detail": "This endpoint is only for students"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get student's current session
    try:
        student_session = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).select_related('class_session').first()

        if not student_session:
            return Response(
                {"detail": "No active session found for student"},
                status=status.HTTP_404_NOT_FOUND
            )

        class_session = student_session.class_session

        # Get all students in the same class session
        class_students = StudentSession.objects.filter(
            class_session=class_session,
        ).select_related('student')

        # Get attendance scores from GradeSummary for each student
        # We'll average across all subjects for each student
        student_rankings = []

        for student_session_obj in class_students:
            student = student_session_obj.student

            # Get all grade summaries for this student in current session
            grade_summaries = GradeSummary.objects.filter(
                student=student,
                subject__class_session=class_session
            )

            if grade_summaries.exists():
                # Calculate average attendance score across all subjects
                total_attendance = sum(float(gs.attendance_score) for gs in grade_summaries)
                avg_attendance = total_attendance / grade_summaries.count()
            else:
                avg_attendance = 0.0

            # Get avatar URL (user-uploaded profile picture for social use)
            avatar_url = None
            if hasattr(student, 'avatar') and student.avatar:
                avatar_url = request.build_absolute_uri(student.avatar.url)

            student_rankings.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'username': student.username,
                'avatar_url': avatar_url,
                'attendance_score': round(avg_attendance, 2),
                'is_current_user': student.id == user.id
            })

        # Sort by attendance score (highest first)
        student_rankings.sort(key=lambda x: x['attendance_score'], reverse=True)

        # Add rank numbers
        for idx, student in enumerate(student_rankings, 1):
            student['rank'] = idx

        return Response({
            'class_name': class_session.classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
            'total_students': len(student_rankings),
            'rankings': student_rankings
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"detail": f"Error fetching rankings: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subject_grade_rankings(request):
    """
    Get subjects for the student's class and top students by total grade score.
    For department-based classes, only shows subjects matching the student's department.
    """
    user = request.user

    if user.role != 'student':
        return Response(
            {"detail": "This endpoint is only for students"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get student's current session
        student_session = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).select_related('class_session').first()

        if not student_session:
            return Response(
                {"detail": "No active session found for student"},
                status=status.HTTP_404_NOT_FOUND
            )

        class_session = student_session.class_session

        # Get subjects for this class session
        subjects = Subject.objects.filter(class_session=class_session)

        # Filter by department if student has one (for senior classes)
        if user.department:
            # Include subjects that match department OR have no department restriction OR General
            subjects = subjects.filter(
                Q(department=user.department) |
                Q(department__isnull=True) |
                Q(department='') |
                Q(department='General')
            )

        subjects = subjects.order_by('name')

        subjects_data = []
        for subject in subjects:
            subjects_data.append({
                'id': subject.id,
                'name': subject.name,
                'teacher': subject.teacher.get_full_name() if subject.teacher else 'Not Assigned'
            })

        return Response({
            'class_name': class_session.classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
            'department': user.department or None,
            'subjects': subjects_data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"detail": f"Error fetching subjects: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subject_top_students(request, subject_id):
    """
    Get top students by total grade score for a specific subject.
    """
    user = request.user

    if user.role != 'student':
        return Response(
            {"detail": "This endpoint is only for students"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get student's current session
        student_session = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).select_related('class_session').first()

        if not student_session:
            return Response(
                {"detail": "No active session found for student"},
                status=status.HTTP_404_NOT_FOUND
            )

        class_session = student_session.class_session

        # Verify subject belongs to student's class
        try:
            subject = Subject.objects.get(id=subject_id, class_session=class_session)
        except Subject.DoesNotExist:
            return Response(
                {"detail": "Subject not found in your class"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all grade summaries for this subject
        grade_summaries = GradeSummary.objects.filter(
            subject=subject
        ).select_related('student').order_by('-total_score')

        student_rankings = []
        for idx, gs in enumerate(grade_summaries, 1):
            # Get avatar URL
            avatar_url = None
            if hasattr(gs.student, 'avatar') and gs.student.avatar:
                avatar_url = request.build_absolute_uri(gs.student.avatar.url)

            student_rankings.append({
                'rank': idx,
                'student_id': gs.student.id,
                'student_name': gs.student.get_full_name(),
                'username': gs.student.username,
                'avatar_url': avatar_url,
                'total_score': float(gs.total_score),
                'is_current_user': gs.student.id == user.id
            })

        return Response({
            'subject_id': subject.id,
            'subject_name': subject.name,
            'teacher': subject.teacher.get_full_name() if subject.teacher else 'Not Assigned',
            'total_students': len(student_rankings),
            'rankings': student_rankings
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"detail": f"Error fetching rankings: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_subject_grades(request):
    """
    Get the current student's grades for all subjects, sorted by total score.
    Returns both highest and lowest grades.
    """
    user = request.user

    if user.role != 'student':
        return Response(
            {"detail": "This endpoint is only for students"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get student's current session
        student_session = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).select_related('class_session').first()

        if not student_session:
            return Response(
                {"detail": "No active session found for student"},
                status=status.HTTP_404_NOT_FOUND
            )

        class_session = student_session.class_session

        # Get all grade summaries for this student in current session
        grade_summaries = GradeSummary.objects.filter(
            student=user,
            subject__class_session=class_session
        ).select_related('subject').order_by('-total_score')

        grades_data = []
        for gs in grade_summaries:
            grades_data.append({
                'subject_id': gs.subject.id,
                'subject_name': gs.subject.name,
                'total_score': float(gs.total_score),
                'letter_grade': gs.letter_grade or '',
                'attendance_score': float(gs.attendance_score),
                'assignment_score': float(gs.assignment_score),
                'test_score': float(gs.test_score),
                'exam_score': float(gs.exam_score)
            })

        return Response({
            'class_name': class_session.classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
            'total_subjects': len(grades_data),
            'grades': grades_data  # Already sorted highest to lowest
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"detail": f"Error fetching grades: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_fee_status(request):
    """
    Get the current student's fee payment status.
    """
    user = request.user

    if user.role != 'student':
        return Response(
            {"detail": "This endpoint is only for students"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get student's current session to determine current term
        student_session = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).select_related('class_session').first()

        if not student_session:
            return Response(
                {"detail": "No active session found for student"},
                status=status.HTTP_404_NOT_FOUND
            )

        class_session = student_session.class_session

        # Get fee records for current academic year and term
        fee_records = StudentFeeRecord.objects.filter(
            student=user,
            fee_structure__academic_year=class_session.academic_year,
            fee_structure__term=class_session.term
        ).select_related('fee_structure')

        if not fee_records.exists():
            return Response({
                'has_fees': False,
                'message': 'No fees assigned for current term'
            }, status=status.HTTP_200_OK)

        # Calculate totals
        total_fees = sum(float(record.fee_structure.amount) for record in fee_records)
        total_paid = sum(float(record.amount_paid) for record in fee_records)
        balance = total_fees - total_paid
        percentage_paid = (total_paid / total_fees * 100) if total_fees > 0 else 0

        # Determine overall status
        if total_paid >= total_fees:
            overall_status = 'PAID'
        elif total_paid > 0:
            overall_status = 'PARTIAL'
        else:
            overall_status = 'UNPAID'

        # Get individual fee breakdowns
        fees_breakdown = []
        for record in fee_records:
            fees_breakdown.append({
                'fee_name': record.fee_structure.name,
                'total_amount': float(record.fee_structure.amount),
                'amount_paid': float(record.amount_paid),
                'balance': float(record.fee_structure.amount) - float(record.amount_paid),
                'status': record.payment_status
            })

        return Response({
            'has_fees': True,
            'academic_year': class_session.academic_year,
            'term': class_session.term,
            'total_fees': total_fees,
            'total_paid': total_paid,
            'balance': balance,
            'percentage_paid': round(percentage_paid, 1),
            'overall_status': overall_status,
            'fees_breakdown': fees_breakdown
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"detail": f"Error fetching fee status: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# PARENT DASHBOARD VIEWS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_parent_children(request):
    """
    Get all children linked to the parent account
    """
    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        from academics.models import StudentSession

        children_data = []

        for child in user.children.all():
            # Get current class for this child
            current_session = StudentSession.objects.filter(
                student=child
            ).select_related('class_session__classroom').order_by(
                '-class_session__academic_year', '-class_session__term'
            ).first()

            class_name = "Not Enrolled"
            if current_session:
                class_name = current_session.class_session.classroom.name

            # Check for photo (could be profile_picture or photo field)
            photo_url = None
            if hasattr(child, 'profile_picture') and child.profile_picture:
                photo_url = child.profile_picture.url
            elif hasattr(child, 'photo') and child.photo:
                photo_url = child.photo.url

            children_data.append({
                'id': child.id,
                'first_name': child.first_name,
                'last_name': child.last_name,
                'username': child.username,
                'class_name': class_name,
                'photo_url': photo_url
            })

        return Response({
            'children': children_data,
            'total_children': len(children_data)
        })

    except Exception as e:
        import traceback
        print(f"Error in get_parent_children: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching children: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_child_fee_status(request, child_id):
    """
    Get fee status for a specific child
    """
    from users.models import CustomUser
    from academics.models import StudentSession

    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Verify this child belongs to this parent
    if not user.children.filter(id=child_id).exists():
        return Response(
            {"detail": "You do not have access to this child's information"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        child = CustomUser.objects.get(id=child_id, role='student')

        # Get current class session
        current_session = StudentSession.objects.filter(
            student=child
        ).select_related('class_session').order_by(
            '-class_session__academic_year', '-class_session__term'
        ).first()

        if not current_session:
            return Response({
                'total_fees': 0,
                'amount_paid': 0,
                'balance': 0,
                'status': 'No fees assigned',
                'message': 'Child is not currently enrolled'
            })

        class_session = current_session.class_session

        # Get fee records for this child
        fee_records = StudentFeeRecord.objects.filter(
            student=child,
            fee_structure__academic_year=class_session.academic_year,
            fee_structure__term=class_session.term
        ).select_related('fee_structure')

        if not fee_records.exists():
            return Response({
                'total_fees': 0,
                'amount_paid': 0,
                'balance': 0,
                'status': 'No fees assigned',
                'academic_year': class_session.academic_year,
                'term': class_session.term
            })

        # Calculate totals
        total_fees = sum(float(record.fee_structure.amount) for record in fee_records)
        amount_paid = sum(float(record.amount_paid) for record in fee_records)
        balance = total_fees - amount_paid

        # Get last payment date
        last_payment = fee_records.filter(
            amount_paid__gt=0
        ).order_by('-date_paid').first()

        last_payment_date = None
        if last_payment and last_payment.date_paid:
            last_payment_date = last_payment.date_paid.isoformat()

        return Response({
            'child_name': f"{child.first_name} {child.last_name}",
            'academic_year': class_session.academic_year,
            'term': class_session.term,
            'total_fees': total_fees,
            'amount_paid': amount_paid,
            'balance': balance,
            'last_payment_date': last_payment_date,
            'status': 'Fully Paid' if balance == 0 else 'Outstanding'
        })

    except CustomUser.DoesNotExist:
        return Response(
            {"detail": "Child not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        print(f"Error in get_child_fee_status: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching fee status: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_child_academic_position(request, child_id):
    """
    Get academic position and percentage for a specific child
    """
    from users.models import CustomUser
    from academics.models import StudentSession

    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Verify this child belongs to this parent
    if not user.children.filter(id=child_id).exists():
        return Response(
            {"detail": "You do not have access to this child's information"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        child = CustomUser.objects.get(id=child_id, role='student')

        # Get current class session
        current_session = StudentSession.objects.filter(
            student=child
        ).select_related('class_session').order_by(
            '-class_session__academic_year', '-class_session__term'
        ).first()

        if not current_session:
            return Response({
                'position': 0,
                'total_students': 0,
                'average_percentage': 0,
                'grade_letter': 'N/A',
                'message': 'Child is not currently enrolled'
            })

        class_session = current_session.class_session

        # Get grading configuration for this term
        grading_config = GradingConfiguration.objects.filter(
            academic_year=class_session.academic_year,
            term=class_session.term,
            is_active=True
        ).first()

        if not grading_config:
            return Response({
                'position': 0,
                'total_students': 0,
                'average_percentage': 0,
                'grade_letter': 'N/A',
                'message': 'No grading configuration found'
            })

        # Get all students in the same class
        class_students = StudentSession.objects.filter(
            class_session=class_session
        ).values_list('student_id', flat=True)

        # Get grade summaries for all students in the class
        grade_summaries = GradeSummary.objects.filter(
            student_id__in=class_students,
            grading_config=grading_config
        ).values('student_id').annotate(
            avg_total=Avg('total_score')
        ).order_by('-avg_total')

        # Find child's position
        position = 0
        child_average = 0
        total_students = len(grade_summaries)

        for idx, summary in enumerate(grade_summaries, 1):
            if summary['student_id'] == child_id:
                position = idx
                child_average = float(summary['avg_total']) if summary['avg_total'] else 0
                break

        # Determine grade letter based on grading scale
        grade_letter = 'F'
        if grading_config.grading_scale:
            scale = grading_config.grading_scale
            if child_average >= scale.a_min_score:
                grade_letter = 'A'
            elif child_average >= scale.b_min_score:
                grade_letter = 'B'
            elif child_average >= scale.c_min_score:
                grade_letter = 'C'
            elif child_average >= scale.d_min_score:
                grade_letter = 'D'

        return Response({
            'position': position,
            'total_students': total_students,
            'average_percentage': round(child_average, 1),
            'grade_letter': grade_letter,
            'academic_year': class_session.academic_year,
            'term': class_session.term
        })

    except CustomUser.DoesNotExist:
        return Response(
            {"detail": "Child not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        print(f"Error in get_child_academic_position: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching academic position: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_child_subject_grades(request, child_id):
    """
    Get subject grades for a specific child, focusing on lowest 3 subjects needing improvement
    """
    from users.models import CustomUser
    from academics.models import StudentSession

    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Verify this child belongs to this parent
    if not user.children.filter(id=child_id).exists():
        return Response(
            {"detail": "You do not have access to this child's information"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        child = CustomUser.objects.get(id=child_id, role='student')

        # Get current class session
        current_session = StudentSession.objects.filter(
            student=child
        ).select_related('class_session').order_by(
            '-class_session__academic_year', '-class_session__term'
        ).first()

        if not current_session:
            return Response({
                'lowest_subjects': [],
                'message': 'Child is not currently enrolled'
            })

        class_session = current_session.class_session

        # Get grading configuration for this term
        grading_config = GradingConfiguration.objects.filter(
            academic_year=class_session.academic_year,
            term=class_session.term,
            is_active=True
        ).first()

        if not grading_config:
            return Response({
                'lowest_subjects': [],
                'message': 'No grading configuration found'
            })

        # Get all grade summaries for this child
        try:
            grade_summaries = GradeSummary.objects.filter(
                student=child,
                grading_config=grading_config
            ).select_related('subject').order_by('total_score')[:3]
        except Exception as e:
            print(f"Error fetching grade summaries: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return Response({
                'lowest_subjects': [],
                'message': f'Error fetching grades: {str(e)}'
            })

        # Format the lowest 3 subjects
        lowest_subjects = []
        for summary in grade_summaries:
            try:
                teacher_name = "Not Assigned"
                if summary.subject.teacher:
                    teacher_name = f"{summary.subject.teacher.first_name} {summary.subject.teacher.last_name}"

                lowest_subjects.append({
                    'subject_id': summary.subject.id,
                    'subject_name': summary.subject.name,
                    'teacher_name': teacher_name,
                    'total_score': float(summary.total_score)
                })
            except Exception as e:
                print(f"Error processing subject {summary.subject.id}: {str(e)}")
                continue

        return Response({
            'lowest_subjects': lowest_subjects,
            'academic_year': class_session.academic_year,
            'term': class_session.term
        })

    except CustomUser.DoesNotExist:
        return Response(
            {"detail": "Child not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        print(f"Error in get_child_subject_grades: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching subject grades: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_child_assignments(request, child_id):
    """
    Get overdue and unsubmitted assignments for a specific child
    """
    from users.models import CustomUser
    from academics.models import StudentSession, SubjectContent, AssignmentSubmission
    from django.utils import timezone

    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Verify this child belongs to this parent
    if not user.children.filter(id=child_id).exists():
        return Response(
            {"detail": "You do not have access to this child's information"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        child = CustomUser.objects.get(id=child_id, role='student')

        # Get current class session
        current_session = StudentSession.objects.filter(
            student=child,
            is_active=True
        ).select_related('class_session').order_by(
            '-class_session__academic_year', '-class_session__term'
        ).first()

        if not current_session:
            return Response({
                'assignments': [],
                'total_overdue': 0,
                'total_pending': 0,
                'message': 'Child is not currently enrolled'
            })

        class_session = current_session.class_session

        # Get all subjects for this class session
        subjects = class_session.subjects.all()

        # Get all assignments for these subjects
        assignments = SubjectContent.objects.filter(
            subject__in=subjects,
            content_type='assignment',
            is_active=True
        ).select_related('subject', 'subject__teacher').order_by('due_date')

        assignment_data = []
        overdue_count = 0
        pending_count = 0
        now = timezone.now()

        for assignment in assignments:
            # Check if student has submitted this assignment
            submission = AssignmentSubmission.objects.filter(
                student=child,
                assignment=assignment
            ).first()

            # Only include if not submitted or pending
            if not submission or submission.status == 'pending':
                is_overdue = assignment.due_date and now > assignment.due_date

                if is_overdue:
                    overdue_count += 1
                else:
                    pending_count += 1

                assignment_data.append({
                    'id': assignment.id,
                    'title': assignment.title,
                    'subject_name': assignment.subject.name,
                    'teacher_name': assignment.subject.teacher.get_full_name() if assignment.subject.teacher else 'No teacher assigned',
                    'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
                    'is_overdue': is_overdue,
                    'max_score': assignment.max_score,
                    'days_overdue': (now - assignment.due_date).days if is_overdue else 0,
                    'status': 'overdue' if is_overdue else 'pending'
                })

        # Sort by overdue first, then by due date
        assignment_data.sort(key=lambda x: (not x['is_overdue'], x['due_date'] or ''))

        return Response({
            'child_name': f"{child.first_name} {child.last_name}",
            'assignments': assignment_data,
            'total_overdue': overdue_count,
            'total_pending': pending_count,
            'total_count': len(assignment_data),
            'academic_year': class_session.academic_year,
            'term': class_session.term
        })

    except CustomUser.DoesNotExist:
        return Response(
            {"detail": "Child not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        print(f"Error in get_child_assignments: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching assignments: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_parent_announcements(request):
    """
    Get all announcements/notifications for the logged-in parent
    Includes:
    - Direct notifications (report releases, fee reminders, incomplete grades)
    - Activity notifications from their children's classes (assignments, notes, announcements)
    """
    from logs.models import Notification, ActivityLog, NotificationStatus

    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get direct notifications (Notification model)
        direct_notifications = Notification.objects.filter(
            recipient=user
        ).order_by('-created_at')[:50]  # Limit to last 50

        # Get activity-based notifications (ActivityLog with NotificationStatus)
        activity_notifications = NotificationStatus.objects.filter(
            user=user
        ).select_related('activity_log', 'activity_log__subject').order_by('-activity_log__timestamp')[:50]

        # Format direct notifications
        notifications_list = []

        for notif in direct_notifications:
            # Determine which child this notification is about
            child_name = None
            if notif.extra_data and 'student_name' in notif.extra_data:
                child_name = notif.extra_data['student_name']

            notifications_list.append({
                'id': notif.id,
                'type': 'direct',
                'notification_type': notif.notification_type,
                'title': notif.title,
                'message': notif.message,
                'priority': notif.priority,
                'is_read': notif.is_read,
                'created_at': notif.created_at.isoformat(),
                'child_name': child_name,
                'extra_data': notif.extra_data
            })

        # Format activity notifications
        for notif_status in activity_notifications:
            activity = notif_status.activity_log

            # Get student name from the activity context
            child_name = None
            if activity.extra_data and 'class_session_id' in activity.extra_data:
                # This is about a class, find which of parent's children is in this class
                from academics.models import StudentSession
                children_in_class = user.children.filter(
                    student_sessions__class_session_id=activity.extra_data['class_session_id'],
                    student_sessions__is_active=True
                )
                if children_in_class.exists():
                    child_name = children_in_class.first().get_full_name()

            notifications_list.append({
                'id': f"activity_{notif_status.id}",
                'type': 'activity',
                'notification_type': activity.content_type or 'general',
                'title': activity.content_title or 'New Activity',
                'message': f"{activity.action} - Check the {activity.content_type} for {child_name or 'your child'}",
                'priority': 'medium',
                'is_read': notif_status.is_read,
                'created_at': activity.timestamp.isoformat(),
                'child_name': child_name,
                'extra_data': {
                    'subject_name': activity.subject.name if activity.subject else None,
                    'classroom': activity.extra_data.get('classroom') if activity.extra_data else None,
                    'teacher_name': activity.extra_data.get('teacher_name') if activity.extra_data else None
                }
            })

        # Combine and sort by date
        notifications_list.sort(key=lambda x: x['created_at'], reverse=True)

        # Count unread
        unread_count = sum(1 for n in notifications_list if not n['is_read'])

        return Response({
            'notifications': notifications_list[:50],  # Return max 50
            'total_count': len(notifications_list),
            'unread_count': unread_count
        })

    except Exception as e:
        import traceback
        print(f"Error in get_parent_announcements: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching announcements: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_fee_receipt(request, receipt_id):
    """
    Download fee receipt as PDF
    """
    from schooladmin.models import FeeReceipt, FeePaymentHistory
    from schooladmin.pdf_generator import generate_fee_receipt_pdf
    from django.http import HttpResponse

    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get the receipt and verify parent has access
        receipt = FeeReceipt.objects.select_related(
            'student', 'student__classroom', 'issued_by'
        ).get(id=receipt_id)

        # Check if the parent has access to this student
        if not receipt.student.parents.filter(id=user.id).exists():
            return Response(
                {"detail": "You don't have access to this receipt"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get the student's fee record to fetch payment history
        from schooladmin.models import StudentFeeRecord
        try:
            fee_record = StudentFeeRecord.objects.get(
                student=receipt.student,
                fee_structure__academic_year=receipt.academic_year,
                fee_structure__term=receipt.term
            )
            # Get payment history
            payment_history = FeePaymentHistory.objects.filter(
                fee_record=fee_record
            ).select_related('recorded_by').order_by('transaction_date')
        except StudentFeeRecord.DoesNotExist:
            payment_history = []

        # Generate PDF
        pdf = generate_fee_receipt_pdf(receipt, payment_history)

        # Create HTTP response with PDF
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="receipt_{receipt.receipt_number}.pdf"'

        return response

    except FeeReceipt.DoesNotExist:
        return Response(
            {"detail": "Receipt not found"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_admin_fee_receipts(request):
    """
    Get all fee receipts for admin with filters
    Filters: academic_year, term, class_id
    """
    from schooladmin.models import FeeReceipt
    from academics.models import ClassSession, Class

    try:
        # Get filters from query params
        academic_year = request.query_params.get('academic_year', None)
        term = request.query_params.get('term', None)
        class_id = request.query_params.get('class_id', None)

        # Build query
        receipts_query = FeeReceipt.objects.select_related(
            'student', 'student__classroom', 'issued_by'
        ).all()

        if academic_year:
            receipts_query = receipts_query.filter(academic_year=academic_year)
        if term:
            receipts_query = receipts_query.filter(term=term)
        if class_id:
            receipts_query = receipts_query.filter(student__classroom_id=class_id)

        receipts = receipts_query.order_by('-date_issued')

        # Format receipts
        receipts_list = []
        for receipt in receipts:
            receipts_list.append({
                'id': receipt.id,
                'receipt_number': receipt.receipt_number,
                'student_name': f"{receipt.student.first_name} {receipt.student.last_name}",
                'student_username': receipt.student.username,
                'student_id': receipt.student.id,
                'class_name': receipt.student.classroom.name if receipt.student.classroom else 'N/A',
                'academic_year': receipt.academic_year,
                'term': receipt.term,
                'total_fees': float(receipt.total_fees),
                'amount_paid': float(receipt.amount_paid),
                'balance': float(receipt.balance),
                'status': receipt.status,
                'date_issued': receipt.date_issued.isoformat(),
                'issued_by': f"{receipt.issued_by.first_name} {receipt.issued_by.last_name}" if receipt.issued_by else 'System'
            })

        # Get available academic sessions
        available_sessions = ClassSession.objects.values(
            'academic_year', 'term'
        ).distinct().order_by('-academic_year', 'term')

        sessions_list = [
            {
                'academic_year': session['academic_year'],
                'term': session['term']
            }
            for session in available_sessions
        ]

        # Get all classes
        classes = Class.objects.all().order_by('name')
        classes_list = [
            {
                'id': cls.id,
                'name': cls.name
            }
            for cls in classes
        ]

        return Response({
            'receipts': receipts_list,
            'available_sessions': sessions_list,
            'classes': classes_list
        })

    except Exception as e:
        import traceback
        print(f"Error in get_admin_fee_receipts: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching receipts: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def download_admin_fee_receipt(request, receipt_id):
    """
    Download fee receipt as PDF for admin
    """
    from schooladmin.models import FeeReceipt, FeePaymentHistory, StudentFeeRecord
    from schooladmin.pdf_generator import generate_fee_receipt_pdf
    from django.http import HttpResponse

    try:
        # Get the receipt
        receipt = FeeReceipt.objects.select_related(
            'student', 'student__classroom', 'issued_by'
        ).get(id=receipt_id)

        # Get the student's fee record to fetch payment history
        try:
            fee_record = StudentFeeRecord.objects.get(
                student=receipt.student,
                fee_structure__academic_year=receipt.academic_year,
                fee_structure__term=receipt.term
            )
            # Get payment history
            payment_history = FeePaymentHistory.objects.filter(
                fee_record=fee_record
            ).select_related('recorded_by').order_by('transaction_date')
        except StudentFeeRecord.DoesNotExist:
            payment_history = []

        # Generate PDF
        pdf = generate_fee_receipt_pdf(receipt, payment_history)

        # Create HTTP response with PDF
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="receipt_{receipt.receipt_number}.pdf"'

        return response

    except FeeReceipt.DoesNotExist:
        return Response(
            {"detail": "Receipt not found"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_parent_fee_receipts(request):
    """
    Get fee receipts for the logged-in parent's children with filters
    Filters: child_id, academic_year, term
    """
    from schooladmin.models import FeeReceipt
    from academics.models import ClassSession

    user = request.user

    if user.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Get parent's children
        children = user.children.filter(role='student')

        if not children.exists():
            return Response({
                'receipts': [],
                'children': [],
                'available_sessions': []
            })

        # Get filters from query params
        child_id = request.query_params.get('child_id', None)
        academic_year = request.query_params.get('academic_year', None)
        term = request.query_params.get('term', None)

        # Build query
        receipts_query = FeeReceipt.objects.filter(student__in=children)

        if child_id:
            receipts_query = receipts_query.filter(student_id=child_id)
        if academic_year:
            receipts_query = receipts_query.filter(academic_year=academic_year)
        if term:
            receipts_query = receipts_query.filter(term=term)

        receipts = receipts_query.select_related('student', 'issued_by').order_by('-date_issued')

        # Format receipts
        receipts_list = []
        for receipt in receipts:
            receipts_list.append({
                'id': receipt.id,
                'receipt_number': receipt.receipt_number,
                'student_name': f"{receipt.student.first_name} {receipt.student.last_name}",
                'student_id': receipt.student.id,
                'academic_year': receipt.academic_year,
                'term': receipt.term,
                'total_fees': float(receipt.total_fees),
                'amount_paid': float(receipt.amount_paid),
                'balance': float(receipt.balance),
                'status': receipt.status,
                'date_issued': receipt.date_issued.isoformat(),
                'payment_method': receipt.payment_method,
                'transaction_reference': receipt.transaction_reference,
                'remarks': receipt.remarks
            })

        # Get children list for filter
        children_list = []
        for child in children:
            try:
                # Get the child's current class
                student_session = child.student_sessions.filter(
                    class_session__is_active=True
                ).select_related('class_session', 'class_session__class_obj').first()

                class_name = student_session.class_session.class_obj.name if student_session else 'N/A'
            except:
                class_name = 'N/A'

            children_list.append({
                'id': child.id,
                'first_name': child.first_name,
                'last_name': child.last_name,
                'class_name': class_name
            })

        # Get available academic sessions (all sessions, not just active)
        available_sessions = ClassSession.objects.values(
            'academic_year', 'term'
        ).distinct().order_by('-academic_year', 'term')

        sessions_list = [
            {
                'academic_year': session['academic_year'],
                'term': session['term']
            }
            for session in available_sessions
        ]

        return Response({
            'receipts': receipts_list,
            'children': children_list,
            'available_sessions': sessions_list
        })

    except Exception as e:
        import traceback
        print(f"Error in get_parent_fee_receipts: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching receipts: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_teacher_grading_stats(request):
    """
    Get grading statistics for teacher dashboard showing:
    - Test: students who completed but not scored, students who haven't completed
    - Exam: students who completed but not scored, students who haven't completed
    For the current active academic session
    """
    from academics.models import Subject, ClassSession, Assessment, StudentSession, AssessmentSubmission
    from schooladmin.models import GradeSummary, GradingConfiguration
    from django.db.models import Q, Count
    
    user = request.user
    
    if user.role not in ['teacher', 'admin']:
        return Response(
            {"detail": "Only teachers and admins can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get current active grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()
    
    if not grading_config:
        return Response({
            'current_session': 'No active session',
            'test': {
                'completed_not_scored': 0,
                'not_completed': 0,
                'total_students': 0
            },
            'exam': {
                'completed_not_scored': 0,
                'not_completed': 0,
                'total_students': 0
            }
        })
    
    current_session = f"{grading_config.academic_year} - {grading_config.term}"
    
    # Get all subjects taught by this teacher for the current session
    subjects = Subject.objects.filter(
        teacher=user,
        class_session__academic_year=grading_config.academic_year,
        class_session__term=grading_config.term
    ).select_related('class_session')

    # Build subject-level statistics
    subjects_data = []

    for subject in subjects:
        # Get students in this class session
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session,
            is_active=True
        ).select_related('student')

        # Filter by department if subject has a department
        if subject.department and subject.department != 'General':
            student_sessions = student_sessions.filter(
                student__department=subject.department
            )

        # Initialize counters for this subject
        test_graded = 0
        test_awaiting_or_not_done = 0
        exam_graded = 0
        exam_awaiting_or_not_done = 0
        total_students = student_sessions.count()

        for student_session in student_sessions:
            student = student_session.student

            # Check test and exam status in one query
            try:
                grade_summary = GradeSummary.objects.get(
                    student=student,
                    subject=subject,
                    grading_config=grading_config
                )

                # Test: if score > 0, it's graded. Otherwise, awaiting/not done
                test_score = float(grade_summary.test_score) if grade_summary.test_score else 0
                if test_score > 0:
                    test_graded += 1
                else:
                    test_awaiting_or_not_done += 1

                # Exam: if score > 0, it's graded. Otherwise, awaiting/not done
                exam_score = float(grade_summary.exam_score) if grade_summary.exam_score else 0
                if exam_score > 0:
                    exam_graded += 1
                else:
                    exam_awaiting_or_not_done += 1

            except GradeSummary.DoesNotExist:
                # No GradeSummary = not graded
                test_awaiting_or_not_done += 1
                exam_awaiting_or_not_done += 1

        # Get top 3 and bottom 3 students for test and exam
        # Get all graded students for this subject
        graded_summaries = GradeSummary.objects.filter(
            subject=subject,
            grading_config=grading_config
        ).select_related('student').order_by('-total_score')

        # Filter only students who have test scores
        test_graded_students = [
            gs for gs in graded_summaries
            if gs.test_score and float(gs.test_score) > 0
        ]

        # Filter only students who have exam scores
        exam_graded_students = [
            gs for gs in graded_summaries
            if gs.exam_score and float(gs.exam_score) > 0
        ]

        # Sort by test score
        test_sorted = sorted(
            test_graded_students,
            key=lambda x: float(x.test_score) if x.test_score else 0,
            reverse=True
        )

        # Sort by exam score
        exam_sorted = sorted(
            exam_graded_students,
            key=lambda x: float(x.exam_score) if x.exam_score else 0,
            reverse=True
        )

        # Top 3 and Bottom 3 for Test
        test_top_3 = [
            {
                'id': gs.student.id,
                'full_name': gs.student.get_full_name(),
                'username': gs.student.username
            }
            for gs in test_sorted[:3]
        ]

        test_bottom_3 = [
            {
                'id': gs.student.id,
                'full_name': gs.student.get_full_name(),
                'username': gs.student.username
            }
            for gs in test_sorted[-3:][::-1] if len(test_sorted) > 0
        ]

        # Top 3 and Bottom 3 for Exam
        exam_top_3 = [
            {
                'id': gs.student.id,
                'full_name': gs.student.get_full_name(),
                'username': gs.student.username
            }
            for gs in exam_sorted[:3]
        ]

        exam_bottom_3 = [
            {
                'id': gs.student.id,
                'full_name': gs.student.get_full_name(),
                'username': gs.student.username
            }
            for gs in exam_sorted[-3:][::-1] if len(exam_sorted) > 0
        ]

        subjects_data.append({
            'id': subject.id,
            'name': subject.name,
            'class_name': subject.class_session.classroom.name,
            'department': subject.department or 'General',
            'test': {
                'graded': test_graded,
                'awaiting_or_not_done': test_awaiting_or_not_done,
                'total_students': total_students,
                'top_3': test_top_3,
                'bottom_3': test_bottom_3
            },
            'exam': {
                'graded': exam_graded,
                'awaiting_or_not_done': exam_awaiting_or_not_done,
                'total_students': total_students,
                'top_3': exam_top_3,
                'bottom_3': exam_bottom_3
            }
        })

    return Response({
        'current_session': current_session,
        'subjects': subjects_data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_incomplete_assessment_students(request):
    """
    Get list of students who haven't completed a specific assessment type for a subject
    Query params: subject_id, assessment_type (test or exam)
    """
    from academics.models import Subject, Assessment, StudentSession, AssessmentSubmission
    from schooladmin.models import GradingConfiguration

    user = request.user
    subject_id = request.query_params.get('subject_id')
    assessment_type = request.query_params.get('assessment_type')  # 'test' or 'exam'

    if not subject_id or not assessment_type:
        return Response(
            {"detail": "subject_id and assessment_type are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if assessment_type not in ['test', 'exam']:
        return Response(
            {"detail": "assessment_type must be 'test' or 'exam'"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        subject = Subject.objects.select_related('class_session__classroom').get(id=subject_id)
    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check if user has permission to view this subject
    if user.role == 'teacher' and subject.teacher != user:
        return Response(
            {"detail": "You don't have permission to view this subject"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get students in this class session
    student_sessions = StudentSession.objects.filter(
        class_session=subject.class_session,
        is_active=True
    ).select_related('student')

    # Filter by department if subject has a department
    if subject.department and subject.department != 'General':
        student_sessions = student_sessions.filter(
            student__department=subject.department
        )

    # Get active grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()

    # Find students who don't have a score (awaiting grading or not done)
    awaiting_students = []

    for student_session in student_sessions:
        student = student_session.student

        # Check GradeSummary for score
        try:
            grade_summary = GradeSummary.objects.get(
                student=student,
                subject=subject,
                grading_config=grading_config
            )

            # Get score based on assessment type
            if assessment_type == 'test':
                score = float(grade_summary.test_score) if grade_summary.test_score else 0
            else:  # exam
                score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

            # If score is 0, they're awaiting grading
            if score == 0:
                awaiting_students.append({
                    'id': student.id,
                    'username': student.username,
                    'full_name': student.get_full_name(),
                    'email': student.email,
                    'status': 'Awaiting Grading'
                })

        except GradeSummary.DoesNotExist:
            # No GradeSummary = not done
            awaiting_students.append({
                'id': student.id,
                'username': student.username,
                'full_name': student.get_full_name(),
                'email': student.email,
                'status': 'Not Done'
            })

    return Response({
        'subject': {
            'id': subject.id,
            'name': subject.name,
            'class_name': subject.class_session.classroom.name
        },
        'assessment_type': assessment_type,
        'students': awaiting_students,
        'total_count': len(awaiting_students)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_graded_assessment_students(request):
    """
    Get list of students who have been graded for a specific assessment type
    Query params: subject_id, assessment_type (test or exam)
    """
    from academics.models import Subject, StudentSession
    from schooladmin.models import GradingConfiguration

    user = request.user
    subject_id = request.query_params.get('subject_id')
    assessment_type = request.query_params.get('assessment_type')  # 'test' or 'exam'

    if not subject_id or not assessment_type:
        return Response(
            {"detail": "subject_id and assessment_type are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if assessment_type not in ['test', 'exam']:
        return Response(
            {"detail": "assessment_type must be 'test' or 'exam'"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        subject = Subject.objects.select_related('class_session__classroom').get(id=subject_id)
    except Subject.DoesNotExist:
        return Response(
            {"detail": "Subject not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check if user has permission to view this subject
    if user.role == 'teacher' and subject.teacher != user:
        return Response(
            {"detail": "You don't have permission to view this subject"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get students in this class session
    student_sessions = StudentSession.objects.filter(
        class_session=subject.class_session,
        is_active=True
    ).select_related('student')

    # Filter by department if subject has a department
    if subject.department and subject.department != 'General':
        student_sessions = student_sessions.filter(
            student__department=subject.department
        )

    # Get active grading configuration
    grading_config = GradingConfiguration.objects.filter(is_active=True).first()

    # Find students who have been graded (score > 0)
    graded_students = []

    for student_session in student_sessions:
        student = student_session.student

        # Check GradeSummary for score
        try:
            grade_summary = GradeSummary.objects.get(
                student=student,
                subject=subject,
                grading_config=grading_config
            )

            # Get score based on assessment type
            if assessment_type == 'test':
                score = float(grade_summary.test_score) if grade_summary.test_score else 0
            else:  # exam
                score = float(grade_summary.exam_score) if grade_summary.exam_score else 0

            # If score > 0, they're graded
            if score > 0:
                graded_students.append({
                    'id': student.id,
                    'username': student.username,
                    'full_name': student.get_full_name(),
                    'email': student.email,
                    'score': score
                })

        except GradeSummary.DoesNotExist:
            # No GradeSummary = not graded
            pass

    return Response({
        'subject': {
            'id': subject.id,
            'name': subject.name,
            'class_name': subject.class_session.classroom.name
        },
        'assessment_type': assessment_type,
        'students': graded_students,
        'total_count': len(graded_students)
    })


# ============================================================================
# ANNOUNCEMENT VIEWS
# ============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def manage_announcements(request):
    """
    GET: List all announcements with filters
    POST: Create a new announcement
    """
    from schooladmin.models import Announcement
    from users.models import CustomUser
    from academics.models import Class

    if request.method == 'GET':
        # Get query parameters for filters
        audience = request.query_params.get('audience', None)
        priority = request.query_params.get('priority', None)
        is_active = request.query_params.get('is_active', None)

        announcements = Announcement.objects.select_related('created_by').prefetch_related(
            'specific_users', 'specific_classes', 'read_by'
        ).all()

        # Apply filters
        if audience:
            announcements = announcements.filter(audience=audience)
        if priority:
            announcements = announcements.filter(priority=priority)
        if is_active is not None:
            is_active_bool = is_active.lower() == 'true'
            announcements = announcements.filter(is_active=is_active_bool)

        announcements_data = []
        for announcement in announcements:
            announcements_data.append({
                'id': announcement.id,
                'title': announcement.title,
                'message': announcement.message,
                'audience': announcement.audience,
                'audience_display': announcement.get_audience_display(),
                'priority': announcement.priority,
                'priority_display': announcement.get_priority_display(),
                'send_type': announcement.send_type,
                'send_status': announcement.send_status,
                'scheduled_date': announcement.scheduled_date,
                'scheduled_time': announcement.scheduled_time,
                'sent_at': announcement.sent_at,
                'parent_filter': announcement.parent_filter,
                'student_filter': announcement.student_filter,
                'teacher_filter': announcement.teacher_filter,
                'grading_deadline': announcement.grading_deadline,
                'is_recurring': announcement.is_recurring,
                'recurrence_days': announcement.recurrence_days,
                'last_sent_date': announcement.last_sent_date,
                'next_send_date': announcement.next_send_date,
                'created_by': announcement.created_by.get_full_name(),
                'created_at': announcement.created_at,
                'updated_at': announcement.updated_at,
                'is_active': announcement.is_active,
                'recipients_count': announcement.get_recipients_count(),
                'read_count': announcement.read_by.count(),
                'specific_users': [
                    {'id': user.id, 'username': user.username, 'full_name': user.get_full_name()}
                    for user in announcement.specific_users.all()
                ],
                'specific_classes': [
                    {'id': cls.id, 'name': cls.name}
                    for cls in announcement.specific_classes.all()
                ]
            })

        return Response({
            'announcements': announcements_data,
            'total': len(announcements_data)
        })

    elif request.method == 'POST':
        data = request.data
        title = data.get('title')
        message = data.get('message')
        audience = data.get('audience', 'everyone')
        priority = data.get('priority', 'medium')
        send_type = data.get('send_type', 'manual')

        # Handle date/time fields - convert empty strings to None
        scheduled_date = data.get('scheduled_date')
        scheduled_date = None if scheduled_date == '' else scheduled_date

        scheduled_time = data.get('scheduled_time')
        scheduled_time = None if scheduled_time == '' else scheduled_time

        specific_user_ids = data.get('specific_users', [])
        specific_class_ids = data.get('specific_classes', [])

        # New targeting filters
        parent_filter = data.get('parent_filter', 'all')
        student_filter = data.get('student_filter', 'all')
        teacher_filter = data.get('teacher_filter', 'all')

        grading_deadline = data.get('grading_deadline', None)
        grading_deadline = None if grading_deadline == '' else grading_deadline

        # Recurrence settings
        is_recurring = data.get('is_recurring', False)
        recurrence_days = data.get('recurrence_days', None)
        recurrence_days = None if recurrence_days == '' else recurrence_days

        if not title or not message:
            return Response(
                {'detail': 'Title and message are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate scheduling fields if send_type is 'scheduled'
        if send_type == 'scheduled':
            if not scheduled_date or not scheduled_time:
                return Response(
                    {'detail': 'Scheduled date and time are required for scheduled announcements'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate recurrence settings
        if is_recurring and not recurrence_days:
            return Response(
                {'detail': 'Recurrence days are required for recurring announcements'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate teacher filter settings
        if audience == 'teachers' and teacher_filter == 'incomplete_grading' and not grading_deadline:
            return Response(
                {'detail': 'Grading deadline is required when targeting teachers with incomplete grading'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine initial send_status
        if send_type == 'manual':
            send_status = 'draft'
        else:
            send_status = 'scheduled'

        # Calculate next_send_date for recurring announcements
        next_send_date = None
        if is_recurring and recurrence_days and scheduled_date:
            from datetime import datetime, timedelta
            base_date = datetime.strptime(scheduled_date, '%Y-%m-%d').date()
            next_send_date = base_date

        # Create announcement
        announcement = Announcement.objects.create(
            title=title,
            message=message,
            audience=audience,
            priority=priority,
            send_type=send_type,
            scheduled_date=scheduled_date if send_type == 'scheduled' else None,
            scheduled_time=scheduled_time if send_type == 'scheduled' else None,
            send_status=send_status,
            parent_filter=parent_filter,
            student_filter=student_filter,
            teacher_filter=teacher_filter,
            grading_deadline=grading_deadline if teacher_filter == 'incomplete_grading' else None,
            is_recurring=is_recurring,
            recurrence_days=recurrence_days if is_recurring else None,
            next_send_date=next_send_date,
            created_by=request.user,
            is_active=False
        )

        # Add specific users if audience is 'specific'
        if audience == 'specific' and specific_user_ids:
            users = CustomUser.objects.filter(id__in=specific_user_ids)
            announcement.specific_users.set(users)

        # Add specific classes if provided
        if specific_class_ids:
            classes = Class.objects.filter(id__in=specific_class_ids)
            announcement.specific_classes.set(classes)

        # If manual send, immediately send the announcement
        if send_type == 'manual':
            try:
                notifications_sent = announcement.send_announcement()
                message_text = f'Announcement sent successfully to {notifications_sent} recipient(s)'
            except Exception as e:
                import traceback
                print(f"Error sending announcement: {str(e)}")
                print(traceback.format_exc())
                message_text = f'Announcement created but failed to send: {str(e)}'
        else:
            message_text = f'Announcement scheduled for {scheduled_date} at {scheduled_time}'

        return Response({
            'message': message_text,
            'announcement': {
                'id': announcement.id,
                'title': announcement.title,
                'message': announcement.message,
                'audience': announcement.audience,
                'priority': announcement.priority,
                'send_type': announcement.send_type,
                'send_status': announcement.send_status,
                'scheduled_date': announcement.scheduled_date,
                'scheduled_time': announcement.scheduled_time,
                'parent_filter': announcement.parent_filter,
                'student_filter': announcement.student_filter,
                'teacher_filter': announcement.teacher_filter,
                'grading_deadline': announcement.grading_deadline,
                'is_recurring': announcement.is_recurring,
                'recurrence_days': announcement.recurrence_days,
                'next_send_date': announcement.next_send_date,
                'recipients_count': announcement.get_recipients_count()
            }
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminRole])
def announcement_detail(request, announcement_id):
    """
    GET: Get announcement details
    PUT: Update announcement
    DELETE: Delete announcement
    """
    from schooladmin.models import Announcement
    from users.models import CustomUser
    from academics.models import Class

    try:
        announcement = Announcement.objects.select_related('created_by').prefetch_related(
            'specific_users', 'specific_classes', 'read_by'
        ).get(id=announcement_id)
    except Announcement.DoesNotExist:
        return Response(
            {'detail': 'Announcement not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        return Response({
            'id': announcement.id,
            'title': announcement.title,
            'message': announcement.message,
            'audience': announcement.audience,
            'audience_display': announcement.get_audience_display(),
            'priority': announcement.priority,
            'priority_display': announcement.get_priority_display(),
            'send_type': announcement.send_type,
            'send_status': announcement.send_status,
            'scheduled_date': announcement.scheduled_date,
            'scheduled_time': announcement.scheduled_time,
            'sent_at': announcement.sent_at,
            'parent_filter': announcement.parent_filter,
            'student_filter': announcement.student_filter,
            'teacher_filter': announcement.teacher_filter,
            'grading_deadline': announcement.grading_deadline,
            'is_recurring': announcement.is_recurring,
            'recurrence_days': announcement.recurrence_days,
            'last_sent_date': announcement.last_sent_date,
            'next_send_date': announcement.next_send_date,
            'created_by': announcement.created_by.get_full_name(),
            'created_at': announcement.created_at,
            'updated_at': announcement.updated_at,
            'is_active': announcement.is_active,
            'recipients_count': announcement.get_recipients_count(),
            'read_count': announcement.read_by.count(),
            'specific_users': [
                {'id': user.id, 'username': user.username, 'full_name': user.get_full_name()}
                for user in announcement.specific_users.all()
            ],
            'specific_classes': [
                {'id': cls.id, 'name': cls.name}
                for cls in announcement.specific_classes.all()
            ]
        })

    elif request.method == 'PUT':
        data = request.data
        announcement.title = data.get('title', announcement.title)
        announcement.message = data.get('message', announcement.message)
        announcement.audience = data.get('audience', announcement.audience)
        announcement.priority = data.get('priority', announcement.priority)
        announcement.is_active = data.get('is_active', announcement.is_active)
        announcement.send_type = data.get('send_type', announcement.send_type)

        # Handle date fields - convert empty strings to None
        scheduled_date = data.get('scheduled_date', announcement.scheduled_date)
        announcement.scheduled_date = None if scheduled_date == '' else scheduled_date

        scheduled_time = data.get('scheduled_time', announcement.scheduled_time)
        announcement.scheduled_time = None if scheduled_time == '' else scheduled_time

        announcement.parent_filter = data.get('parent_filter', announcement.parent_filter)
        announcement.student_filter = data.get('student_filter', announcement.student_filter)
        announcement.teacher_filter = data.get('teacher_filter', announcement.teacher_filter)

        grading_deadline = data.get('grading_deadline', announcement.grading_deadline)
        announcement.grading_deadline = None if grading_deadline == '' else grading_deadline

        announcement.is_recurring = data.get('is_recurring', announcement.is_recurring)

        recurrence_days = data.get('recurrence_days', announcement.recurrence_days)
        announcement.recurrence_days = None if recurrence_days == '' else recurrence_days

        announcement.save()

        # Update specific users if provided
        if 'specific_users' in data:
            user_ids = data.get('specific_users', [])
            users = CustomUser.objects.filter(id__in=user_ids)
            announcement.specific_users.set(users)

        # Update specific classes if provided
        if 'specific_classes' in data:
            class_ids = data.get('specific_classes', [])
            classes = Class.objects.filter(id__in=class_ids)
            announcement.specific_classes.set(classes)

        # If manual send and not yet sent, send the announcement
        message_text = 'Announcement updated successfully'
        if announcement.send_type == 'manual' and announcement.send_status == 'draft':
            try:
                notifications_sent = announcement.send_announcement()
                message_text = f'Announcement sent successfully to {notifications_sent} recipient(s)'
            except Exception as e:
                import traceback
                print(f"Error sending announcement: {str(e)}")
                print(traceback.format_exc())
                message_text = f'Announcement updated but failed to send: {str(e)}'

        return Response({
            'message': message_text,
            'announcement': {
                'id': announcement.id,
                'title': announcement.title,
                'message': announcement.message,
                'audience': announcement.audience,
                'priority': announcement.priority,
                'is_active': announcement.is_active,
                'send_type': announcement.send_type,
                'send_status': announcement.send_status,
                'scheduled_date': announcement.scheduled_date,
                'scheduled_time': announcement.scheduled_time
            }
        })

    elif request.method == 'DELETE':
        announcement.delete()
        return Response(
            {'message': 'Announcement deleted successfully'},
            status=status.HTTP_200_OK
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_users_and_classes_for_announcements(request):
    """
    Get list of users and classes for announcement audience selection
    Supports search query parameter for filtering users
    """
    from users.models import CustomUser
    from academics.models import Class

    # Get search query parameter
    search_query = request.query_params.get('search', '').strip()

    # Base queryset
    users_queryset = CustomUser.objects.filter(is_active=True)

    # Apply search filter if provided
    if search_query:
        users_queryset = users_queryset.filter(
            Q(username__icontains=search_query) |
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(email__icontains=search_query)
        )

    users = users_queryset.values('id', 'username', 'first_name', 'last_name', 'role', 'email')
    classes = Class.objects.all().values('id', 'name')

    users_data = [
        {
            'id': user['id'],
            'username': user['username'],
            'full_name': f"{user['first_name']} {user['last_name']}".strip(),
            'role': user['role'],
            'email': user['email']
        }
        for user in users
    ]

    return Response({
        'users': users_data,
        'classes': list(classes)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_announcements(request):
    """
    Get announcements for the current logged-in user
    Returns both announcements and notifications
    - For teachers: includes admin announcements + direct notifications (like grading reminders)
    - For students/parents: includes admin announcements + direct notifications
    """
    from schooladmin.models import Announcement
    from logs.models import Notification
    from django.db.models import Q

    user = request.user

    try:
        # Get admin-created announcements that target this user based on their role
        announcements = Announcement.objects.filter(
            is_active=True,
            send_status='sent'
        ).filter(
            Q(audience='everyone') |
            Q(audience='specific', specific_users=user) |
            Q(audience='students' if user.role == 'student' else 'none') |
            Q(audience='teachers' if user.role == 'teacher' else 'none') |
            Q(audience='parents' if user.role == 'parent' else 'none')
        ).distinct().order_by('-sent_at')[:20]

        # Get direct notifications (system-generated)
        notifications = Notification.objects.filter(
            recipient=user
        ).order_by('-created_at')[:20]

        # Combine both into a single list
        combined_list = []

        # Add announcements
        for announcement in announcements:
            combined_list.append({
                'id': f"announcement_{announcement.id}",
                'type': 'announcement',
                'title': announcement.title,
                'message': announcement.message,
                'priority': announcement.priority,
                'priority_display': announcement.get_priority_display(),
                'created_at': announcement.sent_at or announcement.created_at,
                'is_read': announcement.is_read_by(user),
                'created_by': announcement.created_by.get_full_name() if announcement.created_by else 'Admin',
                'notification_type': 'announcement'
            })

        # Add notifications
        for notification in notifications:
            combined_list.append({
                'id': f"notification_{notification.id}",
                'type': 'notification',
                'title': notification.title,
                'message': notification.message,
                'priority': notification.priority,
                'priority_display': notification.get_priority_display(),
                'created_at': notification.created_at,
                'is_read': notification.is_read,
                'created_by': 'System',
                'notification_type': notification.notification_type
            })

        # Sort by created_at, most recent first
        combined_list.sort(key=lambda x: x['created_at'], reverse=True)

        # Count unread
        unread_count = sum(1 for item in combined_list if not item['is_read'])

        return Response({
            'announcements': combined_list[:50],  # Return max 50
            'unread_count': unread_count
        })

    except Exception as e:
        print(f"Error in get_my_announcements: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return Response(
            {"detail": f"Error fetching announcements: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_announcement_as_read(request, announcement_id):
    """
    Mark an announcement as read by the current user
    """
    from schooladmin.models import Announcement

    user = request.user

    try:
        announcement = Announcement.objects.get(id=announcement_id)
        announcement.mark_as_read(user)

        return Response({
            'message': 'Announcement marked as read',
            'announcement_id': announcement_id
        })

    except Announcement.DoesNotExist:
        return Response(
            {'detail': 'Announcement not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error in mark_announcement_as_read: {str(e)}")
        return Response(
            {"detail": f"Error marking announcement as read: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# SESSION MANAGEMENT - MOVE TO NEW TERM/SESSION
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def move_to_next_term(request):
    """
    Move to the next term in the same academic year.
    Copies selected data (students, teachers, subjects, fees) to the new term.
    Does NOT copy: grades, results, attendance, calendar events.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # Get options from request
    copy_students = request.data.get('copy_students', True)
    copy_teachers = request.data.get('copy_teachers', True)
    copy_subjects = request.data.get('copy_subjects', True)
    copy_fees = request.data.get('copy_fees', True)
    copy_grading_config = request.data.get('copy_grading_config', True)

    try:
        with transaction.atomic():
            # Get current active grading configuration
            current_config = GradingConfiguration.objects.filter(is_active=True).first()

            if not current_config:
                return Response(
                    {"detail": "No active grading configuration found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            current_term = current_config.term
            current_year = current_config.academic_year

            # Determine next term
            term_order = ["First Term", "Second Term", "Third Term"]
            current_term_index = term_order.index(current_term)

            if current_term_index >= 2:  # Third Term
                return Response(
                    {"detail": "Cannot move to next term from Third Term. Use 'Move to New Session' instead."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            next_term = term_order[current_term_index + 1]

            # Check if next term config already exists
            existing_config = GradingConfiguration.objects.filter(
                academic_year=current_year,
                term=next_term
            ).first()

            if existing_config:
                return Response(
                    {"detail": f"Configuration for {next_term} {current_year} already exists"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create new grading configuration for next term
            # Copy percentage values from current config
            new_config = GradingConfiguration.objects.create(
                academic_year=current_year,
                term=next_term,
                attendance_percentage=current_config.attendance_percentage,
                assignment_percentage=current_config.assignment_percentage,
                test_percentage=current_config.test_percentage,
                exam_percentage=current_config.exam_percentage,
                grading_scale=current_config.grading_scale,
                created_by=request.user,
                is_active=False  # Will activate after copying
            )

            # Copy grade components from current config if requested
            if copy_grading_config:
                current_components = GradeComponent.objects.filter(grading_config=current_config)
                for component in current_components:
                    GradeComponent.objects.create(
                        grading_config=new_config,
                        component_type=component.component_type,
                        percentage_weight=component.percentage_weight,
                        max_score=component.max_score,
                        description=component.description
                    )

            # Get all current class sessions
            current_class_sessions = ClassSession.objects.filter(
                academic_year=current_year,
                term=current_term
            )

            class_mapping = {}  # Map old class session to new class session

            # Copy class sessions
            for old_class_session in current_class_sessions:
                new_class_session = ClassSession.objects.create(
                    classroom=old_class_session.classroom,
                    academic_year=current_year,
                    term=next_term
                )
                class_mapping[old_class_session.id] = new_class_session

                # Copy subjects if requested
                if copy_subjects:
                    old_subjects = Subject.objects.filter(class_session=old_class_session)
                    for old_subject in old_subjects:
                        Subject.objects.create(
                            name=old_subject.name,
                            class_session=new_class_session,
                            teacher=old_subject.teacher if copy_teachers else None,
                            department=old_subject.department
                        )

            # Copy student sessions if requested
            if copy_students:
                current_student_sessions = StudentSession.objects.filter(
                    class_session__academic_year=current_year,
                    class_session__term=current_term,
                    is_active=True
                )

                for old_student_session in current_student_sessions:
                    new_class_session = class_mapping.get(old_student_session.class_session.id)
                    if new_class_session:
                        StudentSession.objects.create(
                            student=old_student_session.student,
                            class_session=new_class_session,
                            is_active=True
                        )

            # Copy fee structure if requested
            if copy_fees:
                current_fees = FeeStructure.objects.filter(
                    academic_year=current_year,
                    term=current_term
                )

                for old_fee in current_fees:
                    # Create new fee structure for next term
                    new_fee = FeeStructure.objects.create(
                        name=old_fee.name,
                        amount=old_fee.amount,
                        academic_year=current_year,
                        term=next_term
                    )
                    # Copy the many-to-many classes relationship
                    new_fee.classes.set(old_fee.classes.all())

            # Deactivate current configuration and activate new one
            current_config.is_active = False
            current_config.save()

            new_config.is_active = True
            new_config.save()

            # Deactivate old student sessions
            StudentSession.objects.filter(
                class_session__academic_year=current_year,
                class_session__term=current_term
            ).update(is_active=False)

            return Response({
                "message": f"Successfully moved to {next_term} {current_year}",
                "new_term": next_term,
                "academic_year": current_year,
                "config_id": new_config.id
            }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Error moving to next term: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error moving to next term: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def move_to_next_session(request):
    """
    Move to the next academic year's first term.
    Only available when current term is Third Term.
    Promotes students to the next class (JSS1->JSS2, etc.) and graduates SSS3 students.
    """
    from django.contrib.auth import get_user_model
    from logs.models import Notification
    User = get_user_model()

    # Get options from request
    copy_students = request.data.get('copy_students', True)
    copy_teachers = request.data.get('copy_teachers', True)
    copy_subjects = request.data.get('copy_subjects', True)
    copy_fees = request.data.get('copy_fees', True)
    copy_grading_config = request.data.get('copy_grading_config', True)

    # Class progression mapping (JSS1 -> JSS2, etc.)
    CLASS_PROGRESSION = {
        'J.S.S.1': 'J.S.S.2',
        'J.S.S.2': 'J.S.S.3',
        'J.S.S.3': 'S.S.S.1',
        'S.S.S.1': 'S.S.S.2',
        'S.S.S.2': 'S.S.S.3',
        'S.S.S.3': 'GRADUATED'  # Special marker for graduating students
    }

    try:
        with transaction.atomic():
            # Get current active grading configuration
            current_config = GradingConfiguration.objects.filter(is_active=True).first()

            if not current_config:
                return Response(
                    {"detail": "No active grading configuration found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            current_term = current_config.term
            current_year = current_config.academic_year

            # Verify current term is Third Term
            if current_term != "Third Term":
                return Response(
                    {"detail": "Can only move to new session from Third Term"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Calculate next academic year (e.g., 2027/2028 -> 2028/2029)
            years = current_year.split('/')
            if len(years) != 2:
                return Response(
                    {"detail": "Invalid academic year format. Expected format: YYYY/YYYY"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            start_year = int(years[0]) + 1
            end_year = int(years[1]) + 1
            next_year = f"{start_year}/{end_year}"
            next_term = "First Term"

            # Check if next session config already exists
            existing_config = GradingConfiguration.objects.filter(
                academic_year=next_year,
                term=next_term
            ).first()

            if existing_config:
                return Response(
                    {"detail": f"Configuration for {next_term} {next_year} already exists"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Use copy_to_session method to create new grading configuration with all required fields
            if copy_grading_config:
                new_config = current_config.copy_to_session(next_year, next_term, request.user)
            else:
                # If not copying config, still need to create one with required fields
                # Use the current config values as defaults
                new_config = GradingConfiguration.objects.create(
                    academic_year=next_year,
                    term=next_term,
                    attendance_percentage=current_config.attendance_percentage,
                    assignment_percentage=current_config.assignment_percentage,
                    test_percentage=current_config.test_percentage,
                    exam_percentage=current_config.exam_percentage,
                    grading_scale=current_config.grading_scale,
                    created_by=request.user,
                    is_active=False
                )

            # Copy grade components from current config if requested
            if copy_grading_config:
                current_components = GradeComponent.objects.filter(grading_config=current_config)
                for component in current_components:
                    # Check if component already exists (might be created by copy_to_session)
                    if not GradeComponent.objects.filter(
                        grading_config=new_config,
                        component_type=component.component_type
                    ).exists():
                        GradeComponent.objects.create(
                            grading_config=new_config,
                            component_type=component.component_type,
                            percentage_weight=component.percentage_weight,
                            max_score=component.max_score,
                            description=component.description
                        )

            # Get all current class sessions
            current_class_sessions = ClassSession.objects.filter(
                academic_year=current_year,
                term=current_term
            )

            class_mapping = {}  # Map old class to promoted class session
            graduated_students = []  # Track graduating students

            # Copy class sessions and prepare for student promotion
            for old_class_session in current_class_sessions:
                # Create session for the SAME class (we'll promote students separately)
                new_class_session = ClassSession.objects.create(
                    classroom=old_class_session.classroom,
                    academic_year=next_year,
                    term=next_term
                )
                class_mapping[old_class_session.classroom.name] = new_class_session

                # Copy subjects if requested
                if copy_subjects:
                    old_subjects = Subject.objects.filter(class_session=old_class_session)
                    for old_subject in old_subjects:
                        Subject.objects.create(
                            name=old_subject.name,
                            class_session=new_class_session,
                            teacher=old_subject.teacher if copy_teachers else None,
                            department=old_subject.department
                        )

            # Promote students to next class if requested
            if copy_students:
                current_student_sessions = StudentSession.objects.filter(
                    class_session__academic_year=current_year,
                    class_session__term=current_term,
                    is_active=True
                )

                for old_student_session in current_student_sessions:
                    current_class_name = old_student_session.class_session.classroom.name
                    next_class_name = CLASS_PROGRESSION.get(current_class_name)

                    if next_class_name == 'GRADUATED':
                        # Mark SSS3 students as graduated
                        graduated_students.append(old_student_session.student)
                        # Deactivate their student session
                        old_student_session.is_active = False
                        old_student_session.save()
                    elif next_class_name and next_class_name in class_mapping:
                        # Promote to next class
                        promoted_class_session = class_mapping[next_class_name]
                        StudentSession.objects.create(
                            student=old_student_session.student,
                            class_session=promoted_class_session,
                            is_active=True
                        )
                        # Deactivate old session
                        old_student_session.is_active = False
                        old_student_session.save()
                    else:
                        # Class not in progression map or next class doesn't exist
                        # Keep student in same class (edge case)
                        if current_class_name in class_mapping:
                            same_class_session = class_mapping[current_class_name]
                            StudentSession.objects.create(
                                student=old_student_session.student,
                                class_session=same_class_session,
                                is_active=True
                            )
                            old_student_session.is_active = False
                            old_student_session.save()

            # Send graduation notifications to SSS3 students and their parents
            for student in graduated_students:
                # Create notification for student
                Notification.objects.create(
                    recipient=student,
                    notification_type='graduation',
                    priority='high',
                    title='Congratulations on Your Graduation!',
                    message=f'Dear {student.first_name} {student.last_name}, '
                            f'Congratulations on successfully completing your secondary education! '
                            f'You have graduated from {current_year}. We wish you all the best in your future endeavors. '
                            f'Your academic records will remain available for your reference.',
                    is_read=False,
                    is_popup_shown=False
                )

                # Create notification for parent(s) if they exist
                if hasattr(student, 'parents'):
                    parents = student.parents.all()
                    for parent in parents:
                        Notification.objects.create(
                            recipient=parent,
                            notification_type='graduation',
                            priority='high',
                            title=f'{student.first_name} {student.last_name} Has Graduated!',
                            message=f'Dear Parent, we are pleased to inform you that your child, '
                                    f'{student.first_name} {student.last_name}, has successfully graduated '
                                    f'from our institution in the {current_year} academic year. '
                                    f'Congratulations on this achievement! Their academic records remain accessible.',
                            is_read=False,
                            is_popup_shown=False
                        )

            # Copy fee structure if requested
            if copy_fees:
                current_fees = FeeStructure.objects.filter(
                    academic_year=current_year,
                    term=current_term
                )

                for old_fee in current_fees:
                    # Create new fee structure
                    new_fee = FeeStructure.objects.create(
                        name=old_fee.name,
                        amount=old_fee.amount,
                        academic_year=next_year,
                        term=next_term
                    )
                    # Copy the ManyToMany relationship with classes
                    new_fee.classes.set(old_fee.classes.all())

            # Deactivate current configuration and activate new one
            current_config.is_active = False
            current_config.save()

            new_config.is_active = True
            new_config.save()

            # Deactivate remaining old student sessions
            StudentSession.objects.filter(
                class_session__academic_year=current_year,
                class_session__term=current_term,
                is_active=True
            ).update(is_active=False)

            return Response({
                "message": f"Successfully moved to {next_term} {next_year}",
                "new_term": next_term,
                "academic_year": next_year,
                "config_id": new_config.id,
                "graduated_students_count": len(graduated_students),
                "graduated_students": [f"{s.first_name} {s.last_name}" for s in graduated_students]
            }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Error moving to next session: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error moving to next session: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def revert_to_previous_session(request):
    """
    Revert to the previous term/session by deleting the current one.
    This will delete all data created in the current session.
    """
    try:
        with transaction.atomic():
            # Get current active grading configuration
            current_config = GradingConfiguration.objects.filter(is_active=True).first()

            if not current_config:
                return Response(
                    {"detail": "No active grading configuration found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            current_term = current_config.term
            current_year = current_config.academic_year

            # Find previous configuration
            term_order = ["First Term", "Second Term", "Third Term"]
            current_term_index = term_order.index(current_term)

            previous_config = None
            previous_year = current_year

            if current_term_index > 0:
                # Previous term in same year
                previous_term = term_order[current_term_index - 1]
                previous_config = GradingConfiguration.objects.filter(
                    academic_year=current_year,
                    term=previous_term
                ).first()
            else:
                # First term - go to previous year's third term
                years = current_year.split('/')
                if len(years) == 2:
                    start_year = int(years[0]) - 1
                    end_year = int(years[1]) - 1
                    previous_year = f"{start_year}/{end_year}"
                    previous_config = GradingConfiguration.objects.filter(
                        academic_year=previous_year,
                        term="Third Term"
                    ).first()

            if not previous_config:
                return Response(
                    {"detail": "No previous configuration found to revert to"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Delete current session data
            # Delete class sessions (cascades to subjects)
            ClassSession.objects.filter(
                academic_year=current_year,
                term=current_term
            ).delete()

            # Delete student sessions
            StudentSession.objects.filter(
                class_session__academic_year=current_year,
                class_session__term=current_term
            ).delete()

            # Delete fee structures
            FeeStructure.objects.filter(
                academic_year=current_year,
                term=current_term
            ).delete()

            # Delete grade components for current config
            GradeComponent.objects.filter(grading_config=current_config).delete()

            # Delete current grading configuration
            current_config.delete()

            # Activate previous configuration
            previous_config.is_active = True
            previous_config.save()

            # Reactivate previous student sessions
            StudentSession.objects.filter(
                class_session__academic_year=previous_config.academic_year,
                class_session__term=previous_config.term
            ).update(is_active=True)

            return Response({
                "message": f"Successfully reverted to {previous_config.term} {previous_config.academic_year}",
                "term": previous_config.term,
                "academic_year": previous_config.academic_year,
                "config_id": previous_config.id
            }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Error reverting to previous session: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error reverting to previous session: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def get_current_session_info(request):
    """
    Get information about the current active session.
    Returns term, academic year, and whether next session button should be enabled.
    """
    try:
        current_config = GradingConfiguration.objects.filter(is_active=True).first()

        if not current_config:
            return Response({
                "configured": False,
                "current_term": None,
                "academic_year": None,
                "is_third_term": False,
                "can_move_to_next_term": False,
                "can_move_to_next_session": False,
                "can_revert": False,
                "message": "No active grading configuration found. Please create a session first."
            }, status=status.HTTP_200_OK)

        # Check if there's a previous session to revert to
        term_order = ["First Term", "Second Term", "Third Term"]
        current_term_index = term_order.index(current_config.term)

        can_revert = False
        if current_term_index > 0:
            # Check for previous term in same year
            previous_term = term_order[current_term_index - 1]
            can_revert = GradingConfiguration.objects.filter(
                academic_year=current_config.academic_year,
                term=previous_term
            ).exists()
        else:
            # Check for previous year's third term
            years = current_config.academic_year.split('/')
            if len(years) == 2:
                start_year = int(years[0]) - 1
                end_year = int(years[1]) - 1
                previous_year = f"{start_year}/{end_year}"
                can_revert = GradingConfiguration.objects.filter(
                    academic_year=previous_year,
                    term="Third Term"
                ).exists()

        return Response({
            "configured": True,
            "current_term": current_config.term,
            "academic_year": current_config.academic_year,
            "is_third_term": current_config.term == "Third Term",
            "can_move_to_next_term": current_config.term != "Third Term",
            "can_move_to_next_session": current_config.term == "Third Term",
            "can_revert": can_revert
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Error getting session info: {str(e)}")
        return Response(
            {"detail": f"Error getting session info: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_available_sessions(request):
    """
    Get all available academic sessions (year/term combinations) for historical filtering.
    Returns both active and inactive sessions to allow filtering by previous terms.
    """
    try:
        # Get all unique academic year and term combinations from ClassSession
        class_sessions = ClassSession.objects.values(
            'academic_year', 'term'
        ).distinct().order_by('-academic_year', 'term')

        # Get all grading configurations to include their is_active status
        grading_configs = GradingConfiguration.objects.all()
        config_map = {}
        for config in grading_configs:
            key = f"{config.academic_year}_{config.term}"
            config_map[key] = {
                'is_active': config.is_active,
                'config_id': config.id
            }

        sessions = []
        term_order = {"First Term": 1, "Second Term": 2, "Third Term": 3}

        for session in class_sessions:
            year = session['academic_year']
            term = session['term']
            key = f"{year}_{term}"
            config_info = config_map.get(key, {'is_active': False, 'config_id': None})

            sessions.append({
                'academic_year': year,
                'term': term,
                'term_order': term_order.get(term, 0),
                'display_name': f"{year} - {term}",
                'is_active': config_info['is_active'],
                'has_config': key in config_map,
                'config_id': config_info['config_id']
            })

        # Sort by academic year (descending) then by term order (ascending)
        sessions.sort(key=lambda x: (x['academic_year'], x['term_order']), reverse=True)

        # Get current active session
        active_config = GradingConfiguration.objects.filter(is_active=True).first()
        current_session = None
        if active_config:
            current_session = {
                'academic_year': active_config.academic_year,
                'term': active_config.term
            }

        return Response({
            'sessions': sessions,
            'current_session': current_session,
            'total_count': len(sessions)
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Error getting available sessions: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"detail": f"Error getting available sessions: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
