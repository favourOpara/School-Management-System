from rest_framework import serializers
from .models import (
    FeeStructure, StudentFeeRecord, GradingScale, GradingConfiguration, 
    GradeComponent, StudentGrade, AttendanceRecord, GradeSummary, ConfigurationTemplate
)
from users.models import CustomUser
from academics.models import Class, Subject, ClassSession


# Existing Fee Structure Serializers
class FeeStructureSerializer(serializers.ModelSerializer):
    classes = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Class.objects.all()
    )
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        model = FeeStructure
        fields = '__all__'

    def create(self, validated_data):
        classes = validated_data.pop('classes')
        fee = FeeStructure.objects.create(**validated_data)
        fee.classes.set(classes)

        for class_obj in classes:
            # Ensure class_obj is a real Class instance
            if isinstance(class_obj, int):
                class_obj = Class.objects.get(pk=class_obj)

            students = CustomUser.objects.filter(
                role='student',
                classroom=class_obj,
                academic_year=fee.academic_year
            )
            for student in students:
                StudentFeeRecord.objects.create(
                    student=student,
                    fee_structure=fee,
                    payment_status='UNPAID',
                )

        return fee

    def update(self, instance, validated_data):
        classes = validated_data.pop('classes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if classes is not None:
            instance.classes.set(classes)
        return instance


class StudentFeeRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_name = serializers.CharField(source='fee_structure.name', read_only=True)

    class Meta:
        model = StudentFeeRecord
        fields = [
            'id',
            'student',
            'student_name',
            'fee_structure',
            'fee_name',
            'amount_paid',
            'date_paid',
            'payment_status'
        ]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"


class FeeStudentSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    full_name = serializers.CharField()
    username = serializers.CharField()
    classroom = serializers.CharField(allow_null=True)
    academic_year = serializers.CharField()
    fee_name = serializers.CharField()
    fee_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2)
    outstanding = serializers.DecimalField(max_digits=10, decimal_places=2)


# GRADING SYSTEM SERIALIZERS

class GradingScaleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = GradingScale
        fields = [
            'id', 'name', 'a_min_score', 'b_min_score', 'c_min_score', 'd_min_score',
            'created_by', 'created_by_name', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}"
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class GradeComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeComponent
        fields = ['id', 'component_type', 'percentage_weight', 'max_score', 'description']


class GradingConfigurationSerializer(serializers.ModelSerializer):
    grading_scale_name = serializers.CharField(source='grading_scale.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    copied_from_session = serializers.SerializerMethodField()
    components = GradeComponentSerializer(many=True, read_only=True)
    total_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = GradingConfiguration
        fields = [
            'id', 'academic_year', 'term', 'attendance_percentage', 'assignment_percentage',
            'test_percentage', 'exam_percentage', 'grading_scale', 'grading_scale_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at', 'is_active',
            'copied_from', 'copied_from_session', 'components', 'total_percentage'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'components']
    
    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}"
    
    def get_copied_from_session(self, obj):
        if obj.copied_from:
            return f"{obj.copied_from.academic_year} - {obj.copied_from.term}"
        return None
    
    def get_total_percentage(self, obj):
        return obj.attendance_percentage + obj.assignment_percentage + obj.test_percentage + obj.exam_percentage
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        config = super().create(validated_data)
        
        # Auto-create grade components
        components_data = [
            ('attendance', config.attendance_percentage),
            ('assignment', config.assignment_percentage),
            ('test', config.test_percentage),
            ('exam', config.exam_percentage),
        ]
        
        for component_type, percentage in components_data:
            GradeComponent.objects.create(
                grading_config=config,
                component_type=component_type,
                percentage_weight=percentage,
                max_score=100
            )
        
        return config
    
    def update(self, instance, validated_data):
        # Update configuration
        config = super().update(instance, validated_data)
        
        # Update existing components
        components_update = [
            ('attendance', config.attendance_percentage),
            ('assignment', config.assignment_percentage),
            ('test', config.test_percentage),
            ('exam', config.exam_percentage),
        ]
        
        for component_type, percentage in components_update:
            component = config.components.filter(component_type=component_type).first()
            if component:
                component.percentage_weight = percentage
                component.save()
        
        return config


class StudentGradeSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    component_type = serializers.CharField(source='component.component_type', read_only=True)
    component_percentage = serializers.CharField(source='component.percentage_weight', read_only=True)
    entered_by_name = serializers.SerializerMethodField()
    percentage_score = serializers.ReadOnlyField()
    weighted_score = serializers.ReadOnlyField()
    
    class Meta:
        model = StudentGrade
        fields = [
            'id', 'student', 'student_name', 'subject', 'subject_name', 
            'component', 'component_type', 'component_percentage',
            'score', 'max_possible_score', 'percentage_score', 'weighted_score',
            'entered_by', 'entered_by_name', 'date_entered', 'updated_at',
            'related_content', 'notes'
        ]
        read_only_fields = ['entered_by', 'date_entered', 'updated_at', 'grading_config']
    
    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"
    
    def get_entered_by_name(self, obj):
        return f"{obj.entered_by.first_name} {obj.entered_by.last_name}"
    
    def create(self, validated_data):
        validated_data['entered_by'] = self.context['request'].user
        
        # Auto-set grading_config based on subject's class session
        subject = validated_data['subject']
        try:
            grading_config = GradingConfiguration.objects.get(
                academic_year=subject.class_session.academic_year,
                term=subject.class_session.term,
                is_active=True
            )
            validated_data['grading_config'] = grading_config
        except GradingConfiguration.DoesNotExist:
            raise serializers.ValidationError(
                "No grading configuration found for this academic session. Please set up grading configuration first."
            )
        
        return super().create(validated_data)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='class_session.classroom.name', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'class_session', 'class_name',
            'date', 'is_present', 'time_in', 'time_out', 'notes',
            'recorded_by', 'recorded_by_name', 'recorded_at'
        ]
        read_only_fields = ['recorded_by', 'recorded_at']
    
    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"
    
    def get_recorded_by_name(self, obj):
        return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}"
    
    def create(self, validated_data):
        validated_data['recorded_by'] = self.context['request'].user
        return super().create(validated_data)


class GradeSummarySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    grading_scale_name = serializers.CharField(source='grading_config.grading_scale.name', read_only=True)
    academic_session = serializers.SerializerMethodField()
    
    class Meta:
        model = GradeSummary
        fields = [
            'id', 'student', 'student_name', 'subject', 'subject_name',
            'grading_config', 'grading_scale_name', 'academic_session',
            'attendance_score', 'assignment_score', 'test_score', 'exam_score',
            'total_score', 'letter_grade', 'last_calculated', 'is_final'
        ]
        read_only_fields = ['letter_grade', 'last_calculated']
    
    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"
    
    def get_academic_session(self, obj):
        return f"{obj.grading_config.academic_year} - {obj.grading_config.term}"


class ConfigurationTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    grading_scale_name = serializers.CharField(source='grading_scale.name', read_only=True)
    total_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = ConfigurationTemplate
        fields = [
            'id', 'name', 'description', 'attendance_percentage', 'assignment_percentage',
            'test_percentage', 'exam_percentage', 'grading_scale', 'grading_scale_name',
            'created_by', 'created_by_name', 'created_at', 'is_active', 'total_percentage'
        ]
        read_only_fields = ['created_by', 'created_at']
    
    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}"
    
    def get_total_percentage(self, obj):
        return obj.attendance_percentage + obj.assignment_percentage + obj.test_percentage + obj.exam_percentage
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# Copy Configuration Serializer for API endpoints
class CopyConfigurationSerializer(serializers.Serializer):
    source_config_id = serializers.IntegerField()
    target_academic_year = serializers.CharField(max_length=9)
    target_term = serializers.ChoiceField(choices=[
        ("First Term", "First Term"),
        ("Second Term", "Second Term"),
        ("Third Term", "Third Term"),
    ])
    
    def validate(self, data):
        # Check if source config exists
        try:
            source_config = GradingConfiguration.objects.get(id=data['source_config_id'])
        except GradingConfiguration.DoesNotExist:
            raise serializers.ValidationError("Source configuration not found")
        
        # Check if target session already has a configuration
        if GradingConfiguration.objects.filter(
            academic_year=data['target_academic_year'],
            term=data['target_term']
        ).exists():
            raise serializers.ValidationError(
                f"Configuration already exists for {data['target_academic_year']} - {data['target_term']}"
            )
        
        data['source_config'] = source_config
        return data


# Apply Template Serializer
class ApplyTemplateSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    academic_year = serializers.CharField(max_length=9)
    term = serializers.ChoiceField(choices=[
        ("First Term", "First Term"),
        ("Second Term", "Second Term"),
        ("Third Term", "Third Term"),
    ])
    
    def validate(self, data):
        # Check if template exists
        try:
            template = ConfigurationTemplate.objects.get(id=data['template_id'], is_active=True)
        except ConfigurationTemplate.DoesNotExist:
            raise serializers.ValidationError("Template not found or inactive")
        
        # Check if target session already has a configuration
        if GradingConfiguration.objects.filter(
            academic_year=data['academic_year'],
            term=data['term']
        ).exists():
            raise serializers.ValidationError(
                f"Configuration already exists for {data['academic_year']} - {data['term']}"
            )
        
        data['template'] = template
        return data