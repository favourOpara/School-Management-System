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

            # Test scores (only released)
            'test_visible': test_visible,
            'test_count': len(test_scores),
            'test_average': round(avg_test_percentage, 2),
            'test_details': test_scores,

            # Exam scores (only released)
            'exam_visible': exam_visible,
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

    # Get all students in the class
    student_sessions = StudentSession.objects.filter(
        class_session=class_session,
        is_active=True
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
                    is_active=True
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

                # Count how many subjects have test assessments
                subjects_with_tests = 0
                for subject in subjects:
                    if Assessment.objects.filter(
                        subject=subject,
                        is_active=True,
                        is_released=True,
                        assessment_type__in=['test_1', 'test_2', 'mid_term']
                    ).exists():
                        subjects_with_tests += 1

                print(f"  Subjects with tests: {subjects_with_tests}")

                # If no tests are set up, mark all as 0% completion
                if subjects_with_tests == 0:
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

                # Count students who have completed tests for ALL their subjects that have tests
                students_completed = 0

                for student_session in student_sessions:
                    student = student_session.student

                    # Check if this student has completed tests for all subjects that have tests
                    completed_all_tests = True

                    for subject in subjects:
                        # Check if there are any test assessments for this subject
                        test_assessments = Assessment.objects.filter(
                            subject=subject,
                            is_active=True,
                            is_released=True,
                            assessment_type__in=['test_1', 'test_2', 'mid_term']
                        )

                        if test_assessments.exists():
                            # Check if student has submitted at least one test for this subject
                            has_submission = AssessmentSubmission.objects.filter(
                                student=student,
                                assessment__in=test_assessments
                            ).exists()

                            if not has_submission:
                                completed_all_tests = False
                                break

                    if completed_all_tests:
                        students_completed += 1

                completion_percentage = round((students_completed / total_students) * 100) if total_students > 0 else 0
                print(f"  Completed: {students_completed}/{total_students} ({completion_percentage}%)")

                class_stats.append({
                    'class_id': class_session.classroom.id,
                    'class_name': class_session.classroom.name,
                    'session_id': class_session.id,
                    'total_students': total_students,
                    'students_completed': students_completed,
                    'completion_percentage': completion_percentage,
                    'total_subjects': total_subjects,
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
    - has_tests (whether this subject has any test assessments)
    """
    try:
        class_session = ClassSession.objects.select_related('classroom').get(id=class_session_id)

        # Get all subjects for this class
        subjects = Subject.objects.filter(class_session=class_session)

        # Get total students in this class
        total_students = StudentSession.objects.filter(
            class_session=class_session,
            is_active=True
        ).count()

        subject_stats = []

        for subject in subjects:
            # Check if subject has test assessments
            test_assessments = Assessment.objects.filter(
                subject=subject,
                is_active=True,
                is_released=True,
                assessment_type__in=['test_1', 'test_2', 'mid_term']
            )

            has_tests = test_assessments.exists()
            students_completed = 0

            if has_tests:
                # Count students who submitted at least one test for this subject
                students_with_submissions = AssessmentSubmission.objects.filter(
                    assessment__in=test_assessments
                ).values_list('student', flat=True).distinct()
                students_completed = len(students_with_submissions)

            completion_percentage = round((students_completed / total_students) * 100) if total_students > 0 else 0

            subject_stats.append({
                'subject_id': subject.id,
                'subject_name': subject.name,
                'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'No teacher assigned',
                'total_students': total_students,
                'students_completed': students_completed,
                'completion_percentage': completion_percentage,
                'has_tests': has_tests,
                'test_count': test_assessments.count()
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

        # Get all students in this class
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session,
            is_active=True
        ).select_related('student').order_by('student__last_name', 'student__first_name')

        students_data = []

        for student_session in student_sessions:
            student = student_session.student
            test_scores = []

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
                        'submission_id': submission.id
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
                        'submission_id': None
                    })

            students_data.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'username': student.username,
                'test_scores': test_scores
            })

        return Response({
            'subject_id': subject.id,
            'subject_name': subject.name,
            'class_name': subject.class_session.classroom.name,
            'academic_year': subject.class_session.academic_year,
            'term': subject.class_session.term,
            'teacher_name': subject.teacher.get_full_name() if subject.teacher else 'No teacher assigned',
            'students': students_data,
            'assessments': [{
                'id': a.id,
                'type': a.assessment_type,
                'type_display': a.get_assessment_type_display(),
                'title': a.title,
                'total_marks': max_test_marks,  # Display max marks from grading config
                'is_released': a.is_released
            } for a in test_assessments],
            'max_test_marks': max_test_marks  # Send to frontend for validation
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
    Update a student's test score for a specific assessment.
    Creates a submission if one doesn't exist (for manual grading).
    SCALES score from /30 (frontend) to /3 (database storage).
    SYNCS with GradeSummary.test_score.

    Body:
    - student_id: ID of the student (required if no submission_id)
    - assessment_id: ID of the assessment (required if no submission_id)
    - submission_id: ID of the AssessmentSubmission (optional - will be used if exists)
    - score: New score value in SCALED format (/30) (required)
    """
    try:
        submission_id = request.data.get('submission_id')
        student_id = request.data.get('student_id')
        assessment_id = request.data.get('assessment_id')
        scaled_score = request.data.get('score')  # This comes as /30

        print(f"=== UPDATE TEST SCORE (SCALED) ===")
        print(f"Submission ID: {submission_id}")
        print(f"Student ID: {student_id}")
        print(f"Assessment ID: {assessment_id}")
        print(f"Scaled Score (from frontend): {scaled_score}")

        if scaled_score is None:
            return Response(
                {"detail": "score is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

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
                {"detail": "Either submission_id OR (student_id AND assessment_id) are required"},
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
            student_sessions = StudentSession.objects.filter(
                class_session=class_session,
                is_active=True
            ).select_related('student').order_by('student__last_name', 'student__first_name')

            class_name = classroom.name
        else:
            # No class_id provided - get all students for this academic year and term
            all_class_sessions = ClassSession.objects.filter(
                academic_year=academic_year,
                term=term
            )

            student_sessions = StudentSession.objects.filter(
                class_session__in=all_class_sessions,
                is_active=True
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

    # Custom grading scale for report sheet
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

    try:
        # Get student
        student = User.objects.get(id=student_id, role='student')

        # Get student's class session for this academic year and term
        student_session = StudentSession.objects.filter(
            student=student,
            class_session__academic_year=academic_year,
            class_session__term=term,
            is_active=True
        ).select_related('class_session__classroom').first()

        if not student_session:
            return Response(
                {"detail": f"Student not enrolled in {academic_year} - {term}"},
                status=status.HTTP_404_NOT_FOUND
            )

        class_session = student_session.class_session

        # Get grading configuration
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

                # 1st Test = Attendance + Assignment
                first_test_score = float(grade_summary.attendance_score) + float(grade_summary.assignment_score)

                # 2nd Test = Test score
                second_test_score = float(grade_summary.test_score)

                # Exam = Exam score
                exam_score = float(grade_summary.exam_score)

                # Total (should equal grade_summary.total_score)
                total_score = float(grade_summary.total_score)

                # Get report sheet grade
                letter_grade = get_report_grade(total_score)

                subjects_data.append({
                    'subject_name': subject.name,
                    'first_test_score': round(first_test_score, 2),  # Attendance + Assignment
                    'second_test_score': round(second_test_score, 2),  # Test
                    'exam_score': round(exam_score, 2),  # Exam
                    'total_score': round(total_score, 2),  # Total
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
            is_active=True
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

        # Student photo URL
        photo_url = None
        if hasattr(student, 'profile_picture') and student.profile_picture:
            photo_url = student.profile_picture.url

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
