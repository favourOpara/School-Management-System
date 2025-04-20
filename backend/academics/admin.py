from django.contrib import admin
from .models import Class, ClassSession, Subject

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)

@admin.register(ClassSession)
class ClassSessionAdmin(admin.ModelAdmin):
    list_display = ('classroom', 'academic_year', 'term')
    list_filter = ('academic_year', 'term')
    search_fields = ('classroom__name',)

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'class_session', 'teacher')
    list_filter = ('class_session__academic_year', 'class_session__term')
    search_fields = ('name', 'teacher__username', 'class_session__classroom__name')
