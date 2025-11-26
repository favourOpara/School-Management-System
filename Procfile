web: cd backend && bash setup_admin.sh && gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
scheduler: cd backend && python manage.py run_scheduler
