/**
 * Paystack integration for frontend payments.
 *
 * Uses Paystack Inline JS for popup payments.
 * Make sure to include the Paystack script in index.html:
 * <script src="https://js.paystack.co/v1/inline.js"></script>
 */

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxx';

/**
 * Initialize a Paystack popup payment.
 *
 * @param {Object} options Payment options
 * @param {string} options.email Customer email
 * @param {number} options.amount Amount in kobo (100 kobo = 1 NGN)
 * @param {string} options.reference Unique transaction reference
 * @param {Object} options.metadata Additional data to attach
 * @param {Function} options.onSuccess Callback on successful payment
 * @param {Function} options.onClose Callback when popup is closed
 * @param {string} options.currency Currency code (default: NGN)
 */
export function payWithPaystack({
  email,
  amount,
  reference,
  metadata = {},
  onSuccess,
  onClose,
  currency = 'NGN',
}) {
  // Check if Paystack is loaded
  if (typeof PaystackPop === 'undefined') {
    console.error('Paystack script not loaded. Add it to index.html');
    alert('Payment service unavailable. Please refresh and try again.');
    return;
  }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount,
    ref: reference,
    currency,
    metadata,
    callback: (response) => {
      // Payment was successful
      if (onSuccess) {
        onSuccess(response);
      }
    },
    onClose: () => {
      // User closed the popup without completing payment
      if (onClose) {
        onClose();
      }
    },
  });

  handler.openIframe();
}

/**
 * Generate a unique payment reference.
 *
 * @param {string} prefix Optional prefix for the reference
 * @returns {string} Unique reference string
 */
export function generateReference(prefix = 'pay') {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomStr}`;
}

/**
 * Format amount from kobo to Naira display string.
 *
 * @param {number} kobo Amount in kobo
 * @returns {string} Formatted Naira amount
 */
export function formatAmountFromKobo(kobo) {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(naira);
}

/**
 * Convert Naira to kobo.
 *
 * @param {number} naira Amount in Naira
 * @returns {number} Amount in kobo
 */
export function nairaToKobo(naira) {
  return Math.round(naira * 100);
}

/**
 * Convert kobo to Naira.
 *
 * @param {number} kobo Amount in kobo
 * @returns {number} Amount in Naira
 */
export function koboToNaira(kobo) {
  return kobo / 100;
}

export default {
  payWithPaystack,
  generateReference,
  formatAmountFromKobo,
  nairaToKobo,
  koboToNaira,
};
