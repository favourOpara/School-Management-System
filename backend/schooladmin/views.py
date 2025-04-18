from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users.models import CustomUser
from users.serializers import UserCreateSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_users_by_role(request):
    role = request.query_params.get('role')

    if not role:
        return Response({'error': 'Role is required as a query parameter'}, status=400)

    if request.user.role != 'admin':
        return Response({'error': 'Only admins can view users'}, status=403)

    users = CustomUser.objects.filter(role=role)
    serializer = UserCreateSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_students_by_class(request):
    class_id = request.query_params.get('class_id')

    if request.user.role != 'admin':
        return Response({'error': 'Only admins can view students by class'}, status=403)

    if not class_id:
        return Response({'error': 'Missing class_id'}, status=400)

    students = CustomUser.objects.filter(role='student', classroom_id=class_id)
    serializer = UserCreateSerializer(students, many=True)
    return Response(serializer.data)
