"""
Generate SQL to create admin user with proper password hash
Run this script locally, then copy the SQL output to Railway PostgreSQL console
"""
import sys
import os
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.hashers import make_password
from datetime import datetime

# Create password hash
password = 'Admin@2024'
password_hash = make_password(password)

# Generate SQL
sql = f"""
-- SQL to create admin user in PostgreSQL
-- Copy and paste this into Railway PostgreSQL Query console

-- Step 1: Check if admin already exists
SELECT id, username, email, role FROM users_customuser WHERE username = 'admin';

-- Step 2: If no results above, run this INSERT statement:
INSERT INTO users_customuser (
    password,
    last_login,
    is_superuser,
    username,
    first_name,
    last_name,
    email,
    is_staff,
    is_active,
    date_joined,
    role,
    phone_number,
    middle_name,
    gender,
    department,
    date_of_birth,
    academic_year,
    term,
    classroom_id,
    avatar,
    profile_picture
) VALUES (
    '{password_hash}',
    NULL,
    true,
    'admin',
    'Admin',
    'User',
    'admin@figilschools.com',
    true,
    true,
    '{datetime.now().isoformat()}',
    'admin',
    '',
    '',
    '',
    '',
    NULL,
    '',
    '',
    NULL,
    '',
    ''
);

-- Step 3: Verify admin was created
SELECT id, username, email, role, is_superuser, is_staff FROM users_customuser WHERE username = 'admin';
"""

print("="*80)
print("ADMIN USER SQL GENERATOR")
print("="*80)
print(f"\nPassword: {password}")
print(f"Password Hash: {password_hash}")
print("\n" + "="*80)
print("COPY THE SQL BELOW AND RUN IT IN RAILWAY POSTGRESQL CONSOLE")
print("="*80)
print(sql)
print("="*80)
print("\nCREDENTIALS AFTER CREATION:")
print("-"*80)
print(f"Username: admin")
print(f"Email: admin@figilschools.com")
print(f"Password: {password}")
print("="*80)
