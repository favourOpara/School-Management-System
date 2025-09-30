from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import Class, ClassSession, Subject, StudentSession, SubjectContent, StudentContentView
from .serializers import (
    ClassSerializer, ClassSessionSerializer, SubjectSerializer,
    SubjectContentSerializer, SubjectContentCreateSerializer,
    AssignmentSerializer, NoteSerializer, AnnouncementSerializer,
    StudentContentViewSerializer
)
from users.models import CustomUser


# Custom permission for teachers
class IsTeacherRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'teacher'


# Admin-only: Create/List permanent classes (e.g., "J.S.S.1", "S.S.S.3")
class ClassListCreateView(generics.ListCreateAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAdminUser]


# Admin-only: Retrieve, update, or delete a specific Class
class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# Admin-only: Create/List academic ClassSessions
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


# admin-only: Retrieve/update/delete a specific ClassSession
class ClassSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClassSession.objects.all()
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# Admin-only: Create/list subjects (accepts list format for bulk)
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
                    # Prevent creating multiple per department
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

        # Prevent duplicate general subjects on single POST too
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


# Authenticated users can view all subjects
class SubjectListView(generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]


# Admin-only: Retrieve, update, or delete a specific subject
class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# Teacher-only: View subjects assigned to the logged-in teacher
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


# Teacher-only: Get students in a specific subject they teach
class TeacherSubjectStudentsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]

    def get(self, request, subject_id):
        try:
            # Verify the subject belongs to this teacher
            subject = Subject.objects.select_related(
                'class_session__classroom',
                'teacher'
            ).get(id=subject_id, teacher=request.user)
        except Subject.DoesNotExist:
            return Response({
                'error': 'Subject not found or not assigned to you'
            }, status=status.HTTP_404_NOT_FOUND)

        # Get all active students in this subject's class session
        student_sessions = StudentSession.objects.filter(
            class_session=subject.class_session,
            is_active=True
        ).select_related('student').order_by('student__first_name', 'student__last_name')

        # Filter students by department if it's a senior secondary class
        students = []
        for student_session in student_sessions:
            student = student_session.student
            
            # If it's SS class and subject has specific department, filter by student department
            if (subject.class_session.classroom.name.startswith('S.S.S.') and 
                subject.department != 'General' and 
                student.department != subject.department):
                continue  # Skip students not in this department
            
            # Calculate student's age
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


# NEW: Teacher-only: Create assignments, notes, and announcements
class SubjectContentCreateView(generics.CreateAPIView):
    serializer_class = SubjectContentCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        # Verify the teacher owns the subject
        subject = serializer.validated_data['subject']
        if subject.teacher != self.request.user:
            raise PermissionError("You can only create content for subjects you teach.")
        
        serializer.save(teacher=self.request.user)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except PermissionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )


# NEW: Teacher-only: List content for a specific subject they teach
class TeacherSubjectContentView(generics.ListAPIView):
    serializer_class = SubjectContentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]

    def get_queryset(self):
        subject_id = self.kwargs['subject_id']
        
        # Verify the teacher owns the subject
        try:
            subject = Subject.objects.get(id=subject_id, teacher=self.request.user)
        except Subject.DoesNotExist:
            return SubjectContent.objects.none()
        
        return SubjectContent.objects.filter(
            subject=subject,
            is_active=True
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        subject_id = self.kwargs['subject_id']
        
        try:
            subject = Subject.objects.select_related(
                'class_session__classroom'
            ).get(id=subject_id, teacher=request.user)
        except Subject.DoesNotExist:
            return Response({
                'error': 'Subject not found or not assigned to you'
            }, status=status.HTTP_404_NOT_FOUND)

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Group content by type
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


# NEW: Teacher-only: Update/Delete specific content
class TeacherContentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubjectContentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return SubjectContent.objects.filter(teacher=self.request.user)

    def get_object(self):
        content_id = self.kwargs['content_id']
        return get_object_or_404(
            SubjectContent,
            id=content_id,
            teacher=self.request.user
        )


# NEW: Get content for a specific subject (for students/admins to view later)
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
        
        # Group content by type
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


# Admin-only: Copy students and/or subjects from previous session - FIXED VERSION
class SessionInheritanceView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        """
        Copy students and/or subjects from a previous session to new sessions
        This preserves the same usernames and student records while creating new session links
        """
        data = request.data
        source_academic_year = data.get('source_academic_year')
        source_term = data.get('source_term')
        target_academic_year = data.get('target_academic_year')
        target_term = data.get('target_term')
        copy_students = data.get('copy_students', False)
        copy_subjects = data.get('copy_subjects', False)

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

        try:
            with transaction.atomic():
                # Get source sessions
                source_sessions = ClassSession.objects.filter(
                    academic_year=source_academic_year,
                    term=source_term
                )

                # Get target sessions (must already exist)
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
                copied_subjects = 0

                # Copy students if requested - FIXED: Don't modify CustomUser records
                if copy_students:
                    # Get all active student sessions from source
                    source_student_sessions = StudentSession.objects.filter(
                        class_session__academic_year=source_academic_year,
                        class_session__term=source_term,
                        is_active=True
                    ).select_related('student', 'class_session__classroom')

                    for source_student_session in source_student_sessions:
                        student = source_student_session.student
                        source_class_session = source_student_session.class_session
                        
                        # Find corresponding target session for the same classroom
                        target_class_session = target_sessions.filter(
                            classroom=source_class_session.classroom
                        ).first()
                        
                        if target_class_session:
                            # Create new StudentSession link for the target session
                            # This preserves the original student record and username
                            new_student_session, created = StudentSession.objects.get_or_create(
                                student=student,
                                class_session=target_class_session,
                                defaults={'is_active': True}
                            )
                            
                            if created:
                                copied_students += 1
                                
                                # Mark the previous session as inactive (for historical tracking)
                                source_student_session.is_active = False
                                source_student_session.save()

                # Copy subjects if requested
                if copy_subjects:
                    for source_session in source_sessions:
                        # Find corresponding target session for the same classroom
                        target_session = target_sessions.filter(
                            classroom=source_session.classroom
                        ).first()

                        if target_session:
                            source_subjects = source_session.subjects.all()
                            for source_subject in source_subjects:
                                # Check if subject already exists in target session
                                if not target_session.subjects.filter(
                                    name=source_subject.name,
                                    department=source_subject.department
                                ).exists():
                                    Subject.objects.create(
                                        name=source_subject.name,
                                        class_session=target_session,
                                        teacher=source_subject.teacher,  # Keep same teacher
                                        department=source_subject.department
                                    )
                                    copied_subjects += 1

                return Response({
                    "message": "Data copied successfully",
                    "details": {
                        "students_copied": copied_students,
                        "subjects_copied": copied_subjects,
                        "note": "Students retain their original usernames and personal data. Historical data is preserved in previous StudentSession records."
                    }
                }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"detail": f"Error copying data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# NEW: Admin-only: Get students enrolled in a specific session
class SessionStudentsView(APIView):
    permission_classes = [permissions.IsAdminUser]
    
    def get(self, request, session_id):
        try:
            session = ClassSession.objects.get(id=session_id)
            student_sessions = StudentSession.objects.filter(
                class_session=session, is_active=True
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