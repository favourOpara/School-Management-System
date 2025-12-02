#!/bin/bash
# Run both web server and scheduler together (for testing only)

# Start scheduler in background
python manage.py run_scheduler &

# Start web server in foreground
gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --timeout 300 --workers 2
