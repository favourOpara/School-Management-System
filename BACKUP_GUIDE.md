# Database Backup System - User Guide

## Overview
This system automatically backs up your School Management System database. It exports all data to Excel files and creates ZIP archives for easy storage and emailing.

## What Gets Backed Up

### Tables Included:
- **Users**: Students, teachers, parents, admins (59 users)
- **Academics**: Classes, subjects, sessions, assignments, exams (356 records)
- **Attendance**: Calendar, records, holidays (156 records)
- **Grades**: Grade summaries, configurations, components (236 records)
- **Fees**: Fee structures, payments, receipts (194 records)
- **Logs**: Activity logs, notifications (261 records)
- **Announcements**: School announcements (1 record)

**Total**: 41 tables, ~1,820 records

### Files Created:
1. **Excel file** - All tables in one workbook (different sheets)
2. **SQLite database** - Raw database file for complete restoration
3. **Summary file** - Backup details and restoration instructions
4. **ZIP archive** - Everything bundled together

---

## How to Run Backup Manually

### Basic Backup (Local Save):
```bash
cd /Users/newuser/Downloads/School-Management-System/backend
./venv/bin/python manage.py backup_database
```

This creates a backup in: `/Users/newuser/Downloads/School-Management-System/backups/`

### Backup with Email (when configured):
```bash
./venv/bin/python manage.py backup_database --email admin@schoolname.com
```

### Backup without ZIP (faster):
```bash
./venv/bin/python manage.py backup_database --no-zip
```

---

## Automated Scheduling (Every 5 Days)

### On Mac/Linux (Using Cron):

1. **Open terminal and edit crontab:**
```bash
crontab -e
```

2. **Add this line** (runs at 2 AM every 5 days):
```bash
0 2 */5 * * cd /Users/newuser/Downloads/School-Management-System/backend && ./venv/bin/python manage.py backup_database
```

3. **Save and exit** (Press ESC, type `:wq`, press ENTER)

4. **Verify it's added:**
```bash
crontab -l
```

### On Windows (Using Task Scheduler):

1. **Open Task Scheduler**
2. **Create Basic Task**:
   - Name: "School Database Backup"
   - Trigger: "Daily" (every 5 days)
   - Action: "Start a program"
   - Program: `C:\path\to\venv\Scripts\python.exe`
   - Arguments: `manage.py backup_database`
   - Start in: `C:\path\to\backend\`

---

## Email Configuration (For Future Use)

When you get an email account for the school, add these settings to `backend/backend/settings.py`:

### For Gmail:
```python
# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'yourschool@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'  # Use App Password, not regular password
DEFAULT_FROM_EMAIL = 'yourschool@gmail.com'
```

### For Custom Domain (e.g., Hostinger, cPanel):
```python
# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'mail.yourschool.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'admin@yourschool.com'
EMAIL_HOST_PASSWORD = 'your-email-password'
DEFAULT_FROM_EMAIL = 'admin@yourschool.com'
```

### Test Email:
```bash
./venv/bin/python manage.py backup_database --email test@example.com
```

---

## How to Restore from Backup

### Option 1: Restore Entire Database (Easiest)
1. **Stop Django server**
2. **Navigate to backup folder:**
   ```bash
   cd /Users/newuser/Downloads/School-Management-System/backups/backup_2025-11-26_XXXXXX/
   ```
3. **Replace current database:**
   ```bash
   cp db.sqlite3 ../../backend/db.sqlite3
   ```
4. **Restart Django server**

### Option 2: Review Data in Excel
1. **Open the Excel file** (`database_backup_YYYY-MM-DD_HHMMSS.xlsx`)
2. **Browse through sheets** - Each sheet is a different table
3. **View/analyze/export specific data as needed**

---

## Backup File Locations

All backups are stored in:
```
/Users/newuser/Downloads/School-Management-System/backups/
```

Each backup creates a timestamped folder:
```
backups/
├── backup_2025-11-26_014027/
│   ├── database_backup_2025-11-26_014027.xlsx
│   ├── db.sqlite3
│   └── backup_summary.txt
└── backup_2025-11-26_014027.zip
```

---

## Tips

### Clean Up Old Backups:
Backups can accumulate. Delete old ones you don't need:
```bash
cd /Users/newuser/Downloads/School-Management-System/backups/
ls -lt  # List backups by date
rm -rf backup_2025-10-15_*  # Delete specific backup
```

### Backup Before Major Changes:
Always run a manual backup before:
- Clearing database for production
- Major system updates
- Importing bulk data
- Testing new features

### Monitor Backup Size:
Check backup folder size:
```bash
du -sh /Users/newuser/Downloads/School-Management-System/backups/
```

---

## Troubleshooting

### "Command not found" error:
Make sure you're in the backend directory:
```bash
cd /Users/newuser/Downloads/School-Management-System/backend
```

### "Permission denied" error:
Make sure the script is executable:
```bash
chmod +x ./venv/bin/python
```

### Email not sending:
1. Check email settings in `settings.py`
2. For Gmail, enable "App Passwords" in Google Account settings
3. Test with: `./venv/bin/python manage.py backup_database --email your@email.com`

### Backup folder full:
Delete old backups or move them to external storage

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `python manage.py backup_database` | Create backup locally |
| `python manage.py backup_database --email EMAIL` | Send backup via email |
| `python manage.py backup_database --no-zip` | Skip ZIP creation |
| `crontab -e` | Schedule automated backups (Mac/Linux) |
| `crontab -l` | List scheduled tasks |

---

## Support

For questions or issues with the backup system, contact your system administrator or refer to the Django documentation at https://docs.djangoproject.com/
