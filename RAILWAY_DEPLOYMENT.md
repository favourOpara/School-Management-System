# Railway Deployment Guide - Figil Schools

This guide will help you deploy the School Management System to Railway with automated database backups.

## Features

✅ **Automated Database Backups Every 5 Days**
- Backs up all database tables to Excel format
- Creates SQLite database copy
- Generates backup summary
- Compresses everything into a ZIP file
- **Automatically emails to: office@figilschools.com**

✅ **Brevo SMTP Email Integration**
- All emails sent via Brevo SMTP
- Professional email delivery
- Reliable email service

## Prerequisites

1. A Railway account (https://railway.app)
2. GitHub repository with your code
3. Brevo SMTP credentials (already configured)

## Step 1: Prepare Your Repository

Make sure you've committed all changes:

```bash
git add .
git commit -m "Configure automated backups and Railway deployment"
git push origin main
```

## Step 2: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your School Management System repository
5. Railway will automatically detect your Django app

### Option B: Deploy with Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

## Step 3: Configure Environment Variables

In your Railway dashboard, add these environment variables:

```
SECRET_KEY=your-production-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-app.railway.app

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-brevo-login-email
EMAIL_HOST_PASSWORD=your-brevo-smtp-api-key
DEFAULT_FROM_EMAIL=office@figilschools.com

BACKUP_EMAIL=office@figilschools.com
BACKUP_INTERVAL_DAYS=5
```

## Step 4: Set Up the Scheduler Service

Railway allows multiple services. You need to create TWO services:

### Service 1: Web Server (Django)
- **Start Command**: `cd backend && python manage.py migrate && python manage.py runserver 0.0.0.0:$PORT`
- This runs your main Django application

### Service 2: Scheduler (Background Task)
- **Start Command**: `cd backend && python manage.py run_scheduler`
- This runs the automated backup scheduler

### How to Add Multiple Services in Railway:

1. In your Railway project dashboard, click "New Service"
2. For the first service (Web):
   - Name: "web"
   - Start Command: `cd backend && python manage.py migrate && python manage.py runserver 0.0.0.0:$PORT`
3. Click "Add Service" again for the scheduler:
   - Name: "scheduler"
   - Start Command: `cd backend && python manage.py run_scheduler`

## Step 5: Verify Deployment

1. Check the deployment logs for both services
2. Web service should show: "Starting development server at http://0.0.0.0:$PORT"
3. Scheduler service should show: "Starting scheduler..." and "Added job: Send database backup every 5 days"

## Step 6: Database Configuration (Important!)

Railway provides PostgreSQL, but your app uses SQLite. For production, you should either:

**Option A: Keep SQLite (Simple)**
- SQLite database will be stored in the container
- ⚠️ WARNING: Railway containers are ephemeral - data may be lost on redeploy
- Good for testing, NOT recommended for production

**Option B: Switch to PostgreSQL (Recommended)**
- Add PostgreSQL service in Railway
- Update `settings.py` to use PostgreSQL
- More reliable for production

## Automated Backup Schedule

The system will automatically:
- ✅ Create database backups every 5 days
- ✅ Email ZIP file to office@figilschools.com
- ✅ Include all tables, SQLite file, and summary
- ✅ Run continuously in the background

## Manual Backup

To trigger a manual backup from Railway:

```bash
# SSH into your Railway service
railway run python manage.py backup_database --email office@figilschools.com
```

## Monitoring Backups

Check the scheduler logs in Railway:
1. Go to your Railway project
2. Click on the "scheduler" service
3. View logs to see backup status

You'll see messages like:
```
Starting scheduled backup to office@figilschools.com...
Scheduled backup completed and sent to office@figilschools.com
```

## Troubleshooting

### Backups Not Sending

1. Check scheduler service is running
2. Verify environment variables are set correctly
3. Check Brevo SMTP credentials
4. Look at scheduler logs for errors

### Email Not Received

1. Check spam folder
2. Verify office@figilschools.com is correct
3. Check Brevo dashboard for email logs
4. Verify SMTP credentials are valid

### Scheduler Crashes

1. Check Railway logs for errors
2. Ensure django_apscheduler migrations ran
3. Restart the scheduler service

## Cost Estimate

Railway Pricing:
- **Hobby Plan**: $5/month per service
- You need 2 services (web + scheduler) = $10/month
- Includes 500 hours/month (enough for 24/7 operation)

## Security Recommendations

Before going live:

1. ✅ Change `SECRET_KEY` to a new random value
2. ✅ Set `DEBUG=False`
3. ✅ Configure proper `ALLOWED_HOSTS`
4. ✅ Consider using PostgreSQL instead of SQLite
5. ✅ Enable HTTPS (Railway provides this automatically)
6. ✅ Review Brevo email sending limits

## Support

For issues:
- Railway Docs: https://docs.railway.app
- Brevo Support: https://www.brevo.com/support
- Project Issues: Create an issue in your GitHub repo

---

## Quick Commands

```bash
# View logs
railway logs

# Run migrations
railway run python manage.py migrate

# Create superuser
railway run python manage.py createsuperuser

# Manual backup
railway run python manage.py backup_database --email office@figilschools.com

# Check scheduler status
railway logs --service scheduler
```

---

**Deployment Date**: 2025-11-26
**Automated Backup Email**: office@figilschools.com
**Backup Frequency**: Every 5 days
**Email Provider**: Brevo SMTP
