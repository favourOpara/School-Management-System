from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from .models import CustomUser
from .serializers import (
    UserCreateSerializer,
    TeacherSignupSerializer,
    ParentSignupSerializer,
    UserListSerializer,
    StudentDetailSerializer,
)
from academics.models import Subject
from logs.models import ActivityLog
from datetime import date

# ✅ Admin-only permission
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

# ✅ Admin creates student or parent
class CreateUserView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def perform_create(self, serializer):
        user = serializer.save()
        ActivityLog.objects.create(
            user=self.request.user,
            role=user.role,
            action=f"{self.request.user.username} created {user.role} account: {user.username}"
        )

# ✅ Admin creates teacher
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

# ✅ Admin creates parent
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

# ✅ Logged-in user info
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserCreateSerializer(request.user)
    return Response(serializer.data)

# ✅ List teachers
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_teachers(request):
    teachers = CustomUser.objects.filter(role='teacher')
    serializer = UserListSerializer(teachers, many=True)
    return Response(serializer.data)

# ✅ List parents
# ✅ Corrected list_parents view
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_parents(request):
    parents = CustomUser.objects.filter(role='parent')

    response_data = []
    for parent in parents:
        children = parent.children.all()  # Assuming you have related_name='children' set in CustomUser model

        child_list = []
        classroom_name = None

        for child in children:
            child_list.append({
                'id': child.id,
                'username': child.username,
                'full_name': f"{child.first_name} {child.last_name}",
                'classroom': child.classroom.name if child.classroom else None
            })

            # We use first child's classroom if available
            if not classroom_name and child.classroom:
                classroom_name = child.classroom.name

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

# ✅ List students with filters
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_students(request):
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    students = CustomUser.objects.filter(role='student')
    if academic_year:
        students = students.filter(academic_year=academic_year)
    if term:
        students = students.filter(term=term)

    serializer = StudentDetailSerializer(students, many=True)
    return Response(serializer.data)

# ✅ List students and match subjects by department (updated)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def students_with_subjects(request):
    academic_year = request.query_params.get('academic_year')
    term = request.query_params.get('term')

    if not academic_year or not term:
        return Response({'error': 'academic_year and term are required'}, status=400)

    students = CustomUser.objects.filter(role='student', academic_year=academic_year, term=term)
    subjects = Subject.objects.filter(
        class_session__academic_year=academic_year,
        class_session__term=term
    )

    response_data = []
    for student in students:
        if not student.classroom:
            continue

        # Get subjects for class and filter by department
        student_subjects = subjects.filter(class_session__classroom=student.classroom)
        if student.classroom.name.startswith('S.S.S.') and student.department:
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
            'classroom': student.classroom.name if student.classroom else None,
            'academic_year': student.academic_year,
            'term': student.term,
            'date_of_birth': student.date_of_birth,
            'parent': {
                'full_name': f"{parent.first_name} {parent.last_name}" if parent else None,
                'phone_number': parent.phone_number if parent else None,
                'email': parent.email if parent else None
            },
            'subjects': [
                {
                    'name': subject.name,
                    'department': subject.department
                }
                for subject in student_subjects
            ]
        })

    return Response(response_data)

# ✅ Edit / Update / Delete individual user
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
