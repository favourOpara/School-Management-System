"""
Email verification and password reset views
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
import secrets
from datetime import timedelta
from django.utils import timezone
from django.conf import settings

from .models import CustomUser
from logs.email_service import send_verification_email


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_email(request, token):
    """
    Verify user email using token from verification email.
    This confirms the username is linked to the email address.
    After verification, user must change their password.
    """
    try:
        user = CustomUser.objects.get(email_verification_token=token)
    except CustomUser.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Invalid or expired verification link'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if token is expired (24 hours)
    if user.email_verification_sent_at:
        expiry_time = user.email_verification_sent_at + timedelta(hours=24)
        if timezone.now() > expiry_time:
            return Response({
                'status': 'error',
                'message': 'Verification link has expired. Please contact administration.'
            }, status=status.HTTP_400_BAD_REQUEST)

    # Mark email as verified
    user.email_verified = True
    user.save()

    return Response({
        'status': 'success',
        'message': 'Email verified successfully! You can now set your password.',
        'username': user.username,
        'token': token  # Return token for password change
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_and_change_password(request, token):
    """
    Verify email and change password in one step.
    This is the main endpoint users will use from the verification email.
    """
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not new_password or not confirm_password:
        return Response({
            'status': 'error',
            'message': 'Both new_password and confirm_password are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if passwords match
    if new_password != confirm_password:
        return Response({
            'status': 'error',
            'message': 'Passwords do not match'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Validate password strength
    if len(new_password) < 8:
        return Response({
            'status': 'error',
            'message': 'Password must be at least 8 characters long'
        }, status=status.HTTP_400_BAD_REQUEST)

    has_upper = any(c.isupper() for c in new_password)
    has_lower = any(c.islower() for c in new_password)
    has_digit = any(c.isdigit() for c in new_password)

    if not (has_upper and has_lower and has_digit):
        return Response({
            'status': 'error',
            'message': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = CustomUser.objects.get(email_verification_token=token)
    except CustomUser.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Invalid or expired verification link'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if token is expired (24 hours)
    if user.email_verification_sent_at:
        expiry_time = user.email_verification_sent_at + timedelta(hours=24)
        if timezone.now() > expiry_time:
            return Response({
                'status': 'error',
                'message': 'Verification link has expired. Please contact administration.'
            }, status=status.HTTP_400_BAD_REQUEST)

    # Mark email as verified
    user.email_verified = True
    user.must_change_password = False
    user.set_password(new_password)
    user.email_verification_token = None  # Clear token after use
    user.save()

    return Response({
        'status': 'success',
        'message': 'Email verified and password set successfully! You can now login.',
        'username': user.username
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification_email(request):
    """
    Resend verification email if user lost it or it expired.
    Requires username and email for security.
    """
    username = request.data.get('username')
    email = request.data.get('email')

    if not username or not email:
        return Response({
            'status': 'error',
            'message': 'Username and email are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = CustomUser.objects.get(username=username, email=email)
    except CustomUser.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'No account found with that username and email combination'
        }, status=status.HTTP_404_NOT_FOUND)

    # Check if already verified
    if user.email_verified and not user.must_change_password:
        return Response({
            'status': 'error',
            'message': 'Your email is already verified and password is set. You can login.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Generate new token
    token = secrets.token_urlsafe(32)
    user.email_verification_token = token
    user.email_verification_sent_at = timezone.now()
    user.save()

    # Build verification URL using FRONTEND_URL setting
    verification_url = f"{settings.FRONTEND_URL}/verify-email/{token}"

    # Send email
    send_verification_email(user, verification_url)

    return Response({
        'status': 'success',
        'message': 'Verification email has been resent. Please check your inbox.'
    }, status=status.HTTP_200_OK)
