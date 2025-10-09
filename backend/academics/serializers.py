from rest_framework import serializers
from .models import Class, ClassSession, Subject, SubjectContent, ContentFile, StudentContentView
from users.models import CustomUser
import re
from django.utils import timezone


class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'name', 'description']


class ClassSessionSerializer(serializers.ModelSerializer):
    classroom = ClassSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(),
        source='classroom',
        write_only=True
    )
    name = serializers.CharField(source='classroom.name', read_only=True)

    class Meta:
        model = ClassSession
        fields = ['id', 'name', 'academic_year', 'term', 'classroom', 'classroom_id']

    def validate_academic_year(self, value):
        pattern = r'^(\d{4})\/(\d{4})$'
        match = re.match(pattern, value)
        if not match:
            raise serializers.ValidationError("Academic year must be in format YYYY/YYYY.")
        start, end = int(match.group(1)), int(match.group(2))
        if end != start + 1:
            raise serializers.ValidationError("Second year must be exactly one year after the first.")
        return value


class SubjectSerializer(serializers.ModelSerializer):
    class_session = ClassSessionSerializer(read_only=True)
    class_session_id = serializers.PrimaryKeyRelatedField(
        queryset=ClassSession.objects.all(),
        source='class_session',
        write_only=True,
        required=False
    )
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role='teacher'),
        required=False
    )
    teacher_name = serializers.CharField(source='teacher.username', read_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'class_session', 'class_session_id', 'teacher', 'teacher_name', 'department']

    def validate_teacher(self, teacher):
        if teacher and teacher.role != 'teacher':
            raise serializers.ValidationError("Assigned user must be a teacher.")
        return teacher

    def to_representation(self, instance):
        """Custom representation for read operations"""
        representation = super().to_representation(instance)
        
        if instance.teacher:
            representation['teacher_full_name'] = f"{instance.teacher.first_name} {instance.teacher.last_name}"
        else:
            representation['teacher_full_name'] = "Not Assigned"
            
        return representation

    def update(self, instance, validated_data):
        """Handle partial updates properly"""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


# UPDATED: Use created_by instead of teacher

class ContentFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ContentFile
        fields = [
            'id', 'file', 'original_name', 'file_size', 'content_type_mime',
            'uploaded_at', 'is_active', 'file_url', 'formatted_file_size'
        ]
        read_only_fields = ['uploaded_at', 'formatted_file_size']
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class SubjectContentSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    created_by_full_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    classroom_name = serializers.CharField(source='subject.class_session.classroom.name', read_only=True)
    content_type_display = serializers.CharField(source='get_content_type_display', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    files = ContentFileSerializer(many=True, read_only=True)
    file_count = serializers.ReadOnlyField()
    current_teacher = serializers.SerializerMethodField()
    
    class Meta:
        model = SubjectContent
        fields = [
            'id', 'subject', 'created_by', 'content_type', 'title', 'description', 
            'created_at', 'updated_at', 'is_active', 'due_date', 'max_score',
            'created_by_username', 'created_by_full_name', 'subject_name', 'classroom_name',
            'content_type_display', 'is_overdue', 'files', 'file_count', 'current_teacher'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def get_created_by_full_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}"
        return "Unknown"
    
    def get_current_teacher(self, obj):
        """Get the current teacher assigned to this subject"""
        if obj.subject.teacher:
            return {
                'id': obj.subject.teacher.id,
                'username': obj.subject.teacher.username,
                'full_name': f"{obj.subject.teacher.first_name} {obj.subject.teacher.last_name}"
            }
        return None
    
    def get_is_overdue(self, obj):
        """Check if assignment is overdue"""
        if obj.content_type == 'assignment' and obj.due_date:
            return timezone.now() > obj.due_date
        return False
    
    def validate_due_date(self, value):
        """Ensure due date is in the future for new assignments"""
        if value and value <= timezone.now():
            raise serializers.ValidationError("Due date must be in the future.")
        return value
    
    def validate(self, data):
        """Cross-field validation"""
        # For assignments, due_date is required
        if data.get('content_type') == 'assignment' and not data.get('due_date'):
            raise serializers.ValidationError({
                'due_date': 'Due date is required for assignments.'
            })
        
        return data
    
    def create(self, validated_data):
        # Automatically set created_by to the requesting user
        request = self.context.get('request')
        if request:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class SubjectContentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating content with multiple files"""
    
    class Meta:
        model = SubjectContent
        fields = [
            'subject', 'content_type', 'title', 'description', 
            'due_date', 'max_score'
        ]
    
    def validate_due_date(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("Due date must be in the future.")
        return value
    
    def validate(self, data):
        # For assignments, due_date is required
        if data.get('content_type') == 'assignment' and not data.get('due_date'):
            raise serializers.ValidationError({
                'due_date': 'Due date is required for assignments.'
            })
        
        # Check if user is assigned to this subject or is admin
        subject = data.get('subject')
        request = self.context.get('request')
        if request and subject:
            user = request.user
            if user.role == 'teacher' and subject.teacher != user:
                raise serializers.ValidationError({
                    'subject': 'You can only create content for subjects assigned to you.'
                })
        
        return data
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request:
            validated_data['created_by'] = request.user
        
        # Create the content instance
        content = super().create(validated_data)
        
        # Handle multiple file uploads
        files = request.FILES
        for key, uploaded_file in files.items():
            if key.startswith('file_'):
                ContentFile.objects.create(
                    content=content,
                    file=uploaded_file,
                    original_name=uploaded_file.name,
                    file_size=uploaded_file.size,
                    content_type_mime=uploaded_file.content_type
                )
        
        return content


class StudentContentViewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.SerializerMethodField()
    content_title = serializers.CharField(source='content.title', read_only=True)
    
    class Meta:
        model = StudentContentView
        fields = [
            'id', 'student', 'content', 'viewed_at',
            'student_name', 'student_full_name', 'content_title'
        ]
        read_only_fields = ['viewed_at']
    
    def get_student_full_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else "Unknown Student"


# SPECIALIZED SERIALIZERS FOR DIFFERENT CONTENT TYPES

class AssignmentSerializer(SubjectContentSerializer):
    """Specialized serializer for assignments"""
    
    class Meta(SubjectContentSerializer.Meta):
        model = SubjectContent
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'due_date' in self.fields:
            self.fields['due_date'].required = True
        if 'max_score' in self.fields:
            self.fields['max_score'].required = True


class NoteSerializer(SubjectContentSerializer):
    """Specialized serializer for class notes"""
    
    class Meta(SubjectContentSerializer.Meta):
        model = SubjectContent
        exclude = ['due_date', 'max_score']


class AnnouncementSerializer(SubjectContentSerializer):
    """Specialized serializer for announcements"""
    
    class Meta(SubjectContentSerializer.Meta):
        model = SubjectContent
        exclude = ['due_date', 'max_score']