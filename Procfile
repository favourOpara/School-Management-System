web: cd backend && python manage.py migrate && python manage.py collectstatic --noinput && gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
scheduler: cd backend && python manage.py run_scheduler
