"""
Paystack API integration for subscription management.
"""
import requests
import uuid
from django.conf import settings
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

PAYSTACK_BASE_URL = 'https://api.paystack.co'


def get_headers() -> Dict[str, str]:
    """Get authorization headers for Paystack API calls."""
    return {
        'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}',
        'Content-Type': 'application/json',
    }


def initialize_transaction(
    email: str,
    amount: int,
    reference: Optional[str] = None,
    callback_url: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Initialize a Paystack transaction.

    Args:
        email: Customer's email address
        amount: Amount in kobo (100 kobo = 1 NGN)
        reference: Unique transaction reference (auto-generated if not provided)
        callback_url: URL to redirect after payment
        metadata: Additional data to attach to the transaction

    Returns:
        Dict with authorization_url and reference on success
    """
    if reference is None:
        reference = f'pay_{uuid.uuid4().hex[:16]}'

    payload = {
        'email': email,
        'amount': amount,
        'reference': reference,
        'currency': 'NGN',
    }

    if callback_url:
        payload['callback_url'] = callback_url

    if metadata:
        payload['metadata'] = metadata

    try:
        response = requests.post(
            f'{PAYSTACK_BASE_URL}/transaction/initialize',
            json=payload,
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status'):
            return {
                'success': True,
                'authorization_url': data['data']['authorization_url'],
                'access_code': data['data']['access_code'],
                'reference': data['data']['reference'],
            }
        else:
            logger.error(f"Paystack initialize failed: {data.get('message')}")
            return {'success': False, 'error': data.get('message', 'Unknown error')}

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack request error: {str(e)}")
        return {'success': False, 'error': str(e)}


def verify_transaction(reference: str) -> Dict[str, Any]:
    """
    Verify a Paystack transaction.

    Args:
        reference: Transaction reference to verify

    Returns:
        Dict with transaction details on success
    """
    try:
        response = requests.get(
            f'{PAYSTACK_BASE_URL}/transaction/verify/{reference}',
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status') and data['data']['status'] == 'success':
            return {
                'success': True,
                'data': {
                    'amount': data['data']['amount'],
                    'currency': data['data']['currency'],
                    'transaction_id': data['data']['id'],
                    'reference': data['data']['reference'],
                    'status': data['data']['status'],
                    'paid_at': data['data']['paid_at'],
                    'channel': data['data']['channel'],
                    'authorization': data['data'].get('authorization', {}),
                    'customer': data['data'].get('customer', {}),
                    'metadata': data['data'].get('metadata', {}),
                }
            }
        else:
            return {
                'success': False,
                'error': data.get('message', 'Transaction not successful'),
                'status': data['data'].get('status') if data.get('data') else None
            }

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack verify error: {str(e)}")
        return {'success': False, 'error': str(e)}


def create_plan(
    name: str,
    amount: int,
    interval: str = 'monthly',
    description: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a subscription plan on Paystack.

    Args:
        name: Plan name
        amount: Amount in kobo
        interval: Billing interval (hourly, daily, weekly, monthly, annually)
        description: Optional plan description

    Returns:
        Dict with plan details on success
    """
    payload = {
        'name': name,
        'amount': amount,
        'interval': interval,
    }

    if description:
        payload['description'] = description

    try:
        response = requests.post(
            f'{PAYSTACK_BASE_URL}/plan',
            json=payload,
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status'):
            return {
                'success': True,
                'plan_code': data['data']['plan_code'],
                'name': data['data']['name'],
                'amount': data['data']['amount'],
                'interval': data['data']['interval'],
            }
        else:
            logger.error(f"Paystack create plan failed: {data.get('message')}")
            return {'success': False, 'error': data.get('message', 'Unknown error')}

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack create plan error: {str(e)}")
        return {'success': False, 'error': str(e)}


def create_customer(email: str, first_name: str = '', last_name: str = '') -> Dict[str, Any]:
    """
    Create a customer on Paystack.

    Args:
        email: Customer's email
        first_name: Customer's first name
        last_name: Customer's last name

    Returns:
        Dict with customer details on success
    """
    payload = {
        'email': email,
        'first_name': first_name,
        'last_name': last_name,
    }

    try:
        response = requests.post(
            f'{PAYSTACK_BASE_URL}/customer',
            json=payload,
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status'):
            return {
                'success': True,
                'customer_code': data['data']['customer_code'],
                'email': data['data']['email'],
                'id': data['data']['id'],
            }
        else:
            logger.error(f"Paystack create customer failed: {data.get('message')}")
            return {'success': False, 'error': data.get('message', 'Unknown error')}

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack create customer error: {str(e)}")
        return {'success': False, 'error': str(e)}


def create_subscription(
    customer: str,
    plan: str,
    authorization: Optional[str] = None,
    start_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a subscription for a customer.

    Args:
        customer: Customer code or email
        plan: Plan code
        authorization: Authorization code for recurring billing
        start_date: ISO date when to start the subscription

    Returns:
        Dict with subscription details on success
    """
    payload = {
        'customer': customer,
        'plan': plan,
    }

    if authorization:
        payload['authorization'] = authorization

    if start_date:
        payload['start_date'] = start_date

    try:
        response = requests.post(
            f'{PAYSTACK_BASE_URL}/subscription',
            json=payload,
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status'):
            return {
                'success': True,
                'subscription_code': data['data']['subscription_code'],
                'email_token': data['data']['email_token'],
                'status': data['data']['status'],
                'next_payment_date': data['data'].get('next_payment_date'),
            }
        else:
            logger.error(f"Paystack create subscription failed: {data.get('message')}")
            return {'success': False, 'error': data.get('message', 'Unknown error')}

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack create subscription error: {str(e)}")
        return {'success': False, 'error': str(e)}


def cancel_subscription(code: str, token: str) -> Dict[str, Any]:
    """
    Cancel a subscription.

    Args:
        code: Subscription code
        token: Email token for the subscription

    Returns:
        Dict with cancellation status
    """
    payload = {
        'code': code,
        'token': token,
    }

    try:
        response = requests.post(
            f'{PAYSTACK_BASE_URL}/subscription/disable',
            json=payload,
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status'):
            return {'success': True, 'message': 'Subscription cancelled successfully'}
        else:
            logger.error(f"Paystack cancel subscription failed: {data.get('message')}")
            return {'success': False, 'error': data.get('message', 'Unknown error')}

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack cancel subscription error: {str(e)}")
        return {'success': False, 'error': str(e)}


def get_subscription(subscription_code: str) -> Dict[str, Any]:
    """
    Get subscription details.

    Args:
        subscription_code: Subscription code

    Returns:
        Dict with subscription details
    """
    try:
        response = requests.get(
            f'{PAYSTACK_BASE_URL}/subscription/{subscription_code}',
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status'):
            return {
                'success': True,
                'data': data['data']
            }
        else:
            return {'success': False, 'error': data.get('message', 'Unknown error')}

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack get subscription error: {str(e)}")
        return {'success': False, 'error': str(e)}


def charge_authorization(
    authorization_code: str,
    email: str,
    amount: int,
    reference: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Charge a saved card authorization for recurring payments.

    Args:
        authorization_code: Saved card authorization code
        email: Customer email
        amount: Amount in kobo
        reference: Unique reference
        metadata: Additional data

    Returns:
        Dict with charge details
    """
    if reference is None:
        reference = f'charge_{uuid.uuid4().hex[:16]}'

    payload = {
        'authorization_code': authorization_code,
        'email': email,
        'amount': amount,
        'reference': reference,
    }

    if metadata:
        payload['metadata'] = metadata

    try:
        response = requests.post(
            f'{PAYSTACK_BASE_URL}/transaction/charge_authorization',
            json=payload,
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status') and data['data']['status'] == 'success':
            return {
                'success': True,
                'reference': data['data']['reference'],
                'transaction_id': data['data']['id'],
                'status': data['data']['status'],
            }
        else:
            return {
                'success': False,
                'error': data.get('message', 'Charge failed'),
                'status': data['data'].get('status') if data.get('data') else None
            }

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack charge authorization error: {str(e)}")
        return {'success': False, 'error': str(e)}


def list_plans() -> Dict[str, Any]:
    """
    List all subscription plans on Paystack.

    Returns:
        Dict with list of plans
    """
    try:
        response = requests.get(
            f'{PAYSTACK_BASE_URL}/plan',
            headers=get_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        if data.get('status'):
            return {
                'success': True,
                'plans': data['data']
            }
        else:
            return {'success': False, 'error': data.get('message', 'Unknown error')}

    except requests.exceptions.RequestException as e:
        logger.error(f"Paystack list plans error: {str(e)}")
        return {'success': False, 'error': str(e)}


def webhook_verify(request) -> bool:
    """
    Verify that a webhook request came from Paystack.

    Args:
        request: Django request object

    Returns:
        Boolean indicating if signature is valid
    """
    import hmac
    import hashlib

    paystack_signature = request.headers.get('X-Paystack-Signature', '')
    if not paystack_signature:
        return False

    computed_signature = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode('utf-8'),
        request.body,
        hashlib.sha512
    ).hexdigest()

    return hmac.compare_digest(computed_signature, paystack_signature)
