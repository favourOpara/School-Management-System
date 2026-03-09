from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import CustomUser
from .serializers import (
    UserCreateSerializer,
    TeacherSignupSerializer,
    ParentSignupSerializer,
    UserListSerializer,
    StudentDetailSerializer,
    TeacherDetailSerializer,
)
from academics.models import Subject, StudentSession, ClassSession
from logs.models import ActivityLog
from datetime import date

# Admin or Principal permission (for administrative endpoints)
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'principal']

# Principal-only permission
class IsPrincipalRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'principal'

# Principal or Admin permission (for shared endpoints)
class IsPrincipalOrAdmin(permissions.BasePermission):
    """Permission for endpoints that both Principal and Admin can access"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'principal']

# Custom JWT serializer to include user role and other info in token response
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    school_slug = serializers.CharField(required=False, allow_blank=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims to token
        token['role'] = user.role
        token['username'] = user.username
        token['full_name'] = f"{user.first_name} {user.last_name}"
        # Add school info to token
        if user.school:
            token['school_id'] = str(user.school.id)
            token['school_slug'] = user.school.slug

        return token

    def validate(self, attrs):
        # Extract school_slug before parent validation
        school_slug = attrs.pop('school_slug', None)

        data = super().validate(attrs)

        # Verify user belongs to the school they're trying to log into
        if school_slug and self.user.school:
            if self.user.school.slug != school_slug:
                raise serializers.ValidationError({
                    'detail': 'Invalid credentials for this school.',
                })
        elif school_slug and not self.user.school:
            # User has no school assigned
            raise serializers.ValidationError({
                'detail': 'Your account is not associated with any school.',
            })

        # Check if user has verified their email (skip for admin users)
        if self.user.role != 'admin' and not self.user.email_verified:
            from rest_framework import serializers
            raise serializers.ValidationError({
                'detail': 'Email not verified. Please check your email and click the verification link to activate your account.',
                'email_verified': False,
                'email': self.user.email
            })

        # Check if user must change password
        if self.user.must_change_password:
            from rest_framework import serializers
            raise serializers.ValidationError({
                'detail': 'You must change your password before logging in. Please check your email for the verification link.',
                'must_change_password': True,
                'email': self.user.email
            })

        # Add extra user info to response
        data.update({
            'user_id': self.user.id,
            'username': self.user.username,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'full_name': f"{self.user.first_name} {self.user.last_name}",
        })
        
        # Add role-specific data
        if self.user.role == 'student':
            # Get current active session for student
            active_session = StudentSession.objects.filter(
                student=self.user,
                is_active=True
            ).select_related('class_session__classroom').first()
            
            if active_session:
                data.update({
                    'classroom': active_session.class_session.classroom.name if active_session.class_session.classroom else None,
                    'academic_year': active_session.class_session.academic_year,
                    'term': active_session.class_session.term,
                    'department': self.user.department,
                })
            else:
                # Fallback to user fields if no active session
                data.update({
                    'classroom': self.user.classroom.name if self.user.classroom else None,
                    'academic_year': self.user.academic_year,
                    'term': self.user.term,
                    'department': self.user.department,
                })
        elif self.user.role == 'teacher':
            data.update({
                'classroom': self.user.classroom.name if self.user.classroom else None,
            })
        elif self.user.role == 'parent':
            children = self.user.children.all()
            children_data = []

            for child in children:
                # Get child's current active session
                active_session = StudentSession.objects.filter(
                    student=child,
                    is_active=True
                ).select_related('class_session__classroom').first()

                if active_session:
                    classroom_name = active_session.class_session.classroom.name if active_session.class_session.classroom else None
                else:
                    classroom_name = child.classroom.name if child.classroom else None

                children_data.append({
                    'id': child.id,
                    'name': f"{child.first_name} {child.last_name}",
                    'username': child.username,
                    'classroom': classroom_name
                })

            data.update({
                'children': children_data
            })
        # Admin and Principal roles don't need extra data
        # They already have role, username, user_id, etc. from lines 59-66

        return data

# Custom login view for all user roles (students, teachers, parents, admins)
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

# Admin creates student or parent - FIXED to always create StudentSession properly
class CreateUserView(generics.CreateAPIView):
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        school = getattr(self.request, 'school', None)
        if school:
            return CustomUser.objects.filter(school=school)
        return CustomUser.objects.none()

    def create(self, request, *args, **kwargs):
        school = getattr(request, 'school', None)
        role = request.data.get('role', '')
        if school and role:
            from tenants.permissions import check_user_limit
            can_create, msg = check_user_limit(school, role)
            if not can_create:
                return Response({'error': msg}, status=status.HTTP_403_FORBIDDEN)

        # For students, block creation if no ClassSession exists for the selected
        # classroom + academic year + term. This prevents ghost students that appear
        # in fees/attendance but are invisible to the session system.
        if role == 'student':
            classroom_id = request.data.get('classroom')
            academic_year = request.data.get('academic_year')
            term = request.data.get('term')
            if classroom_id and academic_year and term:
                if not ClassSession.objects.filter(
                    classroom_id=classroom_id,
                    academic_year=academic_year,
                    term=term
                ).exists():
                    try:
                        from academics.models import Class as Classroom
                        classroom_name = Classroom.objects.get(id=classroom_id).name
                    except Exception:
                        classroom_name = f'the selected class'
                    return Response(
                        {'error': (
                            f'No class session exists for {classroom_name} in '
                            f'{academic_year} {term}. Please set up the class session '
                            f'for this class before adding students to it.'
                        )},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        school = getattr(self.request, 'school', None)
        user = serializer.save(school=school)

        # Create StudentSession — ClassSession is guaranteed to exist (checked in create())
        if user.role == 'student' and user.classroom and user.academic_year and user.term:
            try:
                class_session = ClassSession.objects.get(
                    classroom=user.classroom,
                    academic_year=user.academic_year,
                    term=user.term
                )
                StudentSession.objects.get_or_create(
                    student=user,
                    class_session=class_session,
                    defaults={'is_active': True}
                )
            except ClassSession.DoesNotExist:
                # Should not reach here — blocked in create() — but log if it does
                ActivityLog.objects.create(
                    user=self.request.user,
                    role='error',
                    action=f"Unexpected: ClassSession missing for {user.username}: "
                           f"{user.classroom.name} - {user.academic_year} - {user.term}"
                )

        ActivityLog.objects.create(
            user=self.request.user,
            role=user.role,
            action=f"{self.request.user.username} created {user.role} account: {user.username}"
        )

# Admin creates teacher
class TeacherSignupView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        # Check teacher limit
        school = getattr(request, 'school', None)
        if school:
            from tenants.permissions import check_user_limit
            can_create, msg = check_user_limit(school, 'teacher')
            if not can_create:
                return Response({'error': msg}, status=status.HTTP_403_FORBIDDEN)

        serializer = TeacherSignupSerializer(data=request.data)
        if serializer.is_valid():
            # Set the school from the request for multi-tenancy data isolation
            school = getattr(request, 'school', None)
            user = serializer.save(school=school)
            ActivityLog.objects.create(
                user=request.user,
                role='teacher',
                action=f"{request.user.username} created teacher account: {user.username}"
            )
            return Response({
                "message": "Teacher registered successfully.",
                "username": user.username
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Admin creates parent
class ParentSignupView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        # Check parent limit
        school = getattr(request, 'school', None)
        if school:
            from tenants.permissions import check_user_limit
            can_create, msg = check_user_limit(school, 'parent')
            if not can_create:
                return Response({'error': msg}, status=status.HTTP_403_FORBIDDEN)

        serializer = ParentSignupSerializer(data=request.data)
        if serializer.is_valid():
            # Set the school from the request for multi-tenancy data isolation
            school = getattr(request, 'school', None)
            user = serializer.save(school=school)
            ActivityLog.objects.create(
                user=request.user,
                role='parent',
                action=f"{request.user.username} created parent account: {user.username}"
            )
            return Response({
                "message": "Parent registered successfully.",
                "username": user.username
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Logged-in user info - accessible by all authenticated users
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserCreateSerializer(request.user)
    return Response(serializer.data)

# List graduated students - Admin only
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_graduated_students(request):
    school = getattr(request, 'school', None)
    graduated = CustomUser.objects.filter(
        role='student',
        is_graduated=True,
        school=school
    ).order_by('-graduation_date')

    data = []
    for student in graduated:
        last_session = StudentSession.objects.filter(
            student=student
        ).select_related('class_session__classroom').order_by(
            '-class_session__academic_year', '-class_session__term'
        ).first()

        parents = student.parents.all()
        parent_info = ', '.join(
            f"{p.first_name} {p.last_name}" for p in parents
        ) if parents.exists() else None

        data.append({
            'id': student.id,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'middle_name': getattr(student, 'middle_name', ''),
            'username': student.username,
            'email': student.email,
            'gender': student.gender,
            'department': student.department,
            'graduation_date': student.graduation_date,
            'last_class': last_session.class_session.classroom.name if last_session else None,
            'last_academic_year': last_session.class_session.academic_year if last_session else None,
            'parent': parent_info,
        })

    return Response(data)


# List teachers - Admin only - UPDATED to show full details
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_teachers(request):
    # Filter by school for multi-tenancy data isolation
    school = getattr(request, 'school', None)
    if school:
        teachers = CustomUser.objects.filter(role='teacher', school=school)
    else:
        teachers = CustomUser.objects.none()
    serializer = TeacherDetailSerializer(teachers, many=True)
    return Response(serializer.data)

# List principals - Admin only
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_principals(request):
    # Filter by school for multi-tenancy data isolation
    school = getattr(request, 'school', None)
    if school:
        principals = CustomUser.objects.filter(role='principal', school=school)
    else:
        principals = CustomUser.objects.none()
    serializer = TeacherDetailSerializer(principals, many=True)
    return Response(serializer.data)

# List parents - Admin only - UPDATED to handle StudentSession
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_parents(request):
    # Filter by school for multi-tenancy data isolation
    school = getattr(request, 'school', None)
    if school:
        parents = CustomUser.objects.filter(role='parent', school=school)
    else:
        parents = CustomUser.objects.none()

    response_data = []
    for parent in parents:
        children = parent.children.all()

        child_list = []
        for child in children:
            # Get child's current active session for accurate classroom info
            active_session = StudentSession.objects.filter(
                student=child,
                is_active=True
            ).select_related('class_session__classroom').first()
            
            if active_session:
                classroom_name = active_session.class_session.classroom.name if active_session.class_session.classroom else None
            else:
                classroom_name = child.classroom.name if child.classroom else None
            
            child_list.append({
                'id': child.id,
                'username': child.username,
                'full_name': f"{child.first_name} {child.last_name}",
                'classroom': classroom_name
            })

        response_data.append({
            'id': parent.id,
            'first_name': parent.first_name,
            'last_name': parent.last_name,
            'username': parent.username,
            'email': parent.email,
            'phone_number': parent.phone_number,
            'children': child_list,
            'last_login': parent.last_login.strftime('%Y-%m-%d %H:%M') if parent.last_login else None,
        })

    return Response(response_data)

# List students with filters - Admin only - UPDATED to use StudentSession properly
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_students(request):
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    # Filter by school for multi-tenancy data isolation
    school = getattr(request, 'school', None)

    if academic_year and term:
        # Filter students by session using StudentSession model
        student_sessions_query = StudentSession.objects.filter(
            class_session__academic_year=academic_year,
            class_session__term=term,
            is_active=True
        )
        # Apply school filter — always require a valid school to prevent cross-tenant leakage
        if school:
            student_sessions_query = student_sessions_query.filter(student__school=school)
        else:
            student_sessions_query = student_sessions_query.none()

        student_sessions = student_sessions_query.select_related('student', 'class_session__classroom')
        students = [ss.student for ss in student_sessions]
    else:
        # Get all students filtered by school
        if school:
            students = CustomUser.objects.filter(role='student', school=school)
        else:
            students = CustomUser.objects.none()

    serializer = StudentDetailSerializer(students, many=True)
    return Response(serializer.data)

# List students and match subjects by department - UPDATED to use StudentSession properly
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def students_with_subjects(request):
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    if not academic_year or not term:
        return Response({'error': 'academic_year and term are required'}, status=400)

    school = getattr(request, 'school', None)

    # Build a lookup of student_id -> session for students who have a StudentSession
    # for this specific term. Used to resolve subjects.
    sessions_qs = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
    ).select_related('student', 'class_session__classroom')
    if school:
        sessions_qs = sessions_qs.filter(student__school=school)

    session_by_student = {}
    for ss in sessions_qs:
        if ss.student_id not in session_by_student:
            session_by_student[ss.student_id] = ss

    # Subjects for this term (used when we can resolve a class session)
    subjects_qs = Subject.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
    )
    if school:
        subjects_qs = subjects_qs.filter(class_session__classroom__school=school)

    # Primary source: all active students in the school with a classroom assigned.
    # This matches how fees and attendance work, so no student is invisible.
    students_qs = CustomUser.objects.filter(
        role='student',
        classroom__isnull=False,
    ).select_related('classroom').prefetch_related('parents')
    if school:
        students_qs = students_qs.filter(school=school)

    response_data = []
    for student in students_qs:
        classroom = student.classroom

        # Resolve subjects via StudentSession if one exists, otherwise use classroom directly
        ss = session_by_student.get(student.id)
        if ss and ss.class_session.classroom:
            subject_classroom = ss.class_session.classroom
        else:
            subject_classroom = classroom

        student_subjects = subjects_qs.filter(class_session__classroom=subject_classroom)
        if subject_classroom.has_departments and student.department:
            student_subjects = student_subjects.filter(department__in=['General', student.department])

        age = None
        if student.date_of_birth:
            today = date.today()
            age = today.year - student.date_of_birth.year - (
                (today.month, today.day) < (student.date_of_birth.month, student.date_of_birth.day)
            )

        parent = student.parents.first() if student.parents.exists() else None

        response_data.append({
            'id': student.id,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'middle_name': student.middle_name,
            'full_name': f"{student.first_name} {student.last_name}",
            'username': student.username,
            'email': student.email,
            'gender': student.gender,
            'age': age,
            'classroom': {
                'id': classroom.id,
                'name': classroom.name,
                'has_departments': classroom.has_departments,
            },
            'academic_year': academic_year,
            'term': term,
            'date_of_birth': student.date_of_birth,
            'department': student.department,
            'parent': {
                'full_name': f"{parent.first_name} {parent.last_name}" if parent else None,
                'phone_number': parent.phone_number if parent else None,
                'email': parent.email if parent else None,
            } if parent else None,
            'last_login': student.last_login.strftime('%Y-%m-%d %H:%M') if student.last_login else None,
            'subjects': [
                {'name': s.name, 'department': s.department}
                for s in student_subjects
            ],
        })

    return Response(response_data)

# Student History - Admin only: Shows complete academic history for all students
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def student_history(request):
    """
    Returns complete academic history for all students showing all sessions they've been enrolled in
    """
    # Filter by school for multi-tenancy data isolation
    school = getattr(request, 'school', None)

    # Get all student sessions (both active and inactive) ordered by student and session
    if school:
        student_sessions_query = StudentSession.objects.filter(student__school=school)
    else:
        student_sessions_query = StudentSession.objects.none()

    student_sessions = student_sessions_query.select_related(
        'student',
        'class_session__classroom'
    ).order_by('student__first_name', 'student__last_name', '-class_session__academic_year', 'class_session__term')
    
    # Group sessions by student
    students_history = {}
    for session in student_sessions:
        student = session.student
        student_key = student.id
        
        if student_key not in students_history:
            # Calculate student's age
            age = None
            if student.date_of_birth:
                today = date.today()
                age = today.year - student.date_of_birth.year - (
                    (today.month, today.day) < (student.date_of_birth.month, student.date_of_birth.day)
                )
            
            # Get parent info
            parent = student.parents.first() if hasattr(student, 'parents') and student.parents.exists() else None
            
            students_history[student_key] = {
                'student_info': {
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
                    'parent': {
                        'full_name': f"{parent.first_name} {parent.last_name}" if parent else None,
                        'phone_number': parent.phone_number if parent else None,
                        'email': parent.email if parent else None
                    } if parent else None,
                },
                'academic_sessions': []
            }
        
        # Add session info
        students_history[student_key]['academic_sessions'].append({
            'class_session_id': session.class_session.id,
            'classroom': session.class_session.classroom.name if session.class_session.classroom else None,
            'academic_year': session.class_session.academic_year,
            'term': session.class_session.term,
            'date_enrolled': session.date_enrolled,
            'is_active': session.is_active,
            'status': 'Current' if session.is_active else 'Historical'
        })
    
    # Convert to list format
    response_data = list(students_history.values())
    
    return Response(response_data)

# Individual Student History - Admin only: Shows complete history for a specific student
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def individual_student_history(request, student_id):
    """
    Returns complete academic history for a specific student
    """
    school = getattr(request, 'school', None)
    try:
        qs = CustomUser.objects.filter(id=student_id, role='student')
        if school:
            qs = qs.filter(school=school)
        else:
            qs = qs.filter(school__isnull=False)
        student = qs.get()
    except CustomUser.DoesNotExist:
        return Response({'error': 'Student not found'}, status=404)

    # Get all sessions for this student
    student_sessions = StudentSession.objects.filter(
        student=student
    ).select_related('class_session__classroom').order_by(
        '-class_session__academic_year', 'class_session__term'
    )
    
    # Calculate student's age
    age = None
    if student.date_of_birth:
        today = date.today()
        age = today.year - student.date_of_birth.year - (
            (today.month, today.day) < (student.date_of_birth.month, student.date_of_birth.day)
        )
    
    # Get parent info
    parent = student.parents.first() if hasattr(student, 'parents') and student.parents.exists() else None
    
    # Build response
    response_data = {
        'student_info': {
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
            'parent': {
                'full_name': f"{parent.first_name} {parent.last_name}" if parent else None,
                'phone_number': parent.phone_number if parent else None,
                'email': parent.email if parent else None
            } if parent else None,
        },
        'academic_sessions': []
    }
    
    for session in student_sessions:
        response_data['academic_sessions'].append({
            'class_session_id': session.class_session.id,
            'classroom': session.class_session.classroom.name if session.class_session.classroom else None,
            'academic_year': session.class_session.academic_year,
            'term': session.class_session.term,
            'date_enrolled': session.date_enrolled,
            'is_active': session.is_active,
            'status': 'Current' if session.is_active else 'Historical'
        })
    
    return Response(response_data)

# Edit / Update / Delete individual user - Admin only - FIXED to handle StudentSession properly
class UserRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'

    def get_queryset(self):
        school = getattr(self.request, 'school', None)
        if school:
            return CustomUser.objects.filter(school=school)
        return CustomUser.objects.none()

    def update(self, request, *args, **kwargs):
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[VIEW UPDATE] Request data: {request.data}")
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        from rest_framework.exceptions import ValidationError as DRFValidationError

        instance = serializer.instance
        password = self.request.data.get('password')

        # If admin is uploading a new profile photo, delete the old one from storage first
        if self.request.FILES.get('profile_picture') and instance.profile_picture:
            try:
                instance.profile_picture.delete(save=False)
            except Exception:
                pass

        # For students, validate that a ClassSession exists for the target
        # classroom + year + term BEFORE saving — same guard as on creation.
        if instance.role == 'student' or serializer.validated_data.get('role') == 'student':
            classroom  = serializer.validated_data.get('classroom',      instance.classroom)
            acad_year  = serializer.validated_data.get('academic_year',  instance.academic_year)
            term       = serializer.validated_data.get('term',           instance.term)
            if classroom and acad_year and term:
                if not ClassSession.objects.filter(
                    classroom=classroom,
                    academic_year=acad_year,
                    term=term
                ).exists():
                    raise DRFValidationError({
                        'error': (
                            f'No class session exists for {classroom.name} in '
                            f'{acad_year} {term}. Please set up the class session '
                            f'for this class before moving a student into it.'
                        )
                    })

        instance = serializer.save()

        if password:
            instance.set_password(password)
            instance.save()

        # Update StudentSession — ClassSession is guaranteed to exist (checked above)
        if (instance.role == 'student' and
                instance.classroom and instance.academic_year and instance.term):
            try:
                class_session = ClassSession.objects.get(
                    classroom=instance.classroom,
                    academic_year=instance.academic_year,
                    term=instance.term
                )

                existing_session = StudentSession.objects.filter(
                    student=instance,
                    class_session=class_session
                ).first()

                if existing_session:
                    if not existing_session.is_active:
                        StudentSession.objects.filter(
                            student=instance,
                            is_active=True
                        ).exclude(id=existing_session.id).update(is_active=False)
                        existing_session.is_active = True
                        existing_session.save()
                else:
                    StudentSession.objects.filter(
                        student=instance,
                        is_active=True
                    ).update(is_active=False)
                    StudentSession.objects.create(
                        student=instance,
                        class_session=class_session,
                        is_active=True
                    )
            except ClassSession.DoesNotExist:
                # Should not reach here — blocked above — but log if it does
                ActivityLog.objects.create(
                    user=self.request.user,
                    role='error',
                    action=f"Unexpected: ClassSession missing on update for {instance.username}: "
                           f"{instance.classroom.name} - {instance.academic_year} - {instance.term}"
                )

# ============================================================================
# PARENT ATTENDANCE REPORT
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_attendance_report(request):
    """
    Get attendance report for logged-in student.

    Query Parameters:
    - academic_year: Academic year (optional) - defaults to current session
    - term: Term (optional) - defaults to current session

    Returns attendance statistics and detailed records.
    """
    from schooladmin.models import AttendanceRecord as GradingAttendanceRecord
    from attendance.models import AttendanceCalendar, AttendanceSchoolDay, AttendanceHolidayLabel
    from django.db.models import Count, Q
    from datetime import datetime

    student = request.user

    # Verify user is a student
    if student.role != 'student':
        return Response(
            {"detail": "Only students can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get academic_year and term from query params or use current session
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    # If not provided, get student's current session
    if not academic_year or not term:
        current_session = StudentSession.objects.filter(
            student=student,
            is_active=True
        ).select_related('class_session').first()

        if current_session:
            academic_year = current_session.class_session.academic_year
            term = current_session.class_session.term
        else:
            return Response(
                {"detail": "No active session found for student"},
                status=status.HTTP_404_NOT_FOUND
            )

    # Get the student's class session for this academic year and term
    student_session = StudentSession.objects.filter(
        student=student,
        class_session__academic_year=academic_year,
        class_session__term=term
    ).select_related('class_session').first()

    if not student_session:
        return Response(
            {"detail": f"No class session found for {academic_year} - {term}"},
            status=status.HTTP_404_NOT_FOUND
        )

    class_session = student_session.class_session

    # Get total school days and holidays from the attendance calendar
    total_school_days = 0
    total_holidays = 0
    holidays_list = []

    try:
        attendance_calendar = AttendanceCalendar.objects.get(
            academic_year=academic_year,
            term=term
        )

        # Get school days from the attendance calendar system
        school_days = AttendanceSchoolDay.objects.filter(calendar=attendance_calendar)
        total_school_days = school_days.count()

        # Get holidays from the attendance calendar system
        holiday_days = AttendanceHolidayLabel.objects.filter(calendar=attendance_calendar)
        total_holidays = holiday_days.count()

        # Build holidays list
        holidays_list = [{
            'date': holiday.date.strftime('%Y-%m-%d'),
            'label': holiday.label,
            'type': holiday.get_holiday_type_display()
        } for holiday in holiday_days.order_by('date')]

    except AttendanceCalendar.DoesNotExist:
        # No attendance calendar exists, that's okay - we'll show 0
        pass

    # Get attendance records from grading system (schooladmin.AttendanceRecord)
    attendance_records = GradingAttendanceRecord.objects.filter(
        student=student,
        class_session=class_session
    ).select_related('class_session').order_by('date')

    # Calculate attendance statistics
    # Get unique dates where student was present
    present_records = attendance_records.filter(is_present=True)
    attended_dates = present_records.values('date').distinct()
    days_attended = attended_dates.count()

    # Get unique dates where student was absent
    absent_records = attendance_records.filter(is_present=False)
    absent_dates = absent_records.values('date').distinct()
    days_not_attended = absent_dates.count()

    # Calculate attendance percentage based on calendar school days
    attendance_percentage = (days_attended / total_school_days * 100) if total_school_days > 0 else 0

    # Prepare detailed attendance records by date (only show days absent)
    attendance_by_date = {}
    for record in absent_records:
        date_str = record.date.strftime('%Y-%m-%d')
        if date_str not in attendance_by_date:
            attendance_by_date[date_str] = {
                'date': date_str,
                'subjects': []
            }
        # Note: Grading attendance is per class session, not per subject
        subject_info = {
            'subject_name': f"Absent",
            'marked_at': record.recorded_at.isoformat() if record.recorded_at else None
        }
        if attendance_by_date[date_str]['subjects']:
            # If we already have an entry for this date, skip duplicate
            continue
        attendance_by_date[date_str]['subjects'].append(subject_info)

    # Get available sessions for this student
    available_sessions = StudentSession.objects.filter(
        student=student
    ).select_related('class_session').values(
        'class_session__academic_year',
        'class_session__term'
    ).distinct().order_by('-class_session__academic_year', 'class_session__term')

    sessions_list = [{
        'academic_year': session['class_session__academic_year'],
        'term': session['class_session__term']
    } for session in available_sessions]

    return Response({
        'student': {
            'id': student.id,
            'full_name': student.get_full_name(),
            'username': student.username,
            'classroom': student.classroom.name if student.classroom else None
        },
        'session': {
            'academic_year': academic_year,
            'term': term
        },
        'statistics': {
            'days_attended': days_attended,
            'days_not_attended': days_not_attended,
            'total_school_days': total_school_days,
            'total_holidays': total_holidays,
            'attendance_percentage': round(attendance_percentage, 2)
        },
        'attendance_records': list(attendance_by_date.values()),
        'holidays': holidays_list,
        'available_sessions': sessions_list
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parent_attendance_report(request):
    """
    Get attendance report for parent's children.

    Query Parameters:
    - child_id: Student ID (optional) - defaults to first child if not provided
    - academic_year: Academic year (optional) - defaults to current session
    - term: Term (optional) - defaults to current session

    Returns attendance statistics and detailed records.
    """
    from schooladmin.models import AttendanceRecord as GradingAttendanceRecord
    from attendance.models import AttendanceCalendar, AttendanceSchoolDay, AttendanceHolidayLabel
    from django.db.models import Count, Q
    from datetime import datetime

    parent = request.user

    # Verify user is a parent
    if parent.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get all children
    children = parent.children.filter(role='student').order_by('first_name', 'last_name')

    if not children.exists():
        return Response(
            {"detail": "No children found for this parent"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get child_id from query params or default to first child
    child_id = request.query_params.get('child_id')
    if child_id:
        try:
            child = children.get(id=child_id)
        except CustomUser.DoesNotExist:
            return Response(
                {"detail": "Child not found or not linked to this parent"},
                status=status.HTTP_404_NOT_FOUND
            )
    else:
        child = children.first()

    # Get academic_year and term from query params or use current session
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    # If not provided, get child's current session
    if not academic_year or not term:
        current_session = StudentSession.objects.filter(
            student=child,
            is_active=True
        ).select_related('class_session').first()

        if current_session:
            academic_year = current_session.class_session.academic_year
            term = current_session.class_session.term
        else:
            return Response(
                {"detail": "No active session found for student"},
                status=status.HTTP_404_NOT_FOUND
            )

    # Get the student's class session for this academic year and term
    student_session = StudentSession.objects.filter(
        student=child,
        class_session__academic_year=academic_year,
        class_session__term=term
    ).select_related('class_session').first()

    if not student_session:
        return Response(
            {"detail": f"No class session found for {academic_year} - {term}"},
            status=status.HTTP_404_NOT_FOUND
        )

    class_session = student_session.class_session

    # Get total school days and holidays from the attendance calendar
    # This is what admin sets when creating the attendance calendar
    total_school_days = 0
    total_holidays = 0
    holidays_list = []

    try:
        attendance_calendar = AttendanceCalendar.objects.get(
            academic_year=academic_year,
            term=term
        )

        # Get school days from the NEW attendance calendar system
        school_days = AttendanceSchoolDay.objects.filter(calendar=attendance_calendar)
        total_school_days = school_days.count()

        # Get holidays from the NEW attendance calendar system
        holiday_days = AttendanceHolidayLabel.objects.filter(calendar=attendance_calendar)
        total_holidays = holiday_days.count()

        # Build holidays list
        holidays_list = [{
            'date': holiday.date.strftime('%Y-%m-%d'),
            'label': holiday.label,
            'type': holiday.get_holiday_type_display()
        } for holiday in holiday_days.order_by('date')]

    except AttendanceCalendar.DoesNotExist:
        # No attendance calendar exists, that's okay - we'll show 0
        pass

    # Get attendance records from grading system (schooladmin.AttendanceRecord)
    attendance_records = GradingAttendanceRecord.objects.filter(
        student=child,
        class_session=class_session
    ).select_related('class_session').order_by('date')

    # Calculate attendance statistics
    # Get unique dates where student was present
    present_records = attendance_records.filter(is_present=True)
    attended_dates = present_records.values('date').distinct()
    days_attended = attended_dates.count()

    # Get unique dates where student was absent
    absent_records = attendance_records.filter(is_present=False)
    absent_dates = absent_records.values('date').distinct()
    days_not_attended = absent_dates.count()

    # Calculate attendance percentage based on calendar school days
    attendance_percentage = (days_attended / total_school_days * 100) if total_school_days > 0 else 0

    # Prepare detailed attendance records by date (only show days absent)
    attendance_by_date = {}
    for record in absent_records:
        date_str = record.date.strftime('%Y-%m-%d')
        if date_str not in attendance_by_date:
            attendance_by_date[date_str] = {
                'date': date_str,
                'subjects': []
            }
        # Note: Grading attendance is per class session, not per subject
        # We'll show the class session info instead
        subject_info = {
            'subject_name': f"Absent",
            'marked_at': record.recorded_at.isoformat() if record.recorded_at else None
        }
        if attendance_by_date[date_str]['subjects']:
            # If we already have an entry for this date, skip duplicate
            continue
        attendance_by_date[date_str]['subjects'].append(subject_info)

    # Get all children for dropdown
    children_list = [{
        'id': c.id,
        'full_name': c.get_full_name(),
        'username': c.username,
        'classroom': c.classroom.name if c.classroom else None
    } for c in children]

    # Get available sessions for this child
    available_sessions = StudentSession.objects.filter(
        student=child
    ).select_related('class_session').values(
        'class_session__academic_year',
        'class_session__term'
    ).distinct().order_by('-class_session__academic_year', 'class_session__term')

    sessions_list = [{
        'academic_year': session['class_session__academic_year'],
        'term': session['class_session__term']
    } for session in available_sessions]

    return Response({
        'child': {
            'id': child.id,
            'full_name': child.get_full_name(),
            'username': child.username,
            'classroom': child.classroom.name if child.classroom else None
        },
        'session': {
            'academic_year': academic_year,
            'term': term
        },
        'statistics': {
            'days_attended': days_attended,
            'days_not_attended': days_not_attended,
            'total_school_days': total_school_days,
            'total_holidays': total_holidays,
            'attendance_percentage': round(attendance_percentage, 2)
        },
        'attendance_records': list(attendance_by_date.values()),
        'holidays': holidays_list,
        'children': children_list,
        'available_sessions': sessions_list
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parent_grade_report(request):
    """
    Get grade report (report sheet) for parent's children.

    Query Parameters:
    - child_id: Student ID (optional) - defaults to first child if not provided
    - academic_year: Academic year (optional) - defaults to current session
    - term: Term (optional) - defaults to current session

    Returns complete report sheet with all subjects, scores, and grades.
    """
    from schooladmin.models import GradeSummary, GradingConfiguration
    from academics.models import Subject
    from django.db.models import Q

    parent = request.user

    # Verify user is a parent
    if parent.role != 'parent':
        return Response(
            {"detail": "Only parents can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get all children
    children = parent.children.filter(role='student').order_by('first_name', 'last_name')

    if not children.exists():
        return Response(
            {"detail": "No children found for this parent"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get child_id from query params or default to first child
    child_id = request.query_params.get('child_id')
    if child_id:
        try:
            child = children.get(id=child_id)
        except CustomUser.DoesNotExist:
            return Response(
                {"detail": "Child not found or not linked to this parent"},
                status=status.HTTP_404_NOT_FOUND
            )
    else:
        child = children.first()

    # Get academic_year and term from query params or use current session
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    # If not provided, default to child's current ACTIVE session
    if not academic_year or not term:
        current_session = StudentSession.objects.filter(
            student=child,
            is_active=True
        ).select_related('class_session').first()

        if current_session:
            academic_year = current_session.class_session.academic_year
            term = current_session.class_session.term
        else:
            # If no active session, fall back to most recent session
            current_session = StudentSession.objects.filter(
                student=child
            ).select_related('class_session').order_by(
                '-class_session__academic_year', '-class_session__term'
            ).first()

            if current_session:
                academic_year = current_session.class_session.academic_year
                term = current_session.class_session.term
            else:
                return Response(
                    {"detail": "No session found for student"},
                    status=status.HTTP_404_NOT_FOUND
                )

    # Get the student's class session for this academic year and term (allow historical)
    student_session = StudentSession.objects.filter(
        student=child,
        class_session__academic_year=academic_year,
        class_session__term=term
    ).select_related('class_session__classroom').first()

    if not student_session:
        return Response(
            {"detail": f"Student not enrolled in {academic_year} - {term}"},
            status=status.HTTP_404_NOT_FOUND
        )

    class_session = student_session.class_session

    # Get grading configuration (allow historical access)
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

    # Get all subjects for this student
    subjects = Subject.objects.filter(
        class_session=class_session
    ).select_related('teacher')

    # Filter by department if student has one
    if child.department:
        subjects = subjects.filter(
            Q(department=child.department) | Q(department='General')
        )

    # Get all children for dropdown (needed for filters even if grades incomplete)
    children_list = [{
        'id': c.id,
        'full_name': c.get_full_name(),
        'username': c.username,
        'classroom': c.classroom.name if c.classroom else None
    } for c in children]

    # Get available sessions for this child (needed for filters even if grades incomplete)
    available_sessions = StudentSession.objects.filter(
        student=child
    ).select_related('class_session').values(
        'class_session__academic_year',
        'class_session__term'
    ).distinct().order_by('-class_session__academic_year', 'class_session__term')

    sessions_list = [{
        'academic_year': session['class_session__academic_year'],
        'term': session['class_session__term']
    } for session in available_sessions]

    # Check if ALL subjects have COMPLETE grades before showing report
    # Complete means: Test 1 (attendance + assignment), Test 2 (test), Exam, and Total are all filled
    grades_complete = True
    for subject in subjects:
        try:
            grade_summary = GradeSummary.objects.get(
                student=child,
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

            # If any component is missing, grades are incomplete
            if not (test1_complete and test2_complete and exam_complete and total_complete):
                grades_complete = False
                break

        except GradeSummary.DoesNotExist:
            # No grade summary = grades incomplete
            grades_complete = False
            break

    # If grades are not complete, do not show the report
    # But still return filter data so users can check other sessions
    if not grades_complete:
        return Response(
            {
                "detail": "Report sheet is not available. Grades are incomplete for this session.",
                "children": children_list,
                "available_sessions": sessions_list
            },
            status=status.HTTP_403_FORBIDDEN
        )

    subjects_data = []

    for subject in subjects:
        # Get GradeSummary for this student and subject
        try:
            grade_summary = GradeSummary.objects.get(
                student=child,
                subject=subject,
                grading_config=grading_config
            )

            # 1st Test = Attendance + Assignment
            first_test_score = float(grade_summary.attendance_score) + float(grade_summary.assignment_score)

            # 2nd Test = Test score
            second_test_score = float(grade_summary.test_score)

            # Exam = Exam score
            exam_score = float(grade_summary.exam_score)

            # Total
            total_score = float(grade_summary.total_score)

            # Get report sheet grade
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
    all_students = StudentSession.objects.filter(
        class_session=class_session,
        is_active=True
    ).select_related('student')

    student_averages = []
    for ss in all_students:
        student_subjects = Subject.objects.filter(class_session=class_session)
        if ss.student.department:
            student_subjects = student_subjects.filter(
                Q(department=ss.student.department) | Q(department='General')
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
    position = next((i + 1 for i, s in enumerate(student_averages) if s['student_id'] == child.id), None)

    # Student photo URL - Cloudinary URL is already absolute
    photo_url = None
    if hasattr(child, 'profile_picture') and child.profile_picture:
        photo_url = child.profile_picture.url

    # Get all children for dropdown
    children_list = [{
        'id': c.id,
        'full_name': c.get_full_name(),
        'username': c.username,
        'classroom': c.classroom.name if c.classroom else None
    } for c in children]

    # Get available sessions for this child
    available_sessions = StudentSession.objects.filter(
        student=child
    ).select_related('class_session').values(
        'class_session__academic_year',
        'class_session__term'
    ).distinct().order_by('-class_session__academic_year', 'class_session__term')

    sessions_list = [{
        'academic_year': session['class_session__academic_year'],
        'term': session['class_session__term']
    } for session in available_sessions]

    school = parent.school
    school_logo_url = None
    if school and school.logo:
        school_logo_url = request.build_absolute_uri(school.logo.url)

    return Response({
        'school_name': school.name if school else '',
        'school_logo': school_logo_url,
        'student': {
            'id': child.id,
            'student_id': child.username,
            'name': child.get_full_name(),
            'class': class_session.classroom.name,
            'department': child.department or '',
            'photo_url': photo_url
        },
        'session': {
            'academic_year': academic_year,
            'term': term
        },
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
        'children': children_list,
        'available_sessions': sessions_list
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_grade_report(request):
    """
    Get grade report (report sheet) for student.

    Query Parameters:
    - academic_year: Academic year (optional) - defaults to current session
    - term: Term (optional) - defaults to current session

    Returns complete report sheet with all subjects, scores, and grades.
    """
    from schooladmin.models import GradeSummary, GradingConfiguration
    from academics.models import Subject
    from django.db.models import Q

    student = request.user

    # Verify user is a student
    if student.role != 'student':
        return Response(
            {"detail": "Only students can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get academic_year and term from query params or use current session
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    # If not provided, default to student's current ACTIVE session
    if not academic_year or not term:
        current_session = StudentSession.objects.filter(
            student=student,
            is_active=True
        ).select_related('class_session').first()

        if current_session:
            academic_year = current_session.class_session.academic_year
            term = current_session.class_session.term
        else:
            # If no active session, fall back to most recent session
            current_session = StudentSession.objects.filter(
                student=student
            ).select_related('class_session').order_by(
                '-class_session__academic_year', '-class_session__term'
            ).first()

            if current_session:
                academic_year = current_session.class_session.academic_year
                term = current_session.class_session.term
            else:
                return Response(
                    {"detail": "No session found for student"},
                    status=status.HTTP_404_NOT_FOUND
                )

    # Get the student's class session for this academic year and term (allow historical)
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

    # Security check: Verify report has been released and fees are paid
    from schooladmin.models import StudentFeeRecord

    # Check if report has been released
    if not student_session.report_sent:
        # Get all available sessions for filter options (include historical)
        all_sessions = StudentSession.objects.filter(
            student=student
        ).select_related('class_session').order_by(
            '-class_session__academic_year', '-class_session__term'
        )
        available_sessions = [
            {
                'academic_year': ss.class_session.academic_year,
                'term': ss.class_session.term
            }
            for ss in all_sessions
        ]
        return Response(
            {
                "detail": "Report sheet has not been released yet. Please check back later.",
                "available_sessions": available_sessions
            },
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
                # Get all available sessions for filter options (include historical)
                all_sessions = StudentSession.objects.filter(
                    student=student
                ).select_related('class_session').order_by(
                    '-class_session__academic_year', '-class_session__term'
                )
                available_sessions = [
                    {
                        'academic_year': ss.class_session.academic_year,
                        'term': ss.class_session.term
                    }
                    for ss in all_sessions
                ]
                return Response(
                    {
                        "detail": "Report sheet access denied. Please complete your fee payment first.",
                        "available_sessions": available_sessions
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
    else:
        # No fee records - fees not set up
        all_sessions = StudentSession.objects.filter(
            student=student
        ).select_related('class_session').order_by(
            '-class_session__academic_year', '-class_session__term'
        )
        available_sessions = [
            {
                'academic_year': ss.class_session.academic_year,
                'term': ss.class_session.term
            }
            for ss in all_sessions
        ]
        return Response(
            {
                "detail": "Report sheet access denied. Fee records not found.",
                "available_sessions": available_sessions
            },
            status=status.HTTP_403_FORBIDDEN
        )

    # Get grading configuration (allow historical access)
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

    # Get all subjects for this student
    subjects = Subject.objects.filter(
        class_session=class_session
    ).select_related('teacher')

    # Filter by department if student has one
    if student.department:
        subjects = subjects.filter(
            Q(department=student.department) | Q(department='General')
        )

    # Get available sessions for this student (needed for filters even if grades incomplete)
    available_sessions = StudentSession.objects.filter(
        student=student
    ).select_related('class_session').values(
        'class_session__academic_year',
        'class_session__term'
    ).distinct().order_by('-class_session__academic_year', 'class_session__term')

    sessions_list = [{
        'academic_year': session['class_session__academic_year'],
        'term': session['class_session__term']
    } for session in available_sessions]

    # Check if ALL subjects have COMPLETE grades before showing report
    # Complete means: Test 1 (attendance + assignment), Test 2 (test), Exam, and Total are all filled
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

            # Test 1 = attendance + assignment (must be > 0)
            test1_complete = (attendance_score + assignment_score) > 0
            # Test 2 = test score (must be > 0)
            test2_complete = test_score > 0
            # Exam (must be > 0)
            exam_complete = exam_score > 0
            # Total (must be > 0)
            total_complete = total_score > 0

            # If any component is missing, grades are incomplete
            if not (test1_complete and test2_complete and exam_complete and total_complete):
                grades_complete = False
                break

        except GradeSummary.DoesNotExist:
            # No grade summary = grades incomplete
            grades_complete = False
            break

    # If grades are not complete, do not show the report
    # But still return filter data so students can check other sessions
    if not grades_complete:
        return Response(
            {
                "detail": "Report sheet is not available. Grades are incomplete for this session.",
                "available_sessions": sessions_list
            },
            status=status.HTTP_403_FORBIDDEN
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

            # Total
            total_score = float(grade_summary.total_score)

            # Get report sheet grade
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
    all_students = StudentSession.objects.filter(
        class_session=class_session,
        is_active=True
    ).select_related('student')

    student_averages = []
    for ss in all_students:
        student_subjects = Subject.objects.filter(class_session=class_session)
        if ss.student.department:
            student_subjects = student_subjects.filter(
                Q(department=ss.student.department) | Q(department='General')
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
    position = next((i + 1 for i, s in enumerate(student_averages) if s['student_id'] == student.id), None)

    # Student photo URL - Cloudinary URL is already absolute
    photo_url = None
    if hasattr(student, 'profile_picture') and student.profile_picture:
        photo_url = student.profile_picture.url

    # Get available sessions for this student
    available_sessions = StudentSession.objects.filter(
        student=student
    ).select_related('class_session').values(
        'class_session__academic_year',
        'class_session__term'
    ).distinct().order_by('-class_session__academic_year', 'class_session__term')

    sessions_list = [{
        'academic_year': session['class_session__academic_year'],
        'term': session['class_session__term']
    } for session in available_sessions]

    school = student.school
    school_logo_url = None
    if school and school.logo:
        school_logo_url = request.build_absolute_uri(school.logo.url)

    return Response({
        'school_name': school.name if school else '',
        'school_logo': school_logo_url,
        'student': {
            'id': student.id,
            'student_id': student.username,
            'name': student.get_full_name(),
            'class': class_session.classroom.name,
            'department': student.department or '',
            'photo_url': photo_url
        },
        'session': {
            'academic_year': academic_year,
            'term': term
        },
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
        'available_sessions': sessions_list
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_avatar(request):
    """
    Allow users to upload their own avatar/profile picture.
    This is separate from the admin-controlled profile_picture used for report sheets.
    """
    user = request.user

    if 'avatar' not in request.FILES:
        return Response(
            {"detail": "No avatar file provided"},
            status=status.HTTP_400_BAD_REQUEST
        )

    avatar_file = request.FILES['avatar']

    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if avatar_file.content_type not in allowed_types:
        return Response(
            {"detail": "Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate file size (max 100KB)
    if avatar_file.size > 100 * 1024:
        return Response(
            {"detail": "File too large. Maximum size is 100KB."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Delete old avatar if exists
    if user.avatar:
        user.avatar.delete(save=False)

    # Save new avatar
    user.avatar = avatar_file
    user.save()

    # Cloudinary URL is already absolute
    avatar_url = user.avatar.url

    return Response({
        "detail": "Avatar uploaded successfully",
        "avatar_url": avatar_url
    }, status=status.HTTP_200_OK)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_avatar(request):
    """Remove user's avatar"""
    user = request.user

    if user.avatar:
        user.avatar.delete(save=True)
        return Response({"detail": "Avatar removed successfully"}, status=status.HTTP_200_OK)

    return Response({"detail": "No avatar to remove"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user_profile(request):
    """Get current user's profile information including avatar"""
    user = request.user

    # Cloudinary URLs are already absolute
    avatar_url = user.avatar.url if user.avatar else None
    profile_picture_url = user.profile_picture.url if user.profile_picture else None

    return Response({
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'middle_name': user.middle_name or '',
        'email': user.email,
        'role': user.role,
        'avatar_url': avatar_url,
        'profile_picture_url': profile_picture_url,  # Admin-controlled, for reports
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def change_admin_username(request):
    """Allow admin to change their own username"""
    user = request.user
    new_username = request.data.get('new_username')
    current_password = request.data.get('current_password')

    if not new_username or not current_password:
        return Response(
            {'detail': 'Both new_username and current_password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify current password
    if not user.check_password(current_password):
        return Response(
            {'detail': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check if new username already exists
    if CustomUser.objects.filter(username=new_username).exclude(id=user.id).exists():
        return Response(
            {'detail': 'Username already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate username (alphanumeric, underscores only)
    if not new_username.replace('_', '').isalnum():
        return Response(
            {'detail': 'Username can only contain letters, numbers, and underscores'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Update username
    old_username = user.username
    user.username = new_username
    user.save()

    return Response({
        'detail': 'Username updated successfully',
        'old_username': old_username,
        'new_username': new_username
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def change_admin_password(request):
    """Allow admin to change their own password"""
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not current_password or not new_password or not confirm_password:
        return Response(
            {'detail': 'All fields (current_password, new_password, confirm_password) are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify current password
    if not user.check_password(current_password):
        return Response(
            {'detail': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check if new passwords match
    if new_password != confirm_password:
        return Response(
            {'detail': 'New passwords do not match'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate password strength
    if len(new_password) < 8:
        return Response(
            {'detail': 'Password must be at least 8 characters long'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check for at least one uppercase, one lowercase, and one number
    has_upper = any(c.isupper() for c in new_password)
    has_lower = any(c.islower() for c in new_password)
    has_digit = any(c.isdigit() for c in new_password)

    if not (has_upper and has_lower and has_digit):
        return Response(
            {'detail': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Update password
    user.set_password(new_password)
    user.save()

    return Response({
        'detail': 'Password updated successfully. Please login again with your new password.'
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Allow any authenticated user (student, parent, teacher) to change their own password"""
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not current_password or not new_password or not confirm_password:
        return Response(
            {'detail': 'All fields (current_password, new_password, confirm_password) are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify current password
    if not user.check_password(current_password):
        return Response(
            {'detail': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check if new passwords match
    if new_password != confirm_password:
        return Response(
            {'detail': 'New passwords do not match'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate password strength
    if len(new_password) < 8:
        return Response(
            {'detail': 'Password must be at least 8 characters long'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check for at least one uppercase, one lowercase, and one number
    has_upper = any(c.isupper() for c in new_password)
    has_lower = any(c.islower() for c in new_password)
    has_digit = any(c.isdigit() for c in new_password)

    if not (has_upper and has_lower and has_digit):
        return Response(
            {'detail': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Update password
    user.set_password(new_password)
    user.save()

    return Response({
        'detail': 'Password updated successfully. Please login again with your new password.'
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def initialize_admin(request):
    """
    ONE-TIME USE ONLY: Initialize default admin user
    Visit this URL ONCE to create admin: /api/users/initialize-admin/
    After admin is created, this endpoint becomes disabled
    """
    # Check if admin already exists
    if CustomUser.objects.filter(username='admin').exists():
        return Response({
            'status': 'error',
            'message': '❌ Admin user already exists! This endpoint is disabled.',
            'next_step': 'Login with username: admin'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Create admin user
    try:
        admin_user = CustomUser.objects.create_user(
            username='admin',
            email='admin@admin.local',
            password='Admin@2024',
            first_name='Admin',
            last_name='User'
        )
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.role = 'admin'
        admin_user.save()

        return Response({
            'status': 'success',
            'message': '✅ Admin user created successfully!',
            'credentials': {
                'username': 'admin',
                'email': 'admin@admin.local',
                'password': 'Admin@2024',
                'warning': '⚠️ CHANGE THIS PASSWORD IMMEDIATELY after first login!'
            },
            'next_steps': [
                '1. Go to your login page',
                '2. Login with the credentials above',
                '3. Change your password immediately in settings',
                '4. This endpoint is now permanently disabled'
            ]
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({
            'status': 'error',
            'message': f'Failed to create admin: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def initialize_admin_2(request):
    """ONE-TIME USE: Create second admin user"""
    username = 'admin2'
    
    if CustomUser.objects.filter(username=username).exists():
        return Response({
            'status': 'error',
            'message': f'❌ Admin user "{username}" already exists! Endpoint disabled.',
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        admin_user = CustomUser.objects.create_user(
            username=username,
            email='admin2@admin.local',
            password='Admin2@2024',
            first_name='Admin',
            last_name='Two'
        )
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.role = 'admin'
        admin_user.save()

        return Response({
            'status': 'success',
            'message': '✅ Admin 2 created successfully!',
            'credentials': {
                'username': 'admin2',
                'email': 'admin2@admin.local',
                'password': 'Admin2@2024'
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def initialize_admin_3(request):
    """ONE-TIME USE: Create third admin user"""
    username = 'admin3'
    
    if CustomUser.objects.filter(username=username).exists():
        return Response({
            'status': 'error',
            'message': f'❌ Admin user "{username}" already exists! Endpoint disabled.',
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        admin_user = CustomUser.objects.create_user(
            username=username,
            email='admin3@admin.local',
            password='Admin3@2024',
            first_name='Admin',
            last_name='Three'
        )
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.role = 'admin'
        admin_user.save()

        return Response({
            'status': 'success',
            'message': '✅ Admin 3 created successfully!',
            'credentials': {
                'username': 'admin3',
                'email': 'admin3@admin.local',
                'password': 'Admin3@2024'
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def initialize_admin_4(request):
    """ONE-TIME USE: Create fourth admin user"""
    username = 'admin4'
    
    if CustomUser.objects.filter(username=username).exists():
        return Response({
            'status': 'error',
            'message': f'❌ Admin user "{username}" already exists! Endpoint disabled.',
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        admin_user = CustomUser.objects.create_user(
            username=username,
            email='admin4@admin.local',
            password='Admin4@2024',
            first_name='Admin',
            last_name='Four'
        )
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.role = 'admin'
        admin_user.save()

        return Response({
            'status': 'success',
            'message': '✅ Admin 4 created successfully!',
            'credentials': {
                'username': 'admin4',
                'email': 'admin4@admin.local',
                'password': 'Admin4@2024'
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# NEVER LOGGED IN
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_never_logged_in(request):
    """
    GET /api/<school_slug>/users/never-logged-in/?role=student
    Returns users in this school who have never logged in (last_login is null).
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    role = request.query_params.get('role', '').strip()
    valid_roles = {'student', 'teacher', 'parent', 'principal'}

    qs = CustomUser.objects.filter(school=school, last_login__isnull=True, is_active=True)
    if role and role in valid_roles:
        qs = qs.filter(role=role)

    data = []
    for user in qs.order_by('first_name', 'last_name'):
        data.append({
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'username': user.username,
            'email': user.email or '',
            'role': user.role,
            'date_joined': user.date_joined.strftime('%Y-%m-%d') if user.date_joined else '',
            'has_email': bool(user.email),
        })

    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminRole])
def send_login_reminder(request):
    """
    POST /api/<school_slug>/users/send-login-reminder/
    Sends (or re-sends) the verification/welcome email to one or more users.
    Body: { "user_id": 1 }  OR  { "user_ids": [1, 2, 3] }
    """
    import secrets as _secrets
    from django.utils import timezone as _tz
    from django.conf import settings as _settings
    from logs.email_service import send_verification_email

    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    user_id = request.data.get('user_id')
    user_ids = request.data.get('user_ids')

    if user_id:
        user_ids = [user_id]
    elif not user_ids:
        return Response({'error': 'user_id or user_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

    users = list(CustomUser.objects.filter(id__in=user_ids, school=school, is_active=True))
    users_with_email = [u for u in users if u.email]

    # Upfront quota check
    subscription = getattr(school, 'subscription', None)
    if subscription:
        plan = subscription.plan
        if plan.max_daily_emails > 0:
            remaining = max(0, plan.max_daily_emails - subscription.emails_sent_today)
            requested = len(users_with_email)
            if remaining == 0:
                return Response({
                    'error': (
                        f"You have reached your daily email limit of {plan.max_daily_emails} emails. "
                        f"Your quota resets tomorrow. Upgrade your plan for higher limits."
                    ),
                    'quota_exceeded': True,
                    'daily_limit': plan.max_daily_emails,
                    'emails_remaining': 0,
                }, status=status.HTTP_403_FORBIDDEN)
            if requested > remaining:
                return Response({
                    'error': (
                        f"You are trying to send {requested} reminder emails, but you only have "
                        f"{remaining} email(s) remaining in your daily quota of {plan.max_daily_emails}. "
                        f"Send {remaining} now, or wait until tomorrow when your quota resets."
                    ),
                    'quota_exceeded': True,
                    'daily_limit': plan.max_daily_emails,
                    'emails_remaining': remaining,
                    'requested': requested,
                }, status=status.HTTP_403_FORBIDDEN)

    sent = []
    skipped = []

    for user in users:
        if not user.email:
            skipped.append({'id': user.id, 'name': f"{user.first_name} {user.last_name}", 'reason': 'No email address'})
            continue

        try:
            from tenants.permissions import check_email_limit
            if not check_email_limit(school):
                skipped.append({'id': user.id, 'name': f"{user.first_name} {user.last_name}", 'reason': 'Daily email quota reached mid-send'})
                continue

            token = _secrets.token_urlsafe(32)
            user.email_verification_token = token
            user.email_verification_sent_at = _tz.now()
            user.must_change_password = True
            user.save(update_fields=['email_verification_token', 'email_verification_sent_at', 'must_change_password'])

            verification_url = f"{_settings.FRONTEND_URL}/verify-email/{token}"
            send_verification_email(user, verification_url)

            sent.append({'id': user.id, 'name': f"{user.first_name} {user.last_name}", 'email': user.email})
        except Exception as e:
            skipped.append({'id': user.id, 'name': f"{user.first_name} {user.last_name}", 'reason': str(e)})

    ActivityLog.objects.create(
        user=request.user,
        role='admin',
        action=f"{request.user.username} sent login reminders to {len(sent)} user(s)"
    )

    return Response({
        'sent_count': len(sent),
        'skipped_count': len(skipped),
        'sent': sent,
        'skipped': skipped,
    })
