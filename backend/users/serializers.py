from rest_framework import serializers
from .models import CustomUser
from academics.models import Class

# 🔹 Used for Admin-created students and parents
class UserCreateSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True, required=True)
    classroom = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all())

    class Meta:
        model = CustomUser
        fields = [
            'username', 'password', 'confirm_password', 'first_name', 'middle_name', 'last_name',
            'role', 'gender', 'classroom', 'academic_year', 'date_of_birth'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'date_of_birth': {'required': True},
        }

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        return CustomUser.objects.create_user(**validated_data)


# 🔹 Admin creates teacher (NO email)
class TeacherSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['username', 'password', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data['role'] = 'teacher'
        return CustomUser.objects.create_user(**validated_data)


# 🔹 Admin creates parent (NO email)
class ParentSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['username', 'password', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data['role'] = 'parent'
        return CustomUser.objects.create_user(**validated_data)


# 🔹 For dropdowns, views, and listing users
class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'first_name',
            'middle_name', 'last_name', 'role'
        ]
