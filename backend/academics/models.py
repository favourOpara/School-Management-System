from django.db import models

class Class(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class ClassSession(models.Model):
    classroom = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='sessions')
    academic_year = models.CharField(max_length=9, default="2024/2025")
    term = models.CharField(
        max_length=20,
        choices=[
            ("First Term", "First Term"),
            ("Second Term", "Second Term"),
            ("Third Term", "Third Term"),
        ],
        default="First Term"
    )

    class Meta:
        unique_together = ('classroom', 'academic_year', 'term')
        ordering = ['-academic_year', 'classroom__name', 'term']

    def __str__(self):
        return f"{self.classroom.name} - {self.academic_year} - {self.term}"


class Subject(models.Model):
    DEPARTMENT_CHOICES = [
        ('General', 'General'),
        ('Science', 'Science'),
        ('Arts', 'Arts'),
        ('Commercial', 'Commercial'),
    ]

    name = models.CharField(max_length=100)
    class_session = models.ForeignKey('ClassSession', on_delete=models.CASCADE, related_name='subjects')
    teacher = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'teacher'}
    )
    department = models.CharField(
        max_length=20,
        choices=DEPARTMENT_CHOICES,
        default='General',  # Optional: default to General for clarity
        blank=True,
        null=True
    )

    def __str__(self):
        return f"{self.name} - {self.class_session} - {self.department or 'No Dept'}"
