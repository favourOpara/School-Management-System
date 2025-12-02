#!/usr/bin/env python
"""Check if a user's avatar is stored in Cloudinary or locally"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Install required packages first
import subprocess
packages = ['djangorestframework==3.16.0', 'django-cors-headers==4.7.0', 'Pillow==11.0.0']
for pkg in packages:
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', pkg],
                      capture_output=True, check=True)
    except:
        pass

django.setup()

from users.models import CustomUser
from django.core.files.storage import default_storage

print("=" * 70)
print("STORAGE BACKEND CHECK")
print("=" * 70)

print(f"\n1. Default Storage Backend:")
print(f"   Class: {default_storage.__class__.__name__}")
print(f"   Module: {default_storage.__class__.__module__}")

is_cloudinary = 'cloudinary' in default_storage.__class__.__module__.lower()
print(f"   Using Cloudinary: {'✓ YES' if is_cloudinary else '✗ NO'}")

print(f"\n2. Checking Admin User's Avatar:")
try:
    admin = CustomUser.objects.filter(username='Admin').first()
    if not admin:
        admin = CustomUser.objects.filter(role='admin').first()

    if admin:
        print(f"   User: {admin.username}")

        if admin.avatar:
            avatar_url = admin.avatar.url
            print(f"   Avatar URL: {avatar_url}")

            if 'cloudinary.com' in avatar_url:
                print(f"   ✓ Avatar is on Cloudinary")
            elif avatar_url.startswith('http'):
                print(f"   ⚠ Avatar is on external URL (not Cloudinary)")
            else:
                print(f"   ✗ Avatar is LOCAL PATH - needs re-upload!")
                print(f"\n   SOLUTION: Delete and re-upload this avatar through the app")
        else:
            print(f"   No avatar uploaded")
    else:
        print(f"   No admin user found")

except Exception as e:
    print(f"   Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
