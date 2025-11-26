from django.contrib import admin
from .models import FeeReceipt, FeeStructure, StudentFeeRecord, FeePaymentHistory, Announcement

# Register your models here.

@admin.register(FeeReceipt)
class FeeReceiptAdmin(admin.ModelAdmin):
    list_display = ['receipt_number', 'student', 'academic_year', 'term', 'amount_paid', 'balance', 'status', 'date_issued']
    list_filter = ['status', 'academic_year', 'term', 'date_issued']
    search_fields = ['receipt_number', 'student__username', 'student__first_name', 'student__last_name']
    readonly_fields = ['date_issued', 'date_updated']
    ordering = ['-date_issued']

@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ['name', 'amount', 'academic_year', 'term', 'date_created']
    list_filter = ['academic_year', 'term']
    search_fields = ['name']

@admin.register(StudentFeeRecord)
class StudentFeeRecordAdmin(admin.ModelAdmin):
    list_display = ['student', 'fee_structure', 'amount_paid', 'payment_status', 'date_paid']
    list_filter = ['payment_status', 'fee_structure__academic_year', 'fee_structure__term']
    search_fields = ['student__username', 'student__first_name', 'student__last_name']

@admin.register(FeePaymentHistory)
class FeePaymentHistoryAdmin(admin.ModelAdmin):
    list_display = ['fee_record', 'transaction_type', 'amount', 'balance_after', 'recorded_by', 'transaction_date']
    list_filter = ['transaction_type', 'transaction_date']
    search_fields = ['fee_record__student__username', 'fee_record__student__first_name', 'fee_record__student__last_name']
    readonly_fields = ['transaction_date']
    ordering = ['-transaction_date']

@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'audience', 'priority', 'created_by', 'created_at', 'is_active']
    list_filter = ['audience', 'priority', 'is_active', 'created_at']
    search_fields = ['title', 'message']
    filter_horizontal = ['specific_users', 'specific_classes', 'read_by']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
