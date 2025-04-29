from rest_framework import serializers
from .models import CustomUser
from academics.models import Class

# 🔹 Used for Admin-created students, parents and editing users
class UserCreateSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True, required=False)
    classroom = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all(), required=False, allow_null=True)
    department = serializers.CharField(required=False, allow_blank=True)
    children = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role='student'),
        many=True,
        required=False
    )

    class Meta:
        model = CustomUser
        fields = [
            'username', 'password', 'confirm_password', 'first_name', 'middle_name', 'last_name',
            'role', 'gender', 'classroom', 'academic_year', 'term',
            'date_of_birth', 'department',
            'email', 'phone_number', 'children'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': False},
            'phone_number': {'required': False},
            'date_of_birth': {'required': False},
        }

    def validate(self, data):
        password = data.get('password')
        confirm_password = data.get('confirm_password')

        if password and confirm_password and password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        children = validated_data.pop('children', [])

        user = CustomUser.objects.create_user(**validated_data)

        if user.role == 'parent' and children:
            user.children.set(children)

        return user

    def update(self, instance, validated_data):
        validated_data.pop('confirm_password', None)
        children = validated_data.pop('children', None)

        for attr, value in validated_data.items():
            if attr == 'password':
                instance.set_password(value)
            else:
                setattr(instance, attr, value)

        if instance.role == 'parent' and children is not None:
            instance.children.set(children)

        instance.save()
        return instance


# 🔹 Admin creates teacher (NO email or phone)
class TeacherSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['username', 'password', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data['role'] = 'teacher'
        return CustomUser.objects.create_user(**validated_data)


# 🔹 Admin creates parent (WITH email, phone, and children)
class ParentSignupSerializer(serializers.ModelSerializer):
    children = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role='student'),
        many=True,
        required=False
    )

    class Meta:
        model = CustomUser
        fields = [
            'username', 'password', 'first_name', 'last_name', 'email',
            'phone_number', 'children'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'phone_number': {'required': True},
        }

    def create(self, validated_data):
        children = validated_data.pop('children', [])
        validated_data['role'] = 'parent'
        parent = CustomUser.objects.create_user(**validated_data)
        if children:
            parent.children.set(children)
        return parent


# 🔹 For dropdowns, views, and listing users
class UserListSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'first_name',
            'middle_name', 'last_name', 'role', 'children'
        ]

    def get_children(self, obj):
        if obj.role == 'parent':
            return [
                {
                    'id': child.id,
                    'username': child.username,
                    'full_name': f"{child.first_name} {child.last_name}"
                }
                for child in obj.children.all()
            ]
        return []


# 🔹 Student detail listing for ViewUsers table
class StudentDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    classroom = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    password = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'full_name', 'middle_name', 'gender',
            'academic_year', 'term', 'age', 'classroom', 'parent',
            'password', 'department'
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    def get_classroom(self, obj):
        if obj.classroom:
            return {
                'id': obj.classroom.id,
                'name': obj.classroom.name
            }
        return None

    def get_parent(self, obj):
        parent = CustomUser.objects.filter(children__id=obj.id).first()
        if parent:
            return {
                'full_name': f"{parent.first_name} {parent.last_name}",
                'phone_number': parent.phone_number,
                'email': parent.email
            }
        return None

    def get_age(self, obj):
        if obj.date_of_birth:
            from datetime import date
            today = date.today()
            return today.year - obj.date_of_birth.year - (
                (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
            )
        return None

    def get_password(self, obj):
        request = self.context.get('request')
        if request and request.user.role == 'admin':
            return obj.password
        return None
