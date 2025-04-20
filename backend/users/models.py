from django.contrib.auth.models import AbstractUser
from django.db import models
from academics.models import ClassSession  # Updated reference

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

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    class_session = models.ForeignKey(ClassSession, on_delete=models.SET_NULL, null=True, blank=True)

    middle_name = models.CharField(max_length=30, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    academic_year = models.CharField(max_length=9, blank=True)  # Optional for now
    date_of_birth = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"
