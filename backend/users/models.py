from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from academics.models import Class

class CustomUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("The Username field is required.")
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")

        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(username, password, **extra_fields)

class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('parent', 'Parent'),
    ]

    GENDER_CHOICES = [
        ('Male', 'Male'),
        ('Female', 'Female'),
    ]

    DEPARTMENT_CHOICES = [
        ('Science', 'Science'),
        ('Arts', 'Arts'),
        ('Commercial', 'Commercial'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    classroom = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, blank=True)
    middle_name = models.CharField(max_length=30, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    academic_year = models.CharField(max_length=9, blank=True)
    term = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)

    # NEW: Department field only for students in senior classes
    department = models.CharField(max_length=20, choices=DEPARTMENT_CHOICES, null=True, blank=True)

    # Link parents to multiple children
    children = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        limit_choices_to={'role': 'student'},
        related_name='parents'
    )

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.username} ({self.role})"