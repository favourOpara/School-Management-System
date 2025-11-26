"""
Simple script to generate Django password hash
"""
import hashlib
import secrets
from base64 import b64encode

def make_password(password, salt=None, iterations=870000):
    """Create a Django pbkdf2_sha256 password hash"""
    if salt is None:
        salt = secrets.token_urlsafe(12)

    hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), iterations)
    hash_b64 = b64encode(hash).decode('ascii').strip()

    return f"pbkdf2_sha256${iterations}${salt}${hash_b64}"

# Generate password hash for "Admin@2024"
password = "Admin@2024"
password_hash = make_password(password)

print("="*80)
print("DJANGO PASSWORD HASH GENERATED")
print("="*80)
print(f"\nPlain Password: {password}")
print(f"\nHashed Password:\n{password_hash}")
print("\n" + "="*80)
print("SQL TO RUN IN RAILWAY POSTGRESQL CONSOLE")
print("="*80)

sql = f"""
-- Check if admin exists
SELECT id, username, email, role FROM users_customuser WHERE username = 'admin';

-- If no results, create admin:
INSERT INTO users_customuser (
    password, last_login, is_superuser, username, first_name, last_name,
    email, is_staff, is_active, date_joined, role, phone_number,
    middle_name, gender, department, date_of_birth, academic_year,
    term, classroom_id, avatar, profile_picture
) VALUES (
    '{password_hash}',
    NULL, true, 'admin', 'Admin', 'User',
    'admin@figilschools.com', true, true, NOW(), 'admin', '',
    '', '', '', NULL, '', '', NULL, '', ''
);

-- Verify
SELECT id, username, email, role FROM users_customuser WHERE username = 'admin';
"""

print(sql)
print("="*80)
print("\nLOGIN CREDENTIALS:")
print("-"*80)
print("Username: admin")
print("Password: Admin@2024")
print("Email: admin@figilschools.com")
print("="*80)
