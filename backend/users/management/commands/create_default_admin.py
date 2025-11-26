"""
Management command to create default admin users
Usage: python manage.py create_default_admin
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decouple import config

User = get_user_model()


class Command(BaseCommand):
    help = 'Create default admin user if it does not exist'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='Admin username (default: admin)'
        )
        parser.add_argument(
            '--email',
            type=str,
            default='admin@figilschools.com',
            help='Admin email (default: admin@figilschools.com)'
        )
        parser.add_argument(
            '--password',
            type=str,
            default=None,
            help='Admin password (prompted if not provided)'
        )

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        password = options['password']

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'Admin user "{username}" already exists!')
            )
            return

        # Get password from environment or prompt
        if not password:
            password = config('ADMIN_DEFAULT_PASSWORD', default=None)

        if not password:
            from getpass import getpass
            password = getpass('Enter password for admin: ')
            password_confirm = getpass('Confirm password: ')

            if password != password_confirm:
                self.stdout.write(self.style.ERROR('Passwords do not match!'))
                return

        # Create the admin user
        try:
            admin_user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name='Admin',
                last_name='User'
            )
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.role = 'admin'
            admin_user.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Successfully created admin user: {username}'
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'   Email: {email}'
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'   You can now login with these credentials'
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating admin user: {str(e)}')
            )
