from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Class, ClassSession, Subject
from .serializers import ClassSerializer, ClassSessionSerializer, SubjectSerializer


# 🔹 Admin-only: Create/List permanent classes (e.g., "J.S.S.1", "S.S.S.3")
class ClassListCreateView(generics.ListCreateAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAdminUser]


# 🔹 Admin-only: Retrieve, update, or delete a specific Class
class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# 🔹 Admin-only: Create/List academic ClassSessions (e.g., J.S.S.1 - 2024/2025 - First Term)
class ClassSessionListCreateView(generics.ListCreateAPIView):
    queryset = ClassSession.objects.all()
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAdminUser]

    def create(self, request, *args, **kwargs):
        classroom_id = request.data.get('classroom')
        academic_year = request.data.get('academic_year')
        term = request.data.get('term')

        # Prevent duplicate sessions for the same class, year, and term
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


# 🔹 Admin-only: Retrieve, update, delete a specific ClassSession
class ClassSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClassSession.objects.all()
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# 🔹 Admin-only: Create subject (must link to valid class session + teacher)
class SubjectCreateView(generics.CreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAdminUser]


# 🔹 Authenticated: View all subjects (optionally filterable later)
class SubjectListView(generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]
