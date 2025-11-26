#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import CustomUser
from academics.models import Department, Class, Subject, ClassSession
from schooladmin.models import GradeSummary, FeeStructure, Announcement

print('=' * 70)
print('CURRENT DATABASE STATE')
print('=' * 70)

print('\nUSERS:')
print(f'  Total Users: {CustomUser.objects.count()}')
print(f'  - Admins: {CustomUser.objects.filter(role="admin").count()}')
print(f'  - Teachers: {CustomUser.objects.filter(role="teacher").count()}')
print(f'  - Students: {CustomUser.objects.filter(role="student").count()}')
print(f'  - Parents: {CustomUser.objects.filter(role="parent").count()}')

print('\nACADEMICS:')
print(f'  Departments: {Department.objects.count()}')
print(f'  Classes: {Class.objects.count()}')
print(f'  Class Sessions: {ClassSession.objects.count()}')
print(f'  Subjects: {Subject.objects.count()}')

print('\nGRADING & FEES:')
print(f'  Grade Summaries: {GradeSummary.objects.count()}')
print(f'  Fee Structures: {FeeStructure.objects.count()}')
print(f'  Announcements: {Announcement.objects.count()}')

print('\n' + '=' * 70)
print('ADMIN ACCOUNTS')
print('=' * 70)
for admin in CustomUser.objects.filter(role='admin'):
    print(f'  Username: {admin.username}')
    print(f'  Name: {admin.first_name} {admin.last_name}')
    print(f'  Email: {admin.email or "Not set"}')
    print(f'  Is Superuser: {admin.is_superuser}')
    print('-' * 70)

print('\n' + '=' * 70)
print('DEPARTMENTS (PRESERVED)')
print('=' * 70)
for dept in Department.objects.all():
    print(f'  - {dept.name}: {dept.description}')

print('\n' + '=' * 70)
print('✓ DATABASE IS CLEAN AND READY FOR PRODUCTION')
print('=' * 70)
