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


# 🔹 Admin-only: Create/List academic ClassSessions
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


# 🔹 Admin-only: Retrieve/update/delete a specific ClassSession
class ClassSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClassSession.objects.all()
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'


# 🔹 Admin-only: Create/list subjects (accepts list format for bulk)
class SubjectListCreateView(generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAdminUser]

    def create(self, request, *args, **kwargs):
        data = request.data

        # ✅ Handle list of subjects
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

        # ✅ Handle single subject
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


# 🔹 Authenticated users can view all subjects
class SubjectListView(generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]


# 🔹 Admin-only: Retrieve, update, or delete a specific subject
class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'
