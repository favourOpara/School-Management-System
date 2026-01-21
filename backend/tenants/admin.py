from django.contrib import admin
from .models import School, SubscriptionPlan, Subscription, PaymentHistory, SchoolInvitation


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'email', 'is_active', 'is_verified', 'created_at']
    list_filter = ['is_active', 'is_verified', 'created_at']
    search_fields = ['name', 'slug', 'email']
    readonly_fields = ['id', 'created_at', 'updated_at']
    prepopulated_fields = {'slug': ('name',)}
    ordering = ['name']


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = [
        'display_name', 'name', 'monthly_price_display', 'annual_price_display',
        'max_admin_accounts', 'max_daily_emails', 'has_import_feature', 'is_active'
    ]
    list_filter = ['is_active', 'is_public', 'has_import_feature']
    search_fields = ['name', 'display_name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['display_order', 'monthly_price']

    def monthly_price_display(self, obj):
        if obj.monthly_price == 0:
            return 'Free'
        return f'₦{obj.monthly_price / 100:,.2f}'
    monthly_price_display.short_description = 'Monthly Price'

    def annual_price_display(self, obj):
        if obj.annual_price == 0:
            return 'Free'
        return f'₦{obj.annual_price / 100:,.2f}'
    annual_price_display.short_description = 'Annual Price'


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'school', 'plan', 'status', 'billing_cycle',
        'current_period_end', 'emails_sent_today'
    ]
    list_filter = ['status', 'billing_cycle', 'plan']
    search_fields = ['school__name', 'school__slug', 'paystack_customer_code']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'emails_sent_today',
        'email_counter_reset_date'
    ]
    raw_id_fields = ['school', 'plan']
    ordering = ['-created_at']


@admin.register(PaymentHistory)
class PaymentHistoryAdmin(admin.ModelAdmin):
    list_display = [
        'subscription', 'amount_display', 'status', 'payment_method',
        'plan_name', 'created_at', 'paid_at'
    ]
    list_filter = ['status', 'payment_method', 'billing_cycle', 'created_at']
    search_fields = [
        'subscription__school__name', 'paystack_reference',
        'paystack_transaction_id'
    ]
    readonly_fields = [
        'id', 'paystack_reference', 'paystack_transaction_id',
        'created_at', 'paid_at'
    ]
    raw_id_fields = ['subscription']
    ordering = ['-created_at']

    def amount_display(self, obj):
        return f'₦{obj.amount / 100:,.2f}'
    amount_display.short_description = 'Amount'


@admin.register(SchoolInvitation)
class SchoolInvitationAdmin(admin.ModelAdmin):
    list_display = ['email', 'school_name', 'is_used', 'created_at', 'expires_at']
    list_filter = ['is_used', 'created_at']
    search_fields = ['email', 'school_name']
    readonly_fields = ['id', 'token', 'created_at', 'used_at']
    ordering = ['-created_at']
