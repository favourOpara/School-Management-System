#!/bin/bash
# Setup script to initialize admin user on Railway
# This runs during deployment via Procfile

echo "🔧 Initializing database..."
python manage.py migrate

echo "📦 Collecting static files..."
python manage.py collectstatic --noinput

echo "👤 Creating default admin user (if not exists)..."
python manage.py create_default_admin \
    --username admin \
    --email admin@figilschools.com \
    --password "${ADMIN_PASSWORD:-Admin@2024}" || echo "⚠️  Admin user already exists or creation skipped"

echo "✅ Setup complete!"
