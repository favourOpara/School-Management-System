/**
 * Fetch email quota and warn user if sending would exceed the daily limit.
 *
 * @param {Function} buildApiUrl - URL builder from SchoolContext
 * @param {number|null} recipientCount - Number of recipients (null = unknown)
 * @returns {Promise<boolean>} true if user confirms or quota is fine, false to abort
 */
export async function checkEmailQuotaBeforeSend(buildApiUrl, recipientCount = null) {
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(buildApiUrl('/schooladmin/email-quota/'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return true; // fail open — don't block if endpoint errors

    const { emails_sent_today, max_daily_emails, emails_remaining } = await res.json();

    // Unlimited plan
    if (max_daily_emails === 0 || emails_remaining === -1) return true;

    // No remaining emails
    if (emails_remaining <= 0) {
      alert(
        `You have reached your daily email limit of ${max_daily_emails} emails. ` +
        `No more emails can be sent today.\n\n` +
        `To send more emails, upgrade your plan from the Admin Portal.`
      );
      return false;
    }

    // Enough quota
    if (recipientCount !== null && recipientCount <= emails_remaining) return true;

    // Not enough quota — warn
    if (recipientCount !== null && recipientCount > emails_remaining) {
      return window.confirm(
        `You have ${emails_remaining} email(s) remaining today (${emails_sent_today}/${max_daily_emails} used).\n\n` +
        `This action will send to ${recipientCount} recipient(s). ` +
        `Only the first ${emails_remaining} will be delivered — the rest will be skipped.\n\n` +
        `Do you want to continue?`
      );
    }

    // Unknown recipient count — just inform
    if (emails_remaining < 20) {
      return window.confirm(
        `You have ${emails_remaining} email(s) remaining today (${emails_sent_today}/${max_daily_emails} used).\n\n` +
        `Some notifications may not be delivered if the limit is exceeded.\n\n` +
        `Do you want to continue?`
      );
    }

    return true;
  } catch {
    return true; // fail open
  }
}
