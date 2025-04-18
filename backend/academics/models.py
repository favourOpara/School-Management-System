from django.db import models

class ClassRoom(models.Model):
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    academic_year = models.CharField(max_length=9, default="2024/2025")
    term = models.CharField(max_length=20, default="First Term")

    class Meta:
        unique_together = ('name', 'academic_year', 'term')

    def __str__(self):
        return f"{self.name} - {self.academic_year} - {self.term}"
