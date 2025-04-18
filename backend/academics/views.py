from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ClassRoom
from .serializers import ClassRoomSerializer

class ClassRoomListCreateView(generics.ListCreateAPIView):
    queryset = ClassRoom.objects.all()
    serializer_class = ClassRoomSerializer
    permission_classes = [permissions.IsAdminUser]

    def create(self, request, *args, **kwargs):
        name = request.data.get('name')
        academic_year = request.data.get('academic_year')
        term = request.data.get('term')

        if ClassRoom.objects.filter(name=name, academic_year=academic_year, term=term).exists():
            return Response(
                {'detail': 'Class with this name, academic year, and term already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().create(request, *args, **kwargs)

class ClassRoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClassRoom.objects.all()
    serializer_class = ClassRoomSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'
