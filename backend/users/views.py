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
    UserListSerializer
)

# Custom permission to allow only admins
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


# Create student or parent (by admin)
class CreateUserView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


# Admin creating a teacher
class TeacherSignupView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        serializer = TeacherSignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "Teacher registered successfully.",
                "username": user.username,
                "email": user.email
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Admin creating a parent
class ParentSignupView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        serializer = ParentSignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "Parent registered successfully.",
                "username": user.username,
                "email": user.email
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Logged-in user info
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserCreateSerializer(request.user)
    return Response(serializer.data)


# Admin fetch all teachers
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminRole])
def list_teachers(request):
    teachers = CustomUser.objects.filter(role='teacher')
    serializer = UserListSerializer(teachers, many=True)
    return Response(serializer.data)
