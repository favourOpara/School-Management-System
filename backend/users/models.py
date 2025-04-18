from django.contrib.auth.models import AbstractUser
from django.db import models
from academics.models import ClassRoom 

class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('parent', 'Parent'),
    ]
    
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True)

    
    def __str__(self):
        return f"{self.username} ({self.role})"
