"""
Paystack webhook handlers for subscription events.
"""
import json
import logging
from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import Subscription, PaymentHistory, School
from .paystack import webhook_verify

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def paystack_webhook(request):
    """
    Handle incoming webhooks from Paystack.

    Supported events:
    - charge.success: Payment completed successfully
    - subscription.create: New subscription created
    - subscription.not_renew: Subscription won't renew
    - subscription.disable: Subscription cancelled
    - invoice.payment_failed: Recurring payment failed
    """
    # Verify webhook signature
    if not webhook_verify(request):
        logger.warning("Invalid Paystack webhook signature")
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    try:
        payload = json.loads(request.body)
        event = payload.get('event')
        data = payload.get('data', {})

        logger.info(f"Received Paystack webhook: {event}")

        handlers = {
            'charge.success': handle_charge_success,
            'subscription.create': handle_subscription_create,
            'subscription.not_renew': handle_subscription_not_renew,
            'subscription.disable': handle_subscription_disable,
            'invoice.payment_failed': handle_payment_failed,
            'invoice.create': handle_invoice_create,
            'invoice.update': handle_invoice_update,
        }

        handler = handlers.get(event)
        if handler:
            handler(data)
        else:
            logger.info(f"Unhandled Paystack event: {event}")

        return JsonResponse({'status': 'success'})

    except json.JSONDecodeError:
        logger.error("Invalid JSON in Paystack webhook")
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Error processing Paystack webhook: {str(e)}")
        return JsonResponse({'error': 'Processing error'}, status=500)


def handle_charge_success(data):
    """
    Handle successful charge/payment.

    This is triggered when a one-time or recurring payment succeeds.
    """
    reference = data.get('reference')
    amount = data.get('amount')
    customer = data.get('customer', {})
    metadata = data.get('metadata', {})
    authorization = data.get('authorization', {})

    logger.info(f"Processing successful charge: {reference}")

    try:
        # Find the payment record
        payment = PaymentHistory.objects.filter(paystack_reference=reference).first()

        if payment:
            # Update payment record
            payment.status = 'success'
            payment.paystack_transaction_id = str(data.get('id', ''))
            payment.paid_at = timezone.now()
            payment.payment_method = authorization.get('channel', '')
            payment.card_type = authorization.get('card_type', '')
            payment.card_last4 = authorization.get('last4', '')
            payment.bank_name = authorization.get('bank', '')
            payment.save()

            # Update subscription
            subscription = payment.subscription
            subscription.status = 'active'

            # Save authorization for future charges
            if authorization.get('authorization_code'):
                subscription.paystack_authorization_code = authorization['authorization_code']

            # Always store the billing email for future charge_authorization calls
            if customer.get('email'):
                subscription.paystack_billing_email = customer['email']

            # Set customer code if not already set
            if customer.get('customer_code') and not subscription.paystack_customer_code:
                subscription.paystack_customer_code = customer['customer_code']

            # Enable auto-debit if user opted in (but don't touch it for scheduler-initiated charges)
            if metadata.get('save_card') is True:
                subscription.auto_debit_enabled = True

            # Extend subscription period based on billing cycle
            if payment.billing_cycle == 'monthly':
                subscription.current_period_end = timezone.now() + timedelta(days=30)
            else:  # annual
                subscription.current_period_end = timezone.now() + timedelta(days=365)

            subscription.current_period_start = timezone.now()
            subscription.last_expiry_warning_sent = ''  # Reset warning tracker on renewal
            subscription.auto_debit_retry_count = 0     # Reset retry state on any successful payment
            subscription.auto_debit_next_retry = None
            subscription.save()

            logger.info(f"Updated subscription for school: {subscription.school.name}")

            # Send confirmation notification
            _send_payment_confirmation(subscription, payment)

        else:
            # Check if this is a new registration payment
            school_id = metadata.get('school_id')
            if school_id:
                try:
                    school = School.objects.get(id=school_id)
                    subscription = school.subscription

                    # Create payment record
                    payment = PaymentHistory.objects.create(
                        subscription=subscription,
                        paystack_reference=reference,
                        paystack_transaction_id=str(data.get('id', '')),
                        amount=amount,
                        status='success',
                        payment_method=authorization.get('channel', ''),
                        card_type=authorization.get('card_type', ''),
                        card_last4=authorization.get('last4', ''),
                        plan_name=subscription.plan.display_name,
                        billing_cycle=subscription.billing_cycle,
                        paid_at=timezone.now()
                    )

                    # Activate subscription
                    subscription.status = 'active'

                    # Update plan from metadata
                    plan_name = metadata.get('plan') or metadata.get('new_plan')
                    if plan_name:
                        from .models import SubscriptionPlan
                        new_plan = SubscriptionPlan.objects.filter(name=plan_name).first()
                        if new_plan:
                            subscription.plan = new_plan

                    if authorization.get('authorization_code'):
                        subscription.paystack_authorization_code = authorization['authorization_code']
                    if customer.get('email'):
                        subscription.paystack_billing_email = customer['email']
                    if customer.get('customer_code'):
                        subscription.paystack_customer_code = customer['customer_code']
                    if metadata.get('save_card') is True:
                        subscription.auto_debit_enabled = True
                    subscription.current_period_start = timezone.now()
                    if subscription.billing_cycle == 'monthly':
                        subscription.current_period_end = timezone.now() + timedelta(days=30)
                    else:
                        subscription.current_period_end = timezone.now() + timedelta(days=365)
                    subscription.save()

                    logger.info(f"Activated new subscription for school: {school.name}")

                    # Send onboarding welcome email for brand-new paid subscriptions
                    try:
                        from .educare_emails import send_onboarding_welcome_email
                        send_onboarding_welcome_email(subscription, registration_type='subscribe')
                    except Exception as e:
                        logger.error(f"Error sending onboarding email: {str(e)}")

                except School.DoesNotExist:
                    logger.error(f"School not found for payment: {school_id}")
            else:
                logger.warning(f"No payment record found for reference: {reference}")

    except Exception as e:
        logger.error(f"Error handling charge success: {str(e)}")


def handle_subscription_create(data):
    """
    Handle new Paystack subscription creation.
    """
    subscription_code = data.get('subscription_code')
    email_token = data.get('email_token')
    customer = data.get('customer', {})

    logger.info(f"Processing subscription create: {subscription_code}")

    try:
        # Find subscription by customer code
        customer_code = customer.get('customer_code')
        if customer_code:
            subscription = Subscription.objects.filter(
                paystack_customer_code=customer_code
            ).first()

            if subscription:
                subscription.paystack_subscription_code = subscription_code
                subscription.paystack_email_token = email_token
                subscription.status = 'active'
                subscription.save()

                logger.info(f"Updated subscription code for school: {subscription.school.name}")

    except Exception as e:
        logger.error(f"Error handling subscription create: {str(e)}")


def handle_subscription_not_renew(data):
    """
    Handle subscription marked as not renewing.

    The subscription is still active but will not auto-renew.
    """
    subscription_code = data.get('subscription_code')

    logger.info(f"Processing subscription not renew: {subscription_code}")

    try:
        subscription = Subscription.objects.filter(
            paystack_subscription_code=subscription_code
        ).first()

        if subscription:
            # Subscription is still active until period ends
            # Just log this for now
            logger.info(f"Subscription not renewing for school: {subscription.school.name}")

            # Optionally send notification to school admin
            _send_subscription_ending_notification(subscription)

    except Exception as e:
        logger.error(f"Error handling subscription not renew: {str(e)}")


def handle_subscription_disable(data):
    """
    Handle subscription cancellation/disable.
    """
    subscription_code = data.get('subscription_code')

    logger.info(f"Processing subscription disable: {subscription_code}")

    try:
        subscription = Subscription.objects.filter(
            paystack_subscription_code=subscription_code
        ).first()

        if subscription:
            subscription.status = 'cancelled'
            subscription.cancelled_at = timezone.now()
            subscription.save()

            logger.info(f"Cancelled subscription for school: {subscription.school.name}")

            # Send cancellation notification
            _send_cancellation_notification(subscription)

    except Exception as e:
        logger.error(f"Error handling subscription disable: {str(e)}")


def handle_payment_failed(data):
    """
    Handle failed recurring payment.
    """
    subscription_code = data.get('subscription', {}).get('subscription_code')
    invoice = data.get('invoice', {})

    logger.info(f"Processing payment failed for subscription: {subscription_code}")

    try:
        subscription = Subscription.objects.filter(
            paystack_subscription_code=subscription_code
        ).first()

        if subscription:
            subscription.status = 'past_due'
            subscription.save()

            logger.info(f"Marked subscription as past_due for school: {subscription.school.name}")

            # Send payment failed notification
            _send_payment_failed_notification(subscription)

    except Exception as e:
        logger.error(f"Error handling payment failed: {str(e)}")


def handle_invoice_create(data):
    """
    Handle invoice creation for upcoming renewal.
    """
    subscription = data.get('subscription', {})
    subscription_code = subscription.get('subscription_code')

    logger.info(f"Invoice created for subscription: {subscription_code}")

    # Could send upcoming payment notification here


def handle_invoice_update(data):
    """
    Handle invoice update events.
    """
    logger.info(f"Invoice updated: {data.get('id')}")


# Helper functions for notifications — use EduCare-branded emails

def _send_payment_confirmation(subscription, payment):
    """Send payment confirmation email via EduCare branding."""
    try:
        from .educare_emails import send_educare_payment_confirmation
        send_educare_payment_confirmation(subscription, payment)
    except Exception as e:
        logger.error(f"Error sending payment confirmation: {str(e)}")


def _send_subscription_ending_notification(subscription):
    """Send notification that subscription won't renew."""
    try:
        from .educare_emails import send_expiry_warning_email
        # Calculate days remaining
        if subscription.current_period_end:
            days = (subscription.current_period_end - timezone.now()).days
            send_expiry_warning_email(subscription, max(1, days))
        else:
            send_expiry_warning_email(subscription, 1)
    except Exception as e:
        logger.error(f"Error sending subscription ending notification: {str(e)}")


def _send_cancellation_notification(subscription):
    """Send subscription cancellation confirmation."""
    try:
        from .educare_emails import send_educare_cancellation_email
        send_educare_cancellation_email(subscription)
    except Exception as e:
        logger.error(f"Error sending cancellation notification: {str(e)}")


def _send_payment_failed_notification(subscription):
    """Send payment failed notification."""
    try:
        from .educare_emails import send_educare_payment_failed_email
        send_educare_payment_failed_email(subscription)
    except Exception as e:
        logger.error(f"Error sending payment failed notification: {str(e)}")
