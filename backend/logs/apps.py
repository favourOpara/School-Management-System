# apps.py
from django.apps import AppConfig


class LogsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'logs'
    verbose_name = 'Activity Logs and Notifications'

    def ready(self):
        import logs.signals