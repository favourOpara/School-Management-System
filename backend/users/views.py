from rest_framework import generics, permissions, status
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
)
from academics.models import Subject, StudentSession, ClassSession
from logs.models import ActivityLog
from datetime import date

# Admin-only permission
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

# Custom JWT serializer to include user role and other info in token response
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims to token
        token['role'] = user.role
        token['username'] = user.username
        token['full_name'] = f"{user.first_name} {user.last_name}"
        
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        
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
        
        return data

# Custom login view for all user roles (students, teachers, parents, admins)
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

# Admin creates student or parent - FIXED to always create StudentSession properly
class CreateUserView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def perform_create(self, serializer):
        user = serializer.save()
        
        # If creating a student, automatically create StudentSession record
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
                # Log this error so we know ClassSession is missing
                ActivityLog.objects.create(
                    user=self.request.user,
                    role='error',
                    action=f"ClassSession not found for {user.username}: {user.classroom.name} - {user.academic_year} - {user.term}"
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
        serializer = TeacherSignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
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
        serializer = ParentSignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
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

# List teachers - Admin only
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_teachers(request):
    teachers = CustomUser.objects.filter(role='teacher')
    serializer = UserListSerializer(teachers, many=True)
    return Response(serializer.data)

# List parents - Admin only - UPDATED to handle StudentSession
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_parents(request):
    parents = CustomUser.objects.filter(role='parent')

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
        })

    return Response(response_data)

# List students with filters - Admin only - UPDATED to use StudentSession properly
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_students(request):
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    if academic_year and term:
        # Filter students by session using StudentSession model
        student_sessions = StudentSession.objects.filter(
            class_session__academic_year=academic_year,
            class_session__term=term,
            is_active=True
        ).select_related('student', 'class_session__classroom')
        
        students = [ss.student for ss in student_sessions]
    else:
        # Get all students
        students = CustomUser.objects.filter(role='student')

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

    # Get students through StudentSession model instead of direct user fields
    student_sessions = StudentSession.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term,
        is_active=True
    ).select_related('student', 'class_session__classroom')

    subjects = Subject.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term
    )

    response_data = []
    for student_session in student_sessions:
        student = student_session.student
        classroom = student_session.class_session.classroom

        if not classroom:
            continue

        # Get subjects for class and filter by department
        student_subjects = subjects.filter(class_session__classroom=classroom)
        if classroom.name.startswith('S.S.S.') and student.department:
            student_subjects = student_subjects.filter(department__in=['General', student.department])

        # Calculate student's age
        age = None
        if student.date_of_birth:
            today = date.today()
            age = today.year - student.date_of_birth.year - (
                (today.month, today.day) < (student.date_of_birth.month, student.date_of_birth.day)
            )

        parent = student.parents.first() if hasattr(student, 'parents') and student.parents.exists() else None

        response_data.append({
            'id': student.id,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'middle_name': student.middle_name,
            'full_name': f"{student.first_name} {student.last_name}",
            'username': student.username,
            'gender': student.gender,
            'age': age,
            'classroom': classroom.name if classroom else None,
            'academic_year': academic_year,  # Use the requested academic_year
            'term': term,  # Use the requested term
            'date_of_birth': student.date_of_birth,
            'parent': {
                'full_name': f"{parent.first_name} {parent.last_name}" if parent else None,
                'phone_number': parent.phone_number if parent else None,
                'email': parent.email if parent else None
            } if parent else None,
            'subjects': [
                {
                    'name': subject.name,
                    'department': subject.department
                }
                for subject in student_subjects
            ]
        })

    return Response(response_data)

# Student History - Admin only: Shows complete academic history for all students
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def student_history(request):
    """
    Returns complete academic history for all students showing all sessions they've been enrolled in
    """
    # Get all student sessions (both active and inactive) ordered by student and session
    student_sessions = StudentSession.objects.all().select_related(
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
    try:
        student = CustomUser.objects.get(id=student_id, role='student')
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
    queryset = CustomUser.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    lookup_field = 'pk'

    def perform_update(self, serializer):
        password = self.request.data.get('password')
        instance = serializer.save()

        if password:
            instance.set_password(password)
            instance.save()
        
        # If updating a student's session info, update StudentSession accordingly
        if (instance.role == 'student' and 
            hasattr(instance, 'classroom') and instance.classroom and
            hasattr(instance, 'academic_year') and instance.academic_year and
            hasattr(instance, 'term') and instance.term):
            
            try:
                class_session = ClassSession.objects.get(
                    classroom=instance.classroom,
                    academic_year=instance.academic_year,
                    term=instance.term
                )
                
                # Check if student already has this session active
                existing_session = StudentSession.objects.filter(
                    student=instance,
                    class_session=class_session
                ).first()
                
                if existing_session:
                    # Just ensure it's active
                    if not existing_session.is_active:
                        # Mark other sessions inactive first
                        StudentSession.objects.filter(
                            student=instance,
                            is_active=True
                        ).exclude(id=existing_session.id).update(is_active=False)
                        
                        existing_session.is_active = True
                        existing_session.save()
                else:
                    # Mark previous sessions as inactive
                    StudentSession.objects.filter(
                        student=instance,
                        is_active=True
                    ).update(is_active=False)
                    
                    # Create new session
                    StudentSession.objects.create(
                        student=instance,
                        class_session=class_session,
                        is_active=True
                    )
            except ClassSession.DoesNotExist:
                # Don't deactivate existing sessions if target ClassSession doesn't exist
                pass