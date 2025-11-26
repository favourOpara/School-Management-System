# Railway Deployment Guide - Step by Step

## 🚀 Quick Fix for Current Error

The error `/bin/bash: line 1: gunicorn: command not found` has been fixed by:

✅ Added `gunicorn==21.2.0` to requirements.txt
✅ Added `whitenoise==6.6.0` for static files
✅ Updated Procfile with proper gunicorn command
✅ Created nixpacks.toml configuration
✅ Updated settings.py for production

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ Railway account (https://railway.app)
2. ✅ GitHub repository with your code
3. ✅ Brevo SMTP credentials
4. ✅ office@figilschools.com verified in Brevo

---

## 🔧 Step 1: Push Updated Code to GitHub

```bash
cd /Users/newuser/Downloads/School-Management-System

# Add all changes
git add .

# Commit
git commit -m "Configure for Railway deployment with gunicorn"

# Push to GitHub
git push origin main
```

---

## 🚂 Step 2: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select your repository: `School-Management-System`
4. Railway will automatically detect Django and start building

### Option B: Deploy with Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project (or create new)
railway link

# Deploy
railway up
```

---

## ⚙️ Step 3: Configure Environment Variables

In Railway Dashboard → Your Project → Variables, add these:

### Required Variables:

```bash
# Django Settings
SECRET_KEY=django-insecure-l)#gmviq$1lbia2e6j1lsoz=62zsiyo@%i+okl$s*f$$3qo=4+
DEBUG=False
ALLOWED_HOSTS=*.railway.app,localhost,127.0.0.1

# Email Configuration (Brevo SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-brevo-login-email
EMAIL_HOST_PASSWORD=your-brevo-smtp-api-key
DEFAULT_FROM_EMAIL=office@figilschools.com

# Automated Backup Settings
BACKUP_EMAIL=office@figilschools.com
BACKUP_INTERVAL_DAYS=5

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:5173
```

### Important Notes:

1. **Generate New SECRET_KEY** for production:
   ```python
   # Run this in Python shell locally
   from django.core.management.utils import get_random_secret_key
   print(get_random_secret_key())
   ```
   Copy the output and use as SECRET_KEY in Railway

2. **Set DEBUG=False** in production

3. **Update ALLOWED_HOSTS** with your Railway domain after deployment

4. **Update CORS_ALLOWED_ORIGINS** with your frontend URL

---

## 🗄️ Step 4: Database Configuration

Railway uses **ephemeral storage** by default. For production, you need a persistent database.

### Option A: Use Railway PostgreSQL (Recommended)

1. In Railway Dashboard, click **"New"** → **"Database"** → **"Add PostgreSQL"**

2. Railway will automatically add `DATABASE_URL` to your environment variables

3. Install PostgreSQL adapter:
   ```bash
   # Add to backend/requirements.txt
   psycopg2-binary==2.9.9
   dj-database-url==2.1.0
   ```

4. Update `backend/backend/settings.py`:
   ```python
   import dj_database_url

   # Replace DATABASES configuration with:
   DATABASES = {
       'default': dj_database_url.config(
           default=config('DATABASE_URL', default='sqlite:///db.sqlite3'),
           conn_max_age=600
       )
   }
   ```

5. Redeploy to Railway

### Option B: Keep SQLite (Testing Only - NOT for Production)

⚠️ WARNING: Railway containers are ephemeral. SQLite data will be lost on restart.

Only use for testing, not production.

---

## 📦 Step 5: Set Up Scheduler Service (Background Tasks)

For automated backups every 5 days:

1. In Railway Dashboard, click **"New Service"**
2. Select your repository again
3. Name it **"scheduler"**
4. Set **Start Command** to:
   ```bash
   cd backend && python manage.py run_scheduler
   ```
5. Add same environment variables as web service
6. Deploy

Now you have **2 services**:
- **web**: Main Django application
- **scheduler**: Automated backups

---

## ✅ Step 6: Verify Deployment

### 6.1 Check Web Service

1. Go to your Railway web service
2. Click **"Settings"** → **"Networking"** → **"Generate Domain"**
3. Open the generated URL (e.g., `https://your-app.railway.app`)
4. You should see Django running

### 6.2 Check Logs

```bash
# Web service logs
railway logs

# Scheduler logs
railway logs --service scheduler
```

Look for:
- ✅ "Starting gunicorn"
- ✅ "Starting scheduler..."
- ❌ No errors

### 6.3 Test Admin Panel

1. Go to `https://your-app.railway.app/admin`
2. Login with admin credentials
3. Verify everything works

### 6.4 Test Email Notifications

1. Login as admin
2. Send a test notification
3. Check recipient's email

---

## 🔒 Step 7: Security Checklist

Before going fully live:

- [ ] Change SECRET_KEY to a new random value
- [ ] Set DEBUG=False
- [ ] Update ALLOWED_HOSTS with your actual domain
- [ ] Set up HTTPS (Railway provides automatically)
- [ ] Configure CORS_ALLOWED_ORIGINS correctly
- [ ] Verify Brevo sender email (office@figilschools.com)
- [ ] Set up database backups (if using PostgreSQL)
- [ ] Test all critical functionality

---

## 📊 Step 8: Monitor Your Deployment

### Check Deployment Status

Railway Dashboard shows:
- ✅ Build status
- ✅ Deploy status
- ✅ Resource usage
- ✅ Logs

### Monitor Emails

Brevo Dashboard (https://app.brevo.com):
- Email sending statistics
- Delivery rates
- Bounce rates
- SMTP logs

### Monitor Backups

Check `office@figilschools.com` inbox:
- Should receive backup every 5 days
- Contains database ZIP file

---

## 🐛 Troubleshooting

### Issue: "Application failed to respond"

**Solution**:
1. Check Railway logs: `railway logs`
2. Verify `PORT` environment variable is being used
3. Ensure gunicorn is binding to `0.0.0.0:$PORT`

### Issue: "gunicorn: command not found"

**Solution**:
✅ Already fixed! Make sure you pushed updated requirements.txt

### Issue: Static files not loading

**Solution**:
1. Verify WhiteNoise is installed
2. Run `python manage.py collectstatic` in deployment
3. Check STATIC_ROOT setting

### Issue: Database resets on every deploy

**Solution**:
Use PostgreSQL instead of SQLite (see Step 4)

### Issue: Emails not sending

**Solution**:
1. Verify Brevo credentials in environment variables
2. Check office@figilschools.com is verified in Brevo
3. Check Railway logs for email errors

### Issue: CORS errors from frontend

**Solution**:
Update CORS_ALLOWED_ORIGINS with your frontend URL

---

## 📝 Post-Deployment Tasks

1. **Update Frontend API URL**
   - Point frontend to `https://your-app.railway.app`

2. **Test All Features**
   - User login/registration
   - Email notifications
   - File uploads
   - Report generation
   - Fee payments

3. **Set Up Monitoring** (Optional)
   - Use Railway's built-in metrics
   - Set up Sentry for error tracking
   - Configure uptime monitoring

4. **Backup Strategy**
   - Automated backups running every 5 days ✓
   - Manual backups: `railway run python manage.py backup_database --email office@figilschools.com`
   - Database snapshots (if using PostgreSQL)

---

## 💰 Railway Pricing

**Hobby Plan**: $5/month per service
- Web service: $5/month
- Scheduler service: $5/month
- **Total: $10/month**

Includes:
- 500 GB bandwidth
- Unlimited projects
- Custom domains
- Automatic HTTPS

---

## 🚀 Quick Commands Reference

```bash
# View logs
railway logs

# View scheduler logs
railway logs --service scheduler

# Run migrations
railway run python manage.py migrate

# Create superuser
railway run python manage.py createsuperuser

# Manual backup
railway run python manage.py backup_database --email office@figilschools.com

# Restart service
railway restart

# Link local repo to Railway project
railway link

# Open Railway dashboard
railway open
```

---

## ✅ Deployment Checklist

Before marking deployment as complete:

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Environment variables configured
- [ ] Web service deployed and running
- [ ] Scheduler service deployed and running
- [ ] Database configured (PostgreSQL recommended)
- [ ] Domain generated and working
- [ ] Admin panel accessible
- [ ] Email notifications working
- [ ] Static files serving correctly
- [ ] CORS configured for frontend
- [ ] Security settings verified (DEBUG=False, SECRET_KEY changed)
- [ ] Brevo sender verified
- [ ] All critical features tested

---

## 🆘 Need Help?

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Django Deployment Guide**: https://docs.djangoproject.com/en/5.0/howto/deployment/

---

**Last Updated**: November 26, 2025
**Deployment Status**: Ready for Railway ✅
