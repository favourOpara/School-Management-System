from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from django.db.models import Q
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


# Custom permission for teachers and admins
class IsTeacherOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['teacher', 'admin']


# FEE STRUCTURE VIEWS
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


# GRADING SYSTEM VIEWS
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


# GRADING-RELATED ATTENDANCE MANAGEMENT
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


# GRADE SUMMARY VIEWS
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
    
    from academics.models import Subject, StudentSession
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