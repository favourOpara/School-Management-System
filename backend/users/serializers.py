from rest_framework import serializers
from .models import CustomUser
from academics.models import ClassSession

class UserCreateSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True, required=True)
    class_session = serializers.PrimaryKeyRelatedField(queryset=ClassSession.objects.all())

    class Meta:
        model = CustomUser
        fields = [
            'username', 'password', 'confirm_password',
            'email', 'first_name', 'middle_name', 'last_name',
            'role', 'gender', 'class_session', 'academic_year', 'date_of_birth'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'date_of_birth': {'required': True}
        }

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        return CustomUser.objects.create_user(**validated_data)


class TeacherSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['username', 'password', 'email', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data['role'] = 'teacher'
        return CustomUser.objects.create_user(**validated_data)


class ParentSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['username', 'password', 'email', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data['role'] = 'parent'
        return CustomUser.objects.create_user(**validated_data)


# ✅ For dropdowns, tables etc.
class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name',
            'middle_name', 'last_name', 'role'
        ]
