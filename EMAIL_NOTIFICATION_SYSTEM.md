# Email Notification System Documentation

## Overview

The School Management System now has a **fully automated email notification system** that sends emails to teachers, parents, and students for ALL in-app notifications using **office@figilschools.com** as the sender.

---

## ✅ What Was Implemented

### 1. **Required Email Fields**
- ✅ **Teachers**: Email field is now **REQUIRED** when creating teachers
- ✅ **Students**: Email field is now **REQUIRED** when creating students
- ✅ **Parents**: Email field was already **REQUIRED** (unchanged)

### 2. **Email Sender Configuration**
- **Sender Email**: `office@figilschools.com`
- **SMTP Provider**: Brevo (smtp-relay.brevo.com)
- **Authentication**: Configured and tested ✓

### 3. **Automated Email Notifications**
Every notification sent in the system is **automatically emailed** to the recipient:

#### 📧 **For Teachers:**
- Teacher grading reminders (incomplete grades)
- General announcements from admin
- System notifications

#### 📧 **For Parents:**
- Fee receipt notifications
- Report sheet availability
- Student incomplete grades reminders
- Fee payment reminders
- Graduation notifications
- Teacher content uploads (assignments/notes for their children)
- General announcements from admin

#### 📧 **For Students:**
- Report sheet availability
- Incomplete grades reminders
- Fee payment reminders
- Graduation notifications
- Teacher content uploads (new assignments/notes)
- General announcements from admin

---

## 🔧 How It Works

### Automatic Email Triggering

The system uses **Django signals** to automatically send emails whenever:

1. **Notification Object Created** → Email sent immediately
2. **NotificationStatus Created** → Email sent for content notifications (assignments/notes)
3. **Announcement Sent** → Emails sent to all recipients

### Email Components

**From**: office@figilschools.com
**To**: User's registered email address
**Format**: HTML + Plain Text (for compatibility)
**Priority Indicators**: Visual styling based on priority (high/medium/low)

### Email Template Features
- Professional HTML design
- Color-coded priority levels:
  - 🔴 High Priority: Red border
  - 🟠 Medium Priority: Orange border
  - 🔵 Low Priority: Blue border
- School branding (Figil Schools)
- Notification type badge
- Footer with school information

---

## 📝 Files Modified/Created

### **Modified Files:**

1. **`users/serializers.py`**
   - Line 130-143: Updated `TeacherSignupSerializer` to include required email field
   - Line 31: Made email required for students in `UserCreateSerializer`

2. **`.env`**
   - Changed `DEFAULT_FROM_EMAIL` to `office@figilschools.com`

3. **`.env.example`**
   - Updated to reflect office@figilschools.com as default sender

### **New Files Created:**

1. **`logs/email_service.py`**
   - Email notification service
   - Functions:
     - `send_notification_email()` - Send email to single user
     - `send_bulk_notification_emails()` - Send to multiple users
   - HTML email template generation
   - Error logging

2. **`logs/signals.py`** (Updated)
   - Added signal for `Notification` model (line 50-69)
   - Added signal for `NotificationStatus` model (line 72-105)
   - Automatically triggers email sending on notification creation

3. **`test_email_notification.py`**
   - Test script to verify email system functionality

---

## 🧪 Testing the System

### Method 1: Using Test Script

```bash
cd backend
./venv/bin/python manage.py shell < test_email_notification.py
```

This will:
- Find a user with an email address
- Create a test notification
- Automatically send an email to that user

### Method 2: Manual Test via Django Shell

```bash
cd backend
./venv/bin/python manage.py shell
```

```python
from users.models import CustomUser
from logs.models import Notification

# Find a user
user = CustomUser.objects.filter(email__isnull=False).first()

# Create notification (email will be sent automatically)
Notification.objects.create(
    recipient=user,
    title="Test Email",
    message="Testing the email notification system!",
    notification_type="general",
    priority="high"
)
```

### Method 3: Test via Admin Panel

1. Log in as admin
2. Send any notification (fee reminder, report release, announcement, etc.)
3. Check the recipient's email inbox

---

## 📊 Notification Types That Trigger Emails

| Notification Type | Recipients | Trigger |
|------------------|------------|---------|
| **report_release** | Students + Parents | Admin releases report sheets |
| **incomplete_grades** | Students + Parents | Admin sends grade reminders |
| **fee_reminder** | Students + Parents | Admin sends fee reminders |
| **fee_receipt** | Parents | Admin records fee payment |
| **teacher_grading_reminder** | Teachers | Admin reminds about incomplete grading |
| **announcement** | Everyone/Filtered | Admin creates announcement |
| **graduation** | Students + Parents | SSS3 promotion/graduation |
| **assignment/note** | Students + Parents | Teacher uploads content |

---

## 🛠️ Configuration

### Environment Variables (.env)

```bash
# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-brevo-login-email
EMAIL_HOST_PASSWORD=your-brevo-smtp-api-key
DEFAULT_FROM_EMAIL=office@figilschools.com
```

### Railway Deployment

Make sure to add these environment variables in Railway dashboard:

```
DEFAULT_FROM_EMAIL=office@figilschools.com
EMAIL_HOST_USER=your-brevo-login-email
EMAIL_HOST_PASSWORD=your-brevo-smtp-api-key
```

---

## 🔍 Monitoring & Logging

The system logs all email activities:

- **Success**: `Email notification sent to {email} ({username}): {title}`
- **Failure**: `Failed to send email to {email} ({username}): {error}`
- **No Email**: `User {username} has no email address. Cannot send notification.`

To view logs in Railway:
```bash
railway logs --service web
```

---

## 🚨 Important Notes

### 1. **Brevo SMTP Configuration**
- Brevo requires sender email verification
- Make sure `office@figilschools.com` is verified in your Brevo account
- Check Brevo dashboard for delivery status

### 2. **User Email Requirements**
- **NEW USERS**: Email is now required for all new teachers and students
- **EXISTING USERS**: May not have email addresses
  - System will log warning but won't fail
  - Admin should update existing users with email addresses

### 3. **Email Delivery**
- Emails are sent synchronously (immediately when notification created)
- For high-volume scenarios, consider using Celery for async email sending
- Check spam folders if emails not appearing

### 4. **Rate Limits**
- Brevo free tier: 300 emails/day
- Monitor usage in Brevo dashboard
- Consider upgrading plan if needed

---

## 📈 Future Enhancements

Potential improvements for production:

1. **Async Email Sending**
   - Use Celery + Redis for background email processing
   - Prevents blocking on slow SMTP connections

2. **Email Queue**
   - Queue failed emails for retry
   - Batch sending for announcements to many users

3. **Email Templates**
   - Store templates in database
   - Admin can customize email design

4. **Email Preferences**
   - Allow users to opt-out of certain notification types
   - Already have `NotificationPreference` model (not yet connected)

5. **Email Analytics**
   - Track open rates
   - Track click-through rates
   - Delivery confirmation

---

## 🐛 Troubleshooting

### Emails Not Sending?

**Check 1: Email Configuration**
```bash
./venv/bin/python manage.py shell
```
```python
from django.conf import settings
print(f"Email Host: {settings.EMAIL_HOST}")
print(f"Default From: {settings.DEFAULT_FROM_EMAIL}")
```

**Check 2: User Has Email**
```python
from users.models import CustomUser
user = CustomUser.objects.get(username='test_user')
print(f"Email: {user.email}")
```

**Check 3: Test SMTP Connection**
```python
from django.core.mail import send_mail
send_mail(
    'Test Email',
    'This is a test.',
    'office@figilschools.com',
    ['recipient@example.com'],
    fail_silently=False,
)
```

**Check 4: View Django Logs**
```bash
# Check for email errors
grep -i "email" backend/logs/*.log
```

### Common Issues

**Issue**: "User has no email address"
- **Solution**: Update user profile with email address

**Issue**: "SMTP Authentication Error"
- **Solution**: Verify Brevo credentials in .env file

**Issue**: "Sender email not verified"
- **Solution**: Verify office@figilschools.com in Brevo dashboard

**Issue**: "Rate limit exceeded"
- **Solution**: Upgrade Brevo plan or spread out notifications

---

## ✅ Summary

**All notifications are now automatically emailed to users!**

- ✅ Teachers receive emails for grading reminders and announcements
- ✅ Parents receive emails for fees, reports, and student activities
- ✅ Students receive emails for grades, reports, and content uploads
- ✅ All emails sent from: **office@figilschools.com**
- ✅ Professional HTML email templates
- ✅ Automatic triggering via Django signals
- ✅ Full logging and error handling

**No manual intervention required** - the system handles everything automatically!

---

**Last Updated**: November 26, 2025
**Email System Version**: 1.0
**Configured By**: Claude Code Assistant
