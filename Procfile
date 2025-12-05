web: bash backend/setup_admin.sh && cd backend && gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --timeout 300 --workers 2
scheduler: cd backend && python manage.py run_scheduler
