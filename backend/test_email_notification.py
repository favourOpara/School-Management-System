"""
Test script to verify email notification system
Run with: python manage.py shell < test_email_notification.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import CustomUser
from logs.models import Notification

print("=" * 70)
print("EMAIL NOTIFICATION SYSTEM TEST")
print("=" * 70)

# Find a test user (preferably with email)
test_user = CustomUser.objects.filter(email__isnull=False).exclude(email='').first()

if not test_user:
    print("\n❌ No users with email addresses found!")
    print("Please create a user with an email address first.")
    exit()

print(f"\n✓ Test user found: {test_user.username}")
print(f"  Email: {test_user.email}")
print(f"  Role: {test_user.role}")

# Create a test notification
print("\n📧 Creating test notification...")

notification = Notification.objects.create(
    recipient=test_user,
    title="Test Notification - Email System",
    message="This is a test notification to verify that the email notification system is working correctly. If you receive this email, the system is functioning properly!",
    notification_type="general",
    priority="medium"
)

print(f"✓ Notification created (ID: {notification.id})")
print(f"\n📨 Email should be sent to: {test_user.email}")
print(f"   From: office@figilschools.com")
print("\n" + "=" * 70)
print("TEST COMPLETED - Check the email inbox!")
print("=" * 70)
