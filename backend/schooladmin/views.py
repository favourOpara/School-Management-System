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
from academics.models import Subject, ClassSession, StudentSession, Class


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
        amt = float(amt)
    except ValueError:
        return Response({"detail": "amount_paid must be a number."},
                        status=status.HTTP_400_BAD_REQUEST)

    rec.amount_paid = amt
    rec.payment_status = 'PAID' if amt >= rec.fee_structure.amount else 'UNPAID'
    rec.save(update_fields=['amount_paid', 'payment_status'])

    serializer = StudentFeeRecordSerializer(rec)
    return Response(serializer.data, status=status.HTTP_200_OK)


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
        students = CustomUser.objects.filter(role='student', classroom__in=fee.classes.all())
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
                "academic_year": student.academic_year,
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
    queryset = GradingConfiguration.objects.filter(is_active=True).order_by('-academic_year', 'term')
    serializer_class = GradingConfigurationSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        academic_year = self.request.query_params.get('academic_year')
        term = self.request.query_params.get('term')
        
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
            is_active=True
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
    
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=class_session.academic_year,
            term=class_session.term,
            is_active=True
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": "No grading configuration found for this session. Please set up grading configuration first."},
            status=status.HTTP_404_NOT_FOUND
        )
    
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
        is_active=True
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
            'exam_score': float(grade_summary.exam_score),
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
    
    # Recalculate total score
    grade_summary.recalculate_total_score()
    grade_summary.save()
    
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
                grade_summary = GradeSummary.objects.select_related('grading_config').get(id=grade_summary_id)
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
                
            except GradeSummary.DoesNotExist:
                errors.append(f"Grade summary {grade_summary_id} not found")
            except Exception as e:
                errors.append(f"Error updating grade_summary {grade_summary_id}: {str(e)}")
    
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
        # Get grading configuration for this session
        grading_config = GradingConfiguration.objects.get(
            academic_year=academic_year,
            term=term,
            is_active=True
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": "No grading configuration found for this session. Please set up grading configuration first."},
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
            is_active=True
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
    
    # Get grading configuration
    try:
        grading_config = GradingConfiguration.objects.get(
            academic_year=class_session.academic_year,
            term=class_session.term,
            is_active=True
        )
    except GradingConfiguration.DoesNotExist:
        return Response(
            {"detail": "No grading configuration found for this session"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get all subjects for this class session
    subjects = Subject.objects.filter(class_session=class_session)
    
    # Get all students
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
        is_active=True
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
    from academics.models import StudentSession, Subject, AssignmentSubmission
    
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
            
            # Hide test and exam for now
            'test_visible': False,
            'exam_visible': False,
            
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
        'subjects': subjects_data,
        'total_subjects': len(subjects_data)
    })