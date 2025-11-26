from rest_framework import serializers
from .models import CustomUser
from academics.models import Class, Subject
from PIL import Image
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile
import sys

# 🔹 Used for Admin-created students, parents and editing users
class UserCreateSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True, required=False)
    classroom = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all(), required=False, allow_null=True)
    department = serializers.CharField(required=False, allow_blank=True)
    profile_picture = serializers.ImageField(required=False, allow_null=True)
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
            'date_of_birth', 'department', 'profile_picture',
            'email', 'phone_number', 'children'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},  # Required for email notifications
            'phone_number': {'required': False},
            'date_of_birth': {'required': False},
        }

    def validate_profile_picture(self, value):
        """Validate and resize profile picture to fit report sheet requirements"""
        if value:
            # Check file size (max 100KB)
            if value.size > 100 * 1024:  # 100KB in bytes
                raise serializers.ValidationError("Image file size must not exceed 100KB.")

            # Open image and resize to report sheet dimensions (120x150px)
            try:
                img = Image.open(value)

                # Convert RGBA to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background

                # Resize to fit 120x150 maintaining aspect ratio, then crop
                target_width, target_height = 120, 150
                img_ratio = img.width / img.height
                target_ratio = target_width / target_height

                if img_ratio > target_ratio:
                    # Image is wider, scale by height
                    new_height = target_height
                    new_width = int(target_height * img_ratio)
                else:
                    # Image is taller, scale by width
                    new_width = target_width
                    new_height = int(target_width / img_ratio)

                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                # Crop to exact dimensions (center crop)
                left = (new_width - target_width) // 2
                top = (new_height - target_height) // 2
                img = img.crop((left, top, left + target_width, top + target_height))

                # Save optimized image
                output = BytesIO()
                img.save(output, format='JPEG', quality=85, optimize=True)
                output.seek(0)

                # Create new InMemoryUploadedFile
                return InMemoryUploadedFile(
                    output, 'ImageField',
                    f"{value.name.split('.')[0]}.jpg",
                    'image/jpeg',
                    sys.getsizeof(output), None
                )
            except Exception as e:
                raise serializers.ValidationError(f"Invalid image file: {str(e)}")

        return value

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


# 🔹 Admin creates teacher (WITH email and phone - REQUIRED for email notifications)
class TeacherSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['username', 'password', 'first_name', 'last_name', 'email', 'phone_number']
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'phone_number': {'required': False},
        }

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
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'full_name', 'middle_name', 'gender',
            'academic_year', 'term', 'age', 'classroom', 'parent',
            'password', 'department', 'profile_picture'
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

    def get_profile_picture(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
        return None


# 🔹 NEW: Teacher detail listing for ViewUsers table
class TeacherDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    assigned_subjects = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'first_name', 'last_name', 'full_name',
            'gender', 'email', 'phone_number', 'assigned_subjects'
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    def get_assigned_subjects(self, obj):
        subjects = Subject.objects.filter(teacher=obj).select_related('class_session__classroom')
        
        subject_list = []
        for subject in subjects:
            subject_list.append({
                'id': subject.id,
                'name': subject.name,
                'department': subject.department,
                'classroom': subject.class_session.classroom.name if subject.class_session.classroom else None,
                'academic_year': subject.class_session.academic_year,
                'term': subject.class_session.term,
            })
        
        return subject_list