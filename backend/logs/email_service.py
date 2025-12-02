# backend/logs/email_service.py
"""
Email service using Brevo Transactional Email API v3
Official API documentation: https://developers.brevo.com/reference/sendtransacemail
"""

import requests
from django.conf import settings
import logging
import os

logger = logging.getLogger(__name__)

# Brevo API Configuration - ONLY from environment variables
BREVO_API_KEY = os.environ.get('EMAIL_HOST_PASSWORD')
BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

# Validate API key is set
if not BREVO_API_KEY:
    logger.error("❌ EMAIL_HOST_PASSWORD environment variable not set!")
    print("❌ EMAIL_HOST_PASSWORD environment variable not set!")


def send_notification_email(recipient_user, notification_title, notification_message, notification_type='general', priority='medium'):
    """
    Send notification email via Brevo Transactional Email API
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    
    # Check if API key is available
    if not BREVO_API_KEY:
        logger.error("❌ No Brevo API key configured")
        print("❌ No Brevo API key configured")
        return False
    
    # Check if user has an email address
    if not recipient_user.email:
        logger.warning(f"User {recipient_user.username} has no email address")
        print(f"⚠️ {recipient_user.username} has no email")
        return False
    
    try:
        # Prepare email content
        subject = f"[FIGIL Schools] {notification_title}"
        
        # Create HTML email body
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: white;
                    padding: 30px;
                    border-radius: 0 0 5px 5px;
                }}
                .priority-{priority} {{
                    border-left: 4px solid #ff9800;
                    padding-left: 15px;
                }}
                .footer {{
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #4CAF50;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin-top: 15px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>FIGIL Schools Notification</h1>
                </div>
                <div class="content">
                    <div class="priority-{priority}">
                        <h2>{notification_title}</h2>
                        <p>{notification_message.replace(chr(10), '<br>')}</p>
                    </div>
                    
                    <p style="margin-top: 30px;">
                        <a href="https://figilschools.com" class="button">View in Dashboard</a>
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated notification from FIGIL Schools.</p>
                    <p>Please do not reply to this email.</p>
                    <p>For inquiries, contact: office@figilschools.com</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Get recipient name
        recipient_name = f"{recipient_user.first_name} {recipient_user.last_name}".strip()
        if not recipient_name:
            recipient_name = recipient_user.username
        
        # Brevo API payload (official structure)
        payload = {
            "sender": {
                "name": "FIGIL Schools",
                "email": "office@figilschools.com"
            },
            "to": [
                {
                    "email": recipient_user.email,
                    "name": recipient_name
                }
            ],
            "subject": subject,
            "htmlContent": html_content
        }
        
        # API headers (official format)
        headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json"
        }
        
        logger.info(f"Sending email to {recipient_user.email} via Brevo API")
        print(f"📧 Sending to {recipient_user.email} via Brevo API...")
        
        # Send via Brevo API
        response = requests.post(
            BREVO_API_URL,
            json=payload,
            headers=headers,
            timeout=15
        )
        
        # Check response
        if response.status_code == 201:  # Brevo returns 201 for success
            logger.info(f"✅ Email sent to {recipient_user.email}")
            print(f"✅ Email sent to {recipient_user.email}")
            return True
        else:
            logger.error(f"❌ Brevo API error {response.status_code}: {response.text}")
            print(f"❌ Brevo API error {response.status_code}: {response.text}")
            return False
        
    except requests.Timeout:
        logger.error(f"❌ Timeout sending to {recipient_user.email}")
        print(f"❌ Timeout for {recipient_user.email}")
        return False
        
    except Exception as e:
        logger.error(f"❌ Failed to send to {recipient_user.email}: {str(e)}")
        print(f"❌ Failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def send_bulk_notification_emails(notifications):
    """Send multiple notification emails"""
    stats = {'total': 0, 'sent': 0, 'failed': 0, 'skipped': 0}
    
    for notification in notifications:
        stats['total'] += 1
        
        result = send_notification_email(
            recipient_user=notification.recipient,
            notification_title=notification.title,
            notification_message=notification.message,
            notification_type=notification.notification_type,
            priority=notification.priority
        )
        
        if result:
            stats['sent'] += 1
        else:
            stats['failed'] += 1
    
    logger.info(f"Bulk email complete: {stats}")
    print(f"📊 Summary: {stats['sent']} sent, {stats['failed']} failed, {stats['skipped']} skipped")
    return stats


def test_email_configuration():
    """Test email via Brevo API"""
    try:
        if not BREVO_API_KEY:
            print("❌ No API key configured")
            return False
            
        payload = {
            "sender": {"name": "FIGIL Schools", "email": "office@figilschools.com"},
            "to": [{"email": "office@figilschools.com", "name": "Test"}],
            "subject": "Test Email - FIGIL Schools",
            "htmlContent": "<html><body><h2>Test Email</h2><p>This is a test email sent via Brevo API.</p></body></html>"
        }
        
        headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json"
        }
        
        response = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=15)
        
        if response.status_code == 201:
            logger.info("✅ Test email sent successfully")
            print("✅ Test email sent successfully")
            return True
        else:
            logger.error(f"❌ Test failed: {response.status_code} - {response.text}")
            print(f"❌ Test failed: {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Test failed: {str(e)}")
        print(f"❌ Test failed: {str(e)}")
        return False