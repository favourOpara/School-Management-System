from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.decorators import api_view, permission_classes
from django.db import transaction
from django.db.models import Q, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
import os

from .models import (
    Class, ClassSession, Subject, Topic, StudentSession, SubjectContent,
    StudentContentView, AssignmentSubmission, SubmissionFile,
    Assessment, Question, QuestionOption, MatchingPair, Department
)
from .serializers import (
    ClassSerializer, ClassSessionSerializer, SubjectSerializer, TopicSerializer,
    SubjectContentSerializer, SubjectContentCreateSerializer,
    AssignmentSerializer, NoteSerializer, AnnouncementSerializer,
    StudentContentViewSerializer, AssignmentSubmissionSerializer,
    StudentAssignmentListSerializer, CreateSubmissionSerializer,
    SubmissionFileSerializer, CreateAssessmentSerializer, AssessmentSerializer,
    AssessmentSubmissionSerializer as AssessmentSubmissionSerializerClass,
    DepartmentSerializer
)
from users.models import CustomUser


# ========================
# CUSTOM PERMISSIONS
# ========================

class IsTeacherRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'teacher'


class IsTeacherOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['teacher', 'admin']


# ========================
# DEPARTMENT MANAGEMENT VIEWS (ADMIN ONLY)
# ========================

class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAdminUser]


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def assign_classes_to_department(request, department_id):
    """
    Assign multiple classes to a department
    Expected payload: { "class_ids": [1, 2, 3] }
    """
    try:
        department = Department.objects.get(id=department_id)
    except Department.DoesNotExist:
        return Response(
            {"detail": "Department not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    class_ids = request.data.get('class_ids', [])

    if not isinstance(class_ids, list):
        return Response(
            {"detail": "class_ids must be a list"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get all classes
    classes = Class.objects.filter(id__in=class_ids)

    if classes.count() != len(class_ids):
        return Response(
            {"detail": "Some class IDs are invalid"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Assign classes to department
    for cls in classes:
        cls.department = department
        cls.save()

    return Response(
        {
            "detail": f"Successfully assigned {classes.count()} classes to {department.name}",
            "department": DepartmentSerializer(department).data
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def remove_class_from_department(request, class_id):
    """
    Remove a class from its department
    """
    try:
        cls = Class.objects.get(id=class_id)
    except Class.DoesNotExist:
        return Response(
            {"detail": "Class not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    cls.department = None
    cls.save()

    return Response(
        {"detail": f"Successfully removed {cls.name} from department"},
        status=status.HTTP_200_OK
    )


# ========================
# CLASS MANAGEMENT VIEWS (ADMIN ONLY)
# ========================

class ClassListCreateView(generics.ListCreateAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAdminUser]


class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# ========================
# CLASS SESSION MANAGEMENT VIEWS (ADMIN ONLY)
# ========================

class ClassSessionListCreateView(generics.ListCreateAPIView):
    queryset = ClassSession.objects.all()
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAdminUser]

    def create(self, request, *args, **kwargs):
        classroom_id = request.data.get('classroom')
        academic_year = request.data.get('academic_year')
        term = request.data.get('term')

        if ClassSession.objects.filter(
            classroom_id=classroom_id,
            academic_year=academic_year,
            term=term
        ).exists():
            return Response(
                {"detail": "Session with this class, academic year, and term already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().create(request, *args, **kwargs)


class ClassSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClassSession.objects.all()
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# ========================
# SUBJECT MANAGEMENT VIEWS
# ========================

class SubjectListCreateView(generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAdminUser]

    def create(self, request, *args, **kwargs):
        data = request.data

        # Handle list of subjects
        if isinstance(data, list):
            created = []
            errors = []

            for item in data:
                if item.get('department') == 'General':
                    existing = Subject.objects.filter(
                        name=item['name'],
                        class_session_id=item['class_session_id'],
                        department='General'
                    )
                    if existing.exists():
                        errors.append({'detail': f"{item['name']} (General) already exists for this session."})
                        continue

                serializer = self.get_serializer(data=item)
                if serializer.is_valid():
                    subject = serializer.save()
                    created.append(self.get_serializer(subject).data)
                else:
                    errors.append(serializer.errors)

            if errors:
                return Response(
                    {"created": created, "errors": errors},
                    status=status.HTTP_207_MULTI_STATUS
                )
            return Response(created, status=status.HTTP_201_CREATED)

        # Handle single subject
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        if data.get('department') == 'General':
            existing = Subject.objects.filter(
                name=data['name'],
                class_session_id=data['class_session_id'],
                department='General'
            )
            if existing.exists():
                return Response(
                    {"detail": f"{data['name']} (General) already exists for this session."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        subject = serializer.save()
        return Response(self.get_serializer(subject).data, status=status.HTTP_201_CREATED)


class SubjectListView(generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# ========================
# TEACHER SUBJECT VIEWS
# ========================

class TeacherAssignedSubjectsView(generics.ListAPIView):
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]

    def get_queryset(self):
        """Return only subjects assigned to the current teacher"""
        teacher = self.request.user
        return Subject.objects.filter(teacher=teacher).select_related(
            'class_session__classroom',
            'teacher'
        ).order_by('class_session__classroom__name', 'name')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Group subjects by classroom for better frontend organization
        subjects_by_class = {}
        for subject in queryset:
            classroom_name = subject.class_session.classroom.name if subject.class_session.classroom else 'No Classroom'
            classroom_key = f"{classroom_name} - {subject.class_session.academic_year} {subject.class_session.term}"
            
            if classroom_key not in subjects_by_class:
                subjects_by_class[classroom_key] = {
                    'classroom': classroom_name,
                    'academic_year': subject.class_session.academic_year,
                    'term': subject.class_session.term,
                    'class_session_id': subject.class_session.id,
                    'subjects': []
                }
            
            subjects_by_class[classroom_key]['subjects'].append({
                'id': subject.id,
                'name': subject.name,
                'department': subject.department,
                'class_session': subject.class_session.id
            })
        
        return Response({
            'message': f'Found {queryset.count()} subjects assigned to {request.user.first_name} {request.user.last_name}',
            'teacher_info': {
                'id': request.user.id,
                'name': f"{request.user.first_name} {request.user.last_name}",
                'username': request.user.username
            },
            'subjects_by_class': list(subjects_by_class.values())
        })


class TeacherSubjectStudentsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]

    def get(self, request, subject_id):
        try:
            subject = Subject.objects.select_related(
                'class_session__classroom',
                'teacher'
            ).get(id=subject_id, teacher=request.user)
        except Subject.DoesNotExist:
            return Response({
                'error': 'Subject not found or not assigned to you'
            }, status=status.HTTP_404_NOT_FOUND)

        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session,
            is_active=True
        ).select_related('student').order_by('student__first_name', 'student__last_name')

        students = []
        for student_session in student_sessions:
            student = student_session.student
            
            if (subject.class_session.classroom.name.startswith('S.S.S.') and 
                subject.department != 'General' and 
                student.department != subject.department):
                continue
            
            age = None
            if student.date_of_birth:
                from datetime import date
                today = date.today()
                age = today.year - student.date_of_birth.year - (
                    (today.month, today.day) < (student.date_of_birth.month, student.date_of_birth.day)
                )

            students.append({
                'id': student.id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'middle_name': student.middle_name,
                'full_name': f"{student.first_name} {student.last_name}",
                'username': student.username,
                'email': student.email,
                'gender': student.gender,
                'age': age,
                'date_of_birth': student.date_of_birth,
                'department': student.department,
            })

        return Response({
            'subject_info': {
                'id': subject.id,
                'name': subject.name,
                'department': subject.department,
                'classroom': subject.class_session.classroom.name if subject.class_session.classroom else None,
                'academic_year': subject.class_session.academic_year,
                'term': subject.class_session.term,
            },
            'teacher_info': {
                'id': request.user.id,
                'name': f"{request.user.first_name} {request.user.last_name}",
                'username': request.user.username
            },
            'students': students,
            'total_students': len(students)
        })


# ========================
# SUBJECT CONTENT MANAGEMENT VIEWS
# ========================

class SubjectContentCreateView(generics.CreateAPIView):
    serializer_class = SubjectContentCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        subject = serializer.validated_data['subject']
        user = self.request.user
        
        # Teachers can only create for subjects they teach, admins can create for any subject
        if user.role == 'teacher' and subject.teacher != user:
            raise PermissionDenied("You can only create content for subjects assigned to you.")
        
        serializer.save(created_by=user)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except PermissionDenied as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )


class TeacherSubjectContentView(generics.ListAPIView):
    serializer_class = SubjectContentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get_queryset(self):
        subject_id = self.kwargs['subject_id']
        user = self.request.user
        
        # Verify the teacher is assigned to this subject (or is admin)
        try:
            if user.role == 'admin':
                subject = Subject.objects.get(id=subject_id)
            else:
                subject = Subject.objects.get(id=subject_id, teacher=user)
        except Subject.DoesNotExist:
            return SubjectContent.objects.none()
        
        # Return ALL content for this subject (regardless of who created it)
        return SubjectContent.objects.filter(
            subject=subject,
            is_active=True
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        subject_id = self.kwargs['subject_id']
        user = request.user
        
        try:
            if user.role == 'admin':
                subject = Subject.objects.select_related('class_session__classroom').get(id=subject_id)
            else:
                subject = Subject.objects.select_related('class_session__classroom').get(
                    id=subject_id, teacher=user
                )
        except Subject.DoesNotExist:
            return Response({
                'error': 'Subject not found or not assigned to you'
            }, status=status.HTTP_404_NOT_FOUND)

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        content_by_type = {
            'assignments': [],
            'notes': [],
            'announcements': []
        }
        
        for content in serializer.data:
            content_type = content['content_type']
            if content_type == 'assignment':
                content_by_type['assignments'].append(content)
            elif content_type == 'note':
                content_by_type['notes'].append(content)
            elif content_type == 'announcement':
                content_by_type['announcements'].append(content)

        return Response({
            'subject_info': {
                'id': subject.id,
                'name': subject.name,
                'department': subject.department,
                'classroom': subject.class_session.classroom.name if subject.class_session.classroom else None,
                'academic_year': subject.class_session.academic_year,
                'term': subject.class_session.term,
            },
            'content_summary': {
                'total_content': len(serializer.data),
                'assignments_count': len(content_by_type['assignments']),
                'notes_count': len(content_by_type['notes']),
                'announcements_count': len(content_by_type['announcements']),
            },
            'content_by_type': content_by_type
        })


class TeacherContentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubjectContentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'admin':
            return SubjectContent.objects.all()
        
        # Teachers can access content from subjects they teach
        teacher_subjects = Subject.objects.filter(teacher=user)
        return SubjectContent.objects.filter(subject__in=teacher_subjects)

    def get_object(self):
        content_id = self.kwargs['content_id']
        user = self.request.user
        
        # Check if content exists
        try:
            content = SubjectContent.objects.select_related('subject__teacher').get(id=content_id)
        except SubjectContent.DoesNotExist:
            raise NotFound(f'Content with ID {content_id} does not exist')
        
        # Admins can access any content
        if user.role == 'admin':
            return content
        
        # Teachers can only access content from subjects they currently teach
        if content.subject.teacher != user:
            raise PermissionDenied(
                f'You do not have permission to modify this content. '
                f'This content belongs to {content.subject.name} which is currently assigned to '
                f'{content.subject.teacher.username if content.subject.teacher else "no teacher"}.'
            )
        
        return content


class SubjectContentListView(generics.ListAPIView):
    serializer_class = SubjectContentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        subject_id = self.kwargs['subject_id']
        return SubjectContent.objects.filter(
            subject_id=subject_id,
            is_active=True
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        subject_id = self.kwargs['subject_id']
        
        try:
            subject = Subject.objects.select_related(
                'class_session__classroom'
            ).get(id=subject_id)
        except Subject.DoesNotExist:
            return Response({
                'error': 'Subject not found'
            }, status=status.HTTP_404_NOT_FOUND)

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        content_by_type = {
            'assignments': [],
            'notes': [],
            'announcements': []
        }
        
        for content in serializer.data:
            content_type = content['content_type']
            if content_type == 'assignment':
                content_by_type['assignments'].append(content)
            elif content_type == 'note':
                content_by_type['notes'].append(content)
            elif content_type == 'announcement':
                content_by_type['announcements'].append(content)

        return Response({
            'subject_info': {
                'id': subject.id,
                'name': subject.name,
                'department': subject.department,
                'classroom': subject.class_session.classroom.name if subject.class_session.classroom else None,
                'academic_year': subject.class_session.academic_year,
                'term': subject.class_session.term,
                'teacher_name': f"{subject.teacher.first_name} {subject.teacher.last_name}" if subject.teacher else "Not Assigned"
            },
            'content_summary': {
                'total_content': len(serializer.data),
                'assignments_count': len(content_by_type['assignments']),
                'notes_count': len(content_by_type['notes']),
                'announcements_count': len(content_by_type['announcements']),
            },
            'content_by_type': content_by_type
        })


# ========================
# STUDENT ASSIGNMENT VIEWS
# ========================

class StudentAssignmentListView(generics.ListAPIView):
    """
    List all assignments for the logged-in student
    Shows assignments from all their enrolled subjects
    """
    serializer_class = StudentAssignmentListSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role != 'student':
            return SubjectContent.objects.none()
        
        # Get all class sessions the student is enrolled in
        student_sessions = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).values_list('class_session', flat=True)
        
        # Get all assignments from subjects in those class sessions
        queryset = SubjectContent.objects.filter(
            content_type='assignment',
            subject__class_session__in=student_sessions
        ).select_related(
            'subject',
            'subject__class_session',
            'subject__class_session__classroom',
            'subject__teacher'
        ).prefetch_related(
            'files',
            Prefetch(
                'submissions',
                queryset=AssignmentSubmission.objects.filter(student=user),
                to_attr='my_submissions'
            )
        ).order_by('-created_at')
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter == 'pending':
            # Assignments not yet submitted
            submitted_ids = AssignmentSubmission.objects.filter(
                student=user
            ).values_list('assignment_id', flat=True)
            queryset = queryset.exclude(id__in=submitted_ids)
        elif status_filter == 'submitted':
            # Assignments already submitted
            submitted_ids = AssignmentSubmission.objects.filter(
                student=user
            ).values_list('assignment_id', flat=True)
            queryset = queryset.filter(id__in=submitted_ids)
        elif status_filter == 'overdue':
            # Overdue assignments not submitted
            submitted_ids = AssignmentSubmission.objects.filter(
                student=user
            ).values_list('assignment_id', flat=True)
            queryset = queryset.filter(
                due_date__lt=timezone.now()
            ).exclude(id__in=submitted_ids)
        
        # Filter by subject if provided
        subject_id = self.request.query_params.get('subject')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        
        return queryset


class StudentAssignmentDetailView(generics.RetrieveAPIView):
    """
    Get detailed view of a specific assignment
    """
    serializer_class = StudentAssignmentListSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role != 'student':
            return SubjectContent.objects.none()
        
        # Get all class sessions the student is enrolled in
        student_sessions = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).values_list('class_session', flat=True)
        
        return SubjectContent.objects.filter(
            content_type='assignment',
            subject__class_session__in=student_sessions
        ).select_related(
            'subject',
            'subject__class_session',
            'subject__class_session__classroom',
            'subject__teacher'
        ).prefetch_related(
            'files',
            Prefetch(
                'submissions',
                queryset=AssignmentSubmission.objects.filter(student=user)
            )
        )


class SubmitAssignmentView(APIView):
    """
    Submit or update an assignment submission
    Handles file uploads
    Limited to 2 submissions: initial + 1 update
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if request.user.role != 'student':
            return Response(
                {'detail': 'Only students can submit assignments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validate basic data
        assignment_id = request.data.get('assignment_id')
        submission_text = request.data.get('submission_text', '')
        
        if not assignment_id:
            return Response(
                {'detail': 'assignment_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if assignment exists
        try:
            assignment = SubjectContent.objects.get(
                id=assignment_id,
                content_type='assignment'
            )
        except SubjectContent.DoesNotExist:
            return Response(
                {'detail': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if student is enrolled
        is_enrolled = StudentSession.objects.filter(
            student=request.user,
            class_session=assignment.subject.class_session,
            is_active=True
        ).exists()
        
        if not is_enrolled:
            return Response(
                {'detail': 'You are not enrolled in this subject'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already submitted
        existing_submission = AssignmentSubmission.objects.filter(
            student=request.user,
            assignment=assignment
        ).first()
        
        if existing_submission:
            # Check if student has exceeded submission limit
            if existing_submission.submission_count >= 2:
                return Response(
                    {'detail': 'You have reached the maximum number of submissions (2) for this assignment.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if already graded
            if existing_submission.status == 'graded':
                return Response(
                    {'detail': 'Cannot update a graded submission'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update existing submission
            submission = existing_submission
            submission.submission_text = submission_text
            submission.updated_at = timezone.now()
            submission.submission_count += 1  # Increment submission count
            submission.save()
            
            # Delete old files if new ones are being uploaded
            files = request.FILES.getlist('files')
            if files:
                submission.files.all().delete()
        else:
            # Create new submission
            submission = AssignmentSubmission.objects.create(
                student=request.user,
                assignment=assignment,
                submission_text=submission_text,
                status='submitted',
                submission_count=1  # First submission
            )
        
        # Handle file uploads
        files = request.FILES.getlist('files')
        allowed_extensions = ['.pdf', '.docx', '.png', '.jpeg', '.jpg', '.ppt', '.pptx', '.zip', '.csv', '.xlsx']
        max_file_size = 5 * 1024 * 1024  # 5MB in bytes
        
        for file in files:
            # Get file extension
            file_extension = os.path.splitext(file.name)[1].lower()
            
            # Validate file extension
            if file_extension not in allowed_extensions:
                submission.delete() if not existing_submission else None
                return Response(
                    {'detail': f'File type {file_extension} not allowed. Allowed types: {", ".join(allowed_extensions)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file size (max 5MB)
            if file.size > max_file_size:
                submission.delete() if not existing_submission else None
                file_size_mb = file.size / (1024 * 1024)
                return Response(
                    {'detail': f'File "{file.name}" is too large ({file_size_mb:.2f}MB). Maximum file size is 5MB.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create submission file
            SubmissionFile.objects.create(
                submission=submission,
                file=file,
                original_name=file.name,
                file_size=file.size
            )
        
        # Serialize and return response
        serializer = AssignmentSubmissionSerializer(
            submission,
            context={'request': request}
        )
        
        return Response(
            {
                'message': 'Assignment submitted successfully' if not existing_submission else f'Assignment updated successfully (Submission {submission.submission_count}/2)',
                'submission': serializer.data,
                'submissions_remaining': 2 - submission.submission_count
            },
            status=status.HTTP_201_CREATED if not existing_submission else status.HTTP_200_OK
        )


class StudentSubmissionDetailView(generics.RetrieveAPIView):
    """
    Get details of student's own submission
    """
    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'student':
            return AssignmentSubmission.objects.filter(
                student=user
            ).select_related(
                'assignment',
                'assignment__subject',
                'graded_by'
            ).prefetch_related('files')
        
        return AssignmentSubmission.objects.none()


class StudentSubmissionListView(generics.ListAPIView):
    """
    List all submissions by the logged-in student
    """
    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role != 'student':
            return AssignmentSubmission.objects.none()
        
        queryset = AssignmentSubmission.objects.filter(
            student=user
        ).select_related(
            'assignment',
            'assignment__subject',
            'graded_by'
        ).prefetch_related('files').order_by('-submitted_at')
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by subject if provided
        subject_id = self.request.query_params.get('subject')
        if subject_id:
            queryset = queryset.filter(assignment__subject_id=subject_id)
        
        return queryset


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_submission(request, submission_id):
    """
    Allow students to delete their own submissions (before grading)
    """
    if request.user.role != 'student':
        return Response(
            {'detail': 'Only students can delete their submissions'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        submission = AssignmentSubmission.objects.get(
            id=submission_id,
            student=request.user
        )
    except AssignmentSubmission.DoesNotExist:
        return Response(
            {'detail': 'Submission not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Don't allow deletion if already graded
    if submission.status == 'graded':
        return Response(
            {'detail': 'Cannot delete a graded submission'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    submission.delete()
    
    return Response(
        {'message': 'Submission deleted successfully'},
        status=status.HTTP_200_OK
    )


# ========================
# TEACHER SUBMISSION VIEWS (NEW)
# ========================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_student_submissions(request, student_id):
    """
    Get all assignment submissions for a specific student
    Teachers can only see submissions for subjects they teach
    """
    user = request.user
    
    # Verify user is a teacher or admin
    if user.role not in ['teacher', 'admin']:
        return Response(
            {"detail": "Only teachers and admins can view student submissions"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        student = CustomUser.objects.get(id=student_id, role='student')
    except CustomUser.DoesNotExist:
        return Response(
            {"detail": "Student not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get all submissions for this student
    submissions = AssignmentSubmission.objects.filter(student=student).select_related(
        'assignment', 
        'assignment__subject',
        'assignment__subject__class_session',
        'graded_by'
    ).prefetch_related('files')
    
    # Filter by teacher's subjects if not admin
    if user.role == 'teacher':
        teacher_subjects = Subject.objects.filter(teacher=user).values_list('id', flat=True)
        submissions = submissions.filter(assignment__subject_id__in=teacher_subjects)
    
    # Serialize submissions
    submissions_data = []
    for submission in submissions:
        assignment = submission.assignment
        subject = assignment.subject
        
        submissions_data.append({
            'id': submission.id,
            'assignment': {
                'id': assignment.id,
                'title': assignment.title,
                'description': assignment.description,
                'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
                'max_score': assignment.max_score,
            },
            'subject': {
                'id': subject.id,
                'name': subject.name,
                'class': subject.class_session.classroom.name,
                'academic_year': subject.class_session.academic_year,
                'term': subject.class_session.term,
            },
            'submission_text': submission.submission_text,
            'submitted_at': submission.submitted_at.isoformat(),
            'updated_at': submission.updated_at.isoformat(),
            'status': submission.status,
            'is_late': submission.is_late,
            'submission_count': submission.submission_count,
            'score': float(submission.score) if submission.score else None,
            'feedback': submission.feedback,
            'graded_by': submission.graded_by.get_full_name() if submission.graded_by else None,
            'graded_at': submission.graded_at.isoformat() if submission.graded_at else None,
            'grade_released': submission.grade_released,
            'can_resubmit': submission.can_resubmit,
            'files': [
                {
                    'id': file.id,
                    'original_name': file.original_name,
                    'file_url': file.file.url if file.file else None,
                    'file_size': file.formatted_file_size,
                    'file_extension': file.file_extension,
                    'uploaded_at': file.uploaded_at.isoformat(),
                }
                for file in submission.files.all()
            ]
        })
    
    return Response({
        'student': {
            'id': student.id,
            'username': student.username,
            'full_name': student.get_full_name(),
            'email': student.email,
        },
        'submissions': submissions_data,
        'total_submissions': len(submissions_data),
    })


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def grade_submission(request, submission_id):
    """
    Grade an assignment submission
    Only the teacher assigned to the subject can grade
    """
    user = request.user
    
    # Verify user is a teacher or admin
    if user.role not in ['teacher', 'admin']:
        return Response(
            {"detail": "Only teachers and admins can grade submissions"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        submission = AssignmentSubmission.objects.select_related(
            'assignment',
            'assignment__subject',
            'student'
        ).get(id=submission_id)
    except AssignmentSubmission.DoesNotExist:
        return Response(
            {"detail": "Submission not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if teacher is assigned to this subject
    if user.role == 'teacher' and submission.assignment.subject.teacher != user:
        return Response(
            {"detail": "You can only grade submissions for subjects you teach"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get grading data
    score = request.data.get('score')
    feedback = request.data.get('feedback', '')
    grade_released = request.data.get('grade_released', False)
    
    # Validate score
    if score is not None:
        try:
            score = float(score)
            max_score = submission.assignment.max_score
            
            if max_score and score > max_score:
                return Response(
                    {"detail": f"Score cannot exceed maximum score of {max_score}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if score < 0:
                return Response(
                    {"detail": "Score cannot be negative"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {"detail": "Invalid score format"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Update submission
    submission.score = score
    submission.feedback = feedback
    submission.graded_by = user
    submission.graded_at = timezone.now()
    submission.status = 'graded'
    submission.grade_released = grade_released
    submission.save()
    
    return Response({
        'message': 'Submission graded successfully',
        'submission': {
            'id': submission.id,
            'student': submission.student.get_full_name(),
            'assignment': submission.assignment.title,
            'score': float(submission.score) if submission.score else None,
            'max_score': submission.assignment.max_score,
            'feedback': submission.feedback,
            'graded_by': user.get_full_name(),
            'graded_at': submission.graded_at.isoformat(),
            'status': submission.status,
            'grade_released': submission.grade_released,
        }
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def release_grade(request, submission_id):
    """
    Release grade to student (admin approval)
    """
    user = request.user
    
    if user.role not in ['teacher', 'admin']:
        return Response(
            {"detail": "Only teachers and admins can release grades"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        submission = AssignmentSubmission.objects.get(id=submission_id)
    except AssignmentSubmission.DoesNotExist:
        return Response(
            {"detail": "Submission not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if submission.status != 'graded':
        return Response(
            {"detail": "Submission must be graded before releasing"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    submission.grade_released = True
    submission.save()
    
    return Response({
        'message': 'Grade released to student',
        'submission_id': submission.id,
        'grade_released': submission.grade_released
    })


# ========================
# SESSION INHERITANCE & UTILITIES
# ========================

class SessionInheritanceView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @staticmethod
    def get_next_class(current_class_name):
        """Maps current class to next class for promotion"""
        promotion_map = {
            'J.S.S.1': 'J.S.S.2',
            'J.S.S.2': 'J.S.S.3',
            'J.S.S.3': 'S.S.S.1',
            'S.S.S.1': 'S.S.S.2',
            'S.S.S.2': 'S.S.S.3',
            'S.S.S.3': None  # Graduated
        }
        return promotion_map.get(current_class_name)

    def post(self, request):
        data = request.data
        source_academic_year = data.get('source_academic_year')
        source_term = data.get('source_term')
        target_academic_year = data.get('target_academic_year')
        target_term = data.get('target_term')
        copy_students = data.get('copy_students', False)
        copy_subjects = data.get('copy_subjects', False)
        promote_students = data.get('promote_students', False)

        if not all([source_academic_year, source_term, target_academic_year, target_term]):
            return Response(
                {"detail": "source_academic_year, source_term, target_academic_year, and target_term are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not (copy_students or copy_subjects):
            return Response(
                {"detail": "At least one of 'copy_students' or 'copy_subjects' must be True."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if promote_students and source_term != "Third Term":
            return Response(
                {"detail": "Students can only be promoted after Third Term."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if promote_students and not copy_students:
            return Response(
                {"detail": "copy_students must be True when promote_students is enabled."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                source_sessions = ClassSession.objects.filter(
                    academic_year=source_academic_year,
                    term=source_term
                )

                target_sessions = ClassSession.objects.filter(
                    academic_year=target_academic_year,
                    term=target_term
                )

                if not source_sessions.exists():
                    return Response(
                        {"detail": f"No source sessions found for {source_academic_year} - {source_term}"},
                        status=status.HTTP_404_NOT_FOUND
                    )

                if not target_sessions.exists():
                    return Response(
                        {"detail": f"No target sessions found for {target_academic_year} - {target_term}"},
                        status=status.HTTP_404_NOT_FOUND
                    )

                copied_students = 0
                promoted_students = 0
                graduated_students = 0
                copied_subjects = 0

                if copy_students:
                    source_student_sessions = StudentSession.objects.filter(
                        class_session__academic_year=source_academic_year,
                        class_session__term=source_term,
                        is_active=True
                    ).select_related('student', 'class_session__classroom')

                    for source_student_session in source_student_sessions:
                        student = source_student_session.student
                        source_class_session = source_student_session.class_session
                        current_class_name = source_class_session.classroom.name

                        if promote_students:
                            # Get the next class for promotion
                            next_class_name = self.get_next_class(current_class_name)

                            if next_class_name is None:
                                # S.S.S.3 students - mark as graduated
                                graduated_students += 1
                                source_student_session.is_active = False
                                source_student_session.save()
                                continue

                            # Find target session with promoted class
                            try:
                                target_classroom = Class.objects.get(name=next_class_name)
                                target_class_session = target_sessions.filter(
                                    classroom=target_classroom
                                ).first()
                            except Class.DoesNotExist:
                                # Next class doesn't exist, skip this student
                                continue
                        else:
                            # Keep same class
                            target_class_session = target_sessions.filter(
                                classroom=source_class_session.classroom
                            ).first()

                        if target_class_session:
                            new_student_session, created = StudentSession.objects.get_or_create(
                                student=student,
                                class_session=target_class_session,
                                defaults={'is_active': True}
                            )

                            if created:
                                if promote_students:
                                    promoted_students += 1
                                else:
                                    copied_students += 1
                                source_student_session.is_active = False
                                source_student_session.save()

                if copy_subjects:
                    for source_session in source_sessions:
                        target_session = target_sessions.filter(
                            classroom=source_session.classroom
                        ).first()

                        if target_session:
                            source_subjects = source_session.subjects.all()
                            for source_subject in source_subjects:
                                if not target_session.subjects.filter(
                                    name=source_subject.name,
                                    department=source_subject.department
                                ).exists():
                                    Subject.objects.create(
                                        name=source_subject.name,
                                        class_session=target_session,
                                        teacher=source_subject.teacher,
                                        department=source_subject.department
                                    )
                                    copied_subjects += 1

                message = "Data migrated successfully"
                if promote_students:
                    message = f"Students promoted successfully. {promoted_students} promoted, {graduated_students} graduated."

                response_details = {
                    "students_copied": copied_students,
                    "students_promoted": promoted_students if promote_students else 0,
                    "students_graduated": graduated_students if promote_students else 0,
                    "subjects_copied": copied_subjects,
                    "note": "Students retain their original usernames and personal data. Historical data is preserved in previous StudentSession records."
                }

                return Response({
                    "message": message,
                    "details": response_details
                }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"detail": f"Error copying data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SessionStudentsView(APIView):
    permission_classes = [permissions.IsAdminUser]
    
    def get(self, request, session_id):
        try:
            session = ClassSession.objects.get(id=session_id)
            # Remove is_active filter to show historical students
            student_sessions = StudentSession.objects.filter(
                class_session=session
            ).select_related('student').order_by('student__first_name', 'student__last_name')

            students = [
                {
                    'id': ss.student.id,
                    'first_name': ss.student.first_name,
                    'last_name': ss.student.last_name,
                    'username': ss.student.username,
                    'department': getattr(ss.student, 'department', None)
                }
                for ss in student_sessions
            ]

            return Response(students)
        except ClassSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)


# ========================
# TOPIC MANAGEMENT VIEWS
# ========================

class TopicListCreateView(generics.ListCreateAPIView):
    """
    List all topics or create a new topic
    GET/POST /api/academics/topics/
    """
    serializer_class = TopicSerializer
    permission_classes = [IsTeacherOrAdmin]

    def get_queryset(self):
        """Filter topics by subject if provided"""
        queryset = Topic.objects.filter(is_active=True)
        subject_id = self.request.query_params.get('subject_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        return queryset.order_by('subject', 'order', 'name')


class TopicDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a topic
    GET/PUT/DELETE /api/academics/topics/<id>/
    """
    queryset = Topic.objects.filter(is_active=True)
    serializer_class = TopicSerializer
    permission_classes = [IsTeacherOrAdmin]


# ========================
# ASSESSMENT VIEWS (TESTS & EXAMS)
# ========================

class CreateAssessmentView(APIView):
    """
    API view for teachers to create tests and exams
    POST /api/academics/teacher/create-assessment/
    """
    permission_classes = [IsTeacherOrAdmin]

    def post(self, request):
        """Create a new assessment with questions"""
        import json

        # Check if request contains multipart data (with images)
        if 'data' in request.data:
            # FormData was sent - parse the JSON from 'data' field
            try:
                data = json.loads(request.data['data'])
            except (ValueError, KeyError) as e:
                return Response(
                    {"detail": "Invalid data format."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Regular JSON request
            data = request.data

        serializer = CreateAssessmentSerializer(
            data=data,
            context={'request': request}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Verify teacher is assigned to this subject
        subject_id = serializer.validated_data['subject_id']
        try:
            subject = Subject.objects.get(id=subject_id)

            # Check if teacher is assigned to this subject
            if request.user.role == 'teacher':
                if subject.teacher != request.user:
                    return Response(
                        {"detail": "You are not assigned to this subject."},
                        status=status.HTTP_403_FORBIDDEN
                    )

            # Create the assessment
            assessment = serializer.save()

            # Handle image uploads if present (from FormData)
            if 'data' in request.data:
                # Process images for questions
                for key, file in request.FILES.items():
                    if key.startswith('image_'):
                        # Extract question number from key (e.g., 'image_1' -> 1)
                        try:
                            question_num = int(key.split('_')[1])
                            # Get the corresponding question (1-indexed)
                            question = assessment.questions.all()[question_num - 1]
                            question.image = file
                            question.save()
                        except (IndexError, ValueError, Question.DoesNotExist):
                            # Skip invalid image keys
                            pass

            # Return the created assessment with full details
            response_serializer = AssessmentSerializer(assessment, context={'request': request})
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )

        except Subject.DoesNotExist:
            return Response(
                {"detail": "Subject not found."},
                status=status.HTTP_404_NOT_FOUND
            )


class TeacherAssessmentListView(APIView):
    """
    Get all assessments created by the logged-in teacher
    GET /api/academics/teacher/assessments/
    """
    permission_classes = [IsTeacherRole]

    def get(self, request):
        """List all assessments created by this teacher"""
        assessments = Assessment.objects.filter(
            created_by=request.user,
            is_active=True
        ).select_related(
            'subject',
            'subject__class_session',
            'subject__class_session__classroom'
        ).prefetch_related('questions').order_by('-assessment_date')

        serializer = AssessmentSerializer(assessments, many=True)
        return Response(serializer.data)


class AssessmentDetailView(APIView):
    """
    Get, update, or delete a specific assessment
    GET/PUT/DELETE /api/academics/teacher/assessments/<id>/
    """
    permission_classes = [IsTeacherOrAdmin]

    def get_object(self, pk, user):
        """Get assessment and verify permissions"""
        try:
            assessment = Assessment.objects.select_related(
                'subject',
                'subject__class_session',
                'subject__class_session__classroom',
                'created_by'
            ).prefetch_related('questions').get(pk=pk)

            # Check if user has permission to access this assessment
            if user.role == 'teacher' and assessment.created_by != user:
                raise PermissionDenied("You do not have permission to access this assessment.")

            return assessment
        except Assessment.DoesNotExist:
            raise NotFound("Assessment not found.")

    def get(self, request, pk):
        """Get assessment details"""
        assessment = self.get_object(pk, request.user)
        serializer = AssessmentSerializer(assessment)
        return Response(serializer.data)

    def delete(self, request, pk):
        """Delete an assessment (soft delete)"""
        assessment = self.get_object(pk, request.user)
        assessment.is_active = False
        assessment.save()
        return Response(
            {"detail": "Assessment deleted successfully."},
            status=status.HTTP_204_NO_CONTENT
        )


class QuestionUpdateView(APIView):
    """
    Update a specific question
    PATCH /api/academics/questions/<id>/
    """
    permission_classes = [IsTeacherOrAdmin]

    def get_object(self, pk, user):
        """Get question and verify permissions"""
        try:
            question = Question.objects.select_related(
                'assessment',
                'assessment__created_by'
            ).prefetch_related('options', 'matching_pairs').get(pk=pk)

            # Check if user has permission to edit this question
            if user.role == 'teacher' and question.assessment.created_by != user:
                raise PermissionDenied("You do not have permission to edit this question.")

            return question
        except Question.DoesNotExist:
            raise NotFound("Question not found.")

    def patch(self, request, pk):
        """Update question details"""
        import json

        question = self.get_object(pk, request.user)

        # Check if request contains FormData (with images)
        if 'data' in request.data:
            # FormData was sent - parse the JSON from 'data' field
            try:
                data = json.loads(request.data['data'])
            except (ValueError, KeyError) as e:
                return Response(
                    {"detail": "Invalid data format."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Regular JSON request
            data = request.data

        # Get update data
        question_text = data.get('question_text')
        marks = data.get('marks')
        correct_answer = data.get('correct_answer')
        options = data.get('options')
        matching_pairs = data.get('matching_pairs')

        # Update basic fields
        if question_text is not None:
            question.question_text = question_text

        if marks is not None:
            try:
                marks = float(marks)
                if marks < 0:
                    return Response(
                        {"detail": "Marks cannot be negative"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                question.marks = marks
            except ValueError:
                return Response(
                    {"detail": "Invalid marks format"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if correct_answer is not None:
            question.correct_answer = correct_answer

        # Handle image deletion
        if 'data' in request.data and request.data.get('delete_image') == 'true':
            if question.image:
                question.image.delete()
                question.image = None

        # Handle new image upload
        if 'image' in request.FILES:
            # Delete old image if exists
            if question.image:
                question.image.delete()

            new_image = request.FILES['image']

            # Validate file size (100KB = 102400 bytes)
            if new_image.size > 102400:
                return Response(
                    {"detail": "Image file size cannot exceed 100KB."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            question.image = new_image

        question.save()

        # Update options for multiple choice questions
        if options is not None and question.question_type == 'multiple_choice':
            # Get existing options
            existing_options = list(question.options.all().order_by('option_label'))

            # Update each option in place
            for i, opt in enumerate(options):
                if i < len(existing_options):
                    # Update existing option
                    existing_option = existing_options[i]
                    existing_option.option_text = opt.get('text', opt.get('option_text', ''))
                    existing_option.is_correct = opt.get('is_correct', False)
                    existing_option.save()
                else:
                    # Create new option if we have more options than before
                    QuestionOption.objects.create(
                        question=question,
                        option_text=opt.get('text', opt.get('option_text', '')),
                        option_label=opt.get('option_label', chr(65 + i)),  # A, B, C, etc.
                        is_correct=opt.get('is_correct', False),
                        order=i
                    )

            # Delete extra options if we have fewer options now
            if len(options) < len(existing_options):
                for option in existing_options[len(options):]:
                    option.delete()

        # Update matching pairs for matching questions
        if matching_pairs is not None and question.question_type == 'matching':
            # Get existing pairs
            existing_pairs = list(question.matching_pairs.all().order_by('pair_number'))

            # Update each pair in place
            for i, pair in enumerate(matching_pairs):
                if i < len(existing_pairs):
                    # Update existing pair
                    existing_pair = existing_pairs[i]
                    existing_pair.left_item = pair.get('left', pair.get('left_item', ''))
                    existing_pair.right_item = pair.get('right', pair.get('right_item', ''))
                    existing_pair.save()
                else:
                    # Create new pair if we have more pairs than before
                    MatchingPair.objects.create(
                        question=question,
                        left_item=pair.get('left', pair.get('left_item', '')),
                        right_item=pair.get('right', pair.get('right_item', '')),
                        pair_number=i + 1
                    )

            # Delete extra pairs if we have fewer pairs now
            if len(matching_pairs) < len(existing_pairs):
                for pair in existing_pairs[len(matching_pairs):]:
                    pair.delete()

        # Refresh question to get updated related objects
        question.refresh_from_db()

        # Prepare response data
        response_data = {
            'id': question.id,
            'question_text': question.question_text,
            'question_type': question.question_type,
            'marks': float(question.marks),
            'correct_answer': question.correct_answer,
            'image_url': question.image.url if question.image else None
        }

        # Add options if multiple choice
        if question.question_type == 'multiple_choice':
            response_data['options'] = [
                {
                    'id': opt.id,
                    'text': opt.option_text,
                    'is_correct': opt.is_correct
                }
                for opt in question.options.all()
            ]

        # Add matching pairs if matching
        if question.question_type == 'matching':
            response_data['matching_pairs'] = [
                {
                    'id': pair.id,
                    'left': pair.left_item,
                    'right': pair.right_item
                }
                for pair in question.matching_pairs.all()
            ]

        return Response(
            {
                'message': 'Question updated successfully',
                'question': response_data
            },
            status=status.HTTP_200_OK
        )


# ========================
# ADMIN ASSESSMENT REVIEW VIEWS
# ========================

class AdminAssessmentListView(APIView):
    """
    Get all assessments for admin review with filtering
    GET /api/academics/admin/assessments/
    Query params: academic_year, term, subject_id
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        """List all assessments with optional filters"""
        assessments = Assessment.objects.filter(
            is_active=True
        ).select_related(
            'subject',
            'subject__class_session',
            'subject__class_session__classroom',
            'created_by'
        ).prefetch_related('questions').order_by('-created_at')

        # Apply filters
        academic_year = request.query_params.get('academic_year')
        term = request.query_params.get('term')
        subject_id = request.query_params.get('subject_id')

        if academic_year:
            assessments = assessments.filter(
                subject__class_session__academic_year=academic_year
            )

        if term:
            assessments = assessments.filter(
                subject__class_session__term=term
            )

        if subject_id:
            assessments = assessments.filter(subject_id=subject_id)

        serializer = AssessmentSerializer(assessments, many=True)
        return Response({
            'assessments': serializer.data,
            'count': assessments.count()
        })


class AdminDeleteAssessmentView(APIView):
    """
    Delete an assessment (admin only)
    DELETE /api/academics/admin/assessments/<id>/delete/
    """
    permission_classes = [permissions.IsAdminUser]

    def delete(self, request, pk):
        """Delete assessment permanently"""
        try:
            assessment = Assessment.objects.get(pk=pk)

            # Store info for response message
            assessment_title = assessment.title
            assessment_type = assessment.get_assessment_type_display()

            # Delete the assessment (cascade will delete related questions, options, etc.)
            assessment.delete()

            return Response({
                'message': f'{assessment_type} "{assessment_title}" deleted successfully',
                'assessment_id': pk
            }, status=status.HTTP_200_OK)

        except Assessment.DoesNotExist:
            raise NotFound("Assessment not found.")


class ToggleAssessmentReleaseView(APIView):
    """
    Toggle release status of a single assessment
    POST /api/academics/admin/assessments/<id>/toggle-release/
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        """Toggle release status"""
        try:
            assessment = Assessment.objects.get(pk=pk, is_active=True)
            assessment.is_released = not assessment.is_released
            assessment.save()

            return Response({
                'message': f"Assessment {'released' if assessment.is_released else 'locked'}",
                'assessment_id': assessment.id,
                'is_released': assessment.is_released
            })
        except Assessment.DoesNotExist:
            raise NotFound("Assessment not found.")


class UnlockAllAssessmentsView(APIView):
    """
    Unlock all assessments (with optional filters)
    POST /api/academics/admin/assessments/unlock-all/
    Body: academic_year (optional), term (optional), subject_id (optional), assessment_type (optional: 'test' or 'exam')
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        """Unlock all assessments matching filters"""
        from django.db.models import Q

        assessments = Assessment.objects.filter(
            is_active=True,
            is_released=False
        )

        # Apply filters if provided
        academic_year = request.data.get('academic_year')
        term = request.data.get('term')
        subject_id = request.data.get('subject_id')
        assessment_type = request.data.get('assessment_type')  # 'test' or 'exam'

        if academic_year:
            assessments = assessments.filter(
                subject__class_session__academic_year=academic_year
            )

        if term:
            assessments = assessments.filter(
                subject__class_session__term=term
            )

        if subject_id:
            assessments = assessments.filter(subject_id=subject_id)

        # Filter by assessment type (test includes test_1, test_2, mid_term; exam is final_exam)
        if assessment_type == 'test':
            assessments = assessments.filter(
                Q(assessment_type='test_1') |
                Q(assessment_type='test_2') |
                Q(assessment_type='mid_term')
            )
        elif assessment_type == 'exam':
            assessments = assessments.filter(assessment_type='final_exam')

        count = assessments.count()
        assessments.update(is_released=True)

        return Response({
            'message': f'Successfully unlocked {count} assessment(s)',
            'count': count
        })


# ========================
# STUDENT ASSESSMENT VIEWS
# ========================

class StudentAvailableAssessmentsView(APIView):
    """
    Get all released assessments for the logged-in student
    GET /api/academics/student/assessments/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List all released assessments for student's enrolled subjects"""
        from .models import StudentSession, AssessmentSubmission
        from django.db.models import Exists, OuterRef

        user = request.user

        if user.role != 'student':
            return Response(
                {"detail": "Only students can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get all class sessions the student is enrolled in
        student_sessions = StudentSession.objects.filter(
            student=user,
            is_active=True
        ).values_list('class_session', flat=True)

        # Subquery to check if student has already submitted this assessment
        submitted_assessments = AssessmentSubmission.objects.filter(
            assessment=OuterRef('pk'),
            student=user
        )

        # Get all released assessments from subjects in those class sessions
        # Exclude assessments that the student has already submitted
        assessments = Assessment.objects.filter(
            is_active=True,
            is_released=True,
            subject__class_session__in=student_sessions
        ).exclude(
            Exists(submitted_assessments)
        ).select_related(
            'subject',
            'subject__class_session',
            'subject__class_session__classroom'
        ).prefetch_related('questions').order_by('-created_at')

        serializer = AssessmentSerializer(assessments, many=True)
        return Response({
            'assessments': serializer.data,
            'count': assessments.count()
        })


class StudentSubmitAssessmentView(APIView):
    """
    Submit assessment answers
    POST /api/academics/student/assessments/<pk>/submit/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        """Submit student's answers for an assessment"""
        from .models import (
            StudentSession, AssessmentSubmission, StudentAnswer,
            Question, QuestionOption, MatchingPair
        )
        from decimal import Decimal
        import json

        user = request.user

        if user.role != 'student':
            return Response(
                {"detail": "Only students can submit assessments"},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            # Get the assessment
            assessment = Assessment.objects.prefetch_related(
                'questions__options',
                'questions__matching_pairs'
            ).get(pk=pk, is_active=True, is_released=True)
        except Assessment.DoesNotExist:
            return Response(
                {"detail": "Assessment not found or not available"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if student is enrolled in the subject
        student_sessions = StudentSession.objects.filter(
            student=user,
            is_active=True,
            class_session=assessment.subject.class_session
        )

        if not student_sessions.exists():
            return Response(
                {"detail": "You are not enrolled in this subject"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if already submitted
        existing_submission = AssessmentSubmission.objects.filter(
            assessment=assessment,
            student=user
        ).first()

        if existing_submission:
            return Response(
                {"detail": "You have already submitted this assessment"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get answers and time taken from request
        answers = request.data.get('answers', {})
        time_taken = request.data.get('time_taken', 0)

        # Create submission
        submission = AssessmentSubmission.objects.create(
            assessment=assessment,
            student=user,
            time_taken=time_taken,
            max_score=assessment.total_marks,
            score=Decimal('0.00')
        )

        total_score = Decimal('0.00')
        questions = assessment.questions.filter(is_active=True)

        # Process each question's answer
        for question in questions:
            question_id_str = str(question.id)
            student_answer = StudentAnswer.objects.create(
                submission=submission,
                question=question
            )

            # Process based on question type
            if question.question_type == 'multiple_choice':
                if question_id_str in answers:
                    selected_option_id = answers[question_id_str]
                    try:
                        selected_option = question.options.get(id=selected_option_id)
                        student_answer.selected_option = selected_option
                        student_answer.is_correct = selected_option.is_correct

                        if selected_option.is_correct:
                            student_answer.points_earned = question.marks
                            total_score += question.marks

                        student_answer.save()
                    except QuestionOption.DoesNotExist:
                        pass

            elif question.question_type == 'true_false':
                if question_id_str in answers:
                    answer = str(answers[question_id_str]).strip()
                    student_answer.text_answer = answer

                    # Check if correct
                    correct = question.correct_answer.strip()
                    if answer.lower() == correct.lower():
                        student_answer.is_correct = True
                        student_answer.points_earned = question.marks
                        total_score += question.marks
                    else:
                        student_answer.is_correct = False

                    student_answer.save()

            elif question.question_type in ['fill_blank', 'essay']:
                # Store answer but don't auto-grade
                if question_id_str in answers:
                    student_answer.text_answer = str(answers[question_id_str])
                    student_answer.is_correct = None  # Needs manual grading
                    student_answer.save()

            elif question.question_type == 'matching':
                # Process matching answers
                matching_answers = {}
                pairs = question.matching_pairs.all().order_by('pair_number')

                for idx, pair in enumerate(pairs):
                    answer_key = f"{question_id_str}_{idx}"
                    if answer_key in answers:
                        student_letter = str(answers[answer_key]).strip().upper()
                        matching_answers[f"pair_{idx}"] = student_letter

                student_answer.matching_answers = matching_answers

                # Auto-grade matching
                correct_count = 0
                for idx, pair in enumerate(pairs):
                    expected_letter = chr(65 + idx)  # A, B, C...
                    student_letter = matching_answers.get(f"pair_{idx}", "")
                    if student_letter == expected_letter:
                        correct_count += 1

                # Calculate partial credit
                if len(pairs) > 0:
                    percentage_correct = correct_count / len(pairs)
                    student_answer.points_earned = question.marks * Decimal(str(percentage_correct))
                    total_score += student_answer.points_earned
                    student_answer.is_correct = (correct_count == len(pairs))

                student_answer.save()

        # Update submission with total score
        submission.score = total_score

        # Check if needs manual grading
        has_essay_or_fill = questions.filter(
            question_type__in=['fill_blank', 'essay']
        ).exists()
        submission.is_graded = not has_essay_or_fill

        submission.save()

        # Serialize and return
        serializer = AssessmentSubmissionSerializerClass(submission)

        return Response({
            'message': 'Assessment submitted successfully!',
            'submission_id': submission.id,
            'score': float(submission.score),
            'max_score': float(submission.max_score),
            'percentage': submission.percentage,
            'needs_grading': not submission.is_graded,
            'submission': serializer.data
        }, status=status.HTTP_201_CREATED)


# ========================
# STUDENT MY CLASSES VIEW
# ========================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_student_class_info(request):
    """
    Get student's current class information with subjects.
    Returns class info, subjects, and content summaries.
    """
    user = request.user

    if user.role != 'student':
        return Response(
            {'error': 'Only students can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get student's active session
    student_session = StudentSession.objects.filter(
        student=user,
        is_active=True
    ).select_related(
        'class_session',
        'class_session__classroom'
    ).first()

    if not student_session:
        return Response({
            'has_class': False,
            'message': 'You are not enrolled in any class'
        })

    class_session = student_session.class_session
    classroom = class_session.classroom

    # Get subjects for this class session
    # Filter by department if student has one set
    subjects_query = Subject.objects.filter(
        class_session=class_session
    ).select_related('teacher')

    if user.department and user.department != 'General':
        subjects_query = subjects_query.filter(
            Q(department='General') | Q(department=user.department)
        )

    subjects_data = []
    for subject in subjects_query.order_by('name'):
        # Get content counts
        notes_count = SubjectContent.objects.filter(
            subject=subject,
            content_type='note',
            is_active=True
        ).count()

        announcements_count = SubjectContent.objects.filter(
            subject=subject,
            content_type='announcement',
            is_active=True
        ).count()

        assignments_count = SubjectContent.objects.filter(
            subject=subject,
            content_type='assignment',
            is_active=True
        ).count()

        # Get recent content (latest 5 of each type)
        recent_notes = SubjectContent.objects.filter(
            subject=subject,
            content_type='note',
            is_active=True
        ).order_by('-created_at')[:5].values(
            'id', 'title', 'description', 'created_at'
        )

        recent_announcements = SubjectContent.objects.filter(
            subject=subject,
            content_type='announcement',
            is_active=True
        ).order_by('-created_at')[:5].values(
            'id', 'title', 'description', 'created_at'
        )

        recent_assignments = SubjectContent.objects.filter(
            subject=subject,
            content_type='assignment',
            is_active=True
        ).order_by('-created_at')[:5].values(
            'id', 'title', 'description', 'due_date', 'max_score', 'created_at'
        )

        # Get assignment submissions for this student
        assignment_grades = []
        for assignment in recent_assignments:
            submission = AssignmentSubmission.objects.filter(
                student=user,
                assignment_id=assignment['id']
            ).first()

            assignment_data = {
                'id': assignment['id'],
                'title': assignment['title'],
                'description': assignment['description'],
                'due_date': assignment['due_date'],
                'max_score': assignment['max_score'],
                'created_at': assignment['created_at'],
                'submission_status': 'not_submitted',
                'score': None,
                'feedback': None,
                'grade_released': False
            }

            if submission:
                assignment_data['submission_status'] = submission.status
                if submission.grade_released:
                    assignment_data['score'] = float(submission.score) if submission.score else None
                    assignment_data['feedback'] = submission.feedback
                    assignment_data['grade_released'] = True

            assignment_grades.append(assignment_data)

        subjects_data.append({
            'id': subject.id,
            'name': subject.name,
            'department': subject.department,
            'teacher': {
                'id': subject.teacher.id if subject.teacher else None,
                'name': f"{subject.teacher.first_name} {subject.teacher.last_name}" if subject.teacher else 'Not Assigned'
            },
            'content_summary': {
                'notes': notes_count,
                'announcements': announcements_count,
                'assignments': assignments_count
            },
            'recent_notes': list(recent_notes),
            'recent_announcements': list(recent_announcements),
            'assignments_with_grades': assignment_grades
        })

    return Response({
        'has_class': True,
        'student_name': f"{user.first_name} {user.last_name}",
        'class_info': {
            'id': class_session.id,
            'class_name': classroom.name,
            'academic_year': class_session.academic_year,
            'term': class_session.term
        },
        'subjects': subjects_data,
        'total_subjects': len(subjects_data)
    })