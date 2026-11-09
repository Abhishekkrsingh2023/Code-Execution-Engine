"""Email delivery service powered by Resend SDK.

Provides async wrappers around the Resend Python SDK for transactional emails,
specifically user registration and OTP verification codes.
"""

import asyncio
from typing import Any

import resend
from loguru import logger

from app.config import settings


def get_sender_address() -> str:
    """Format and return the sender email address."""
    from_email = settings.FROM_EMAIL.strip() if settings.FROM_EMAIL else "codersclub@bbitclub.io"
    if "<" in from_email and ">" in from_email:
        return from_email
    return f"code0 <{from_email}>"


def build_otp_email_html(otp_code: str, name: str | None = None) -> str:
    """Render a responsive HTML email template for OTP verification."""
    greeting = f"Hello {name}," if name and name.strip() else "Hello,"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>code0 Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8;">code0</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Verify your email address</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 24px; font-size: 14px; line-height: 22px; color: #94a3b8;">
              {greeting}
              <br><br>
              Thank you for registering on <strong>code0</strong>. Please use the following One-Time Password (OTP) to complete your verification:
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 16px 0 24px 0;">
              <div style="background-color: #0f172a; border: 1px solid #38bdf8; border-radius: 8px; padding: 16px 28px; display: inline-block;">
                <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #38bdf8;">{otp_code}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 24px; font-size: 13px; line-height: 20px; color: #94a3b8;">
              ⏱ This code is valid for <strong>10 minutes</strong>. For your security, do not share this code with anyone.
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; line-height: 18px; color: #64748b; text-align: center;">
              If you didn't create an account with code0, you can safely ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def build_otp_email_text(otp_code: str, name: str | None = None) -> str:
    """Render plain text fallback for OTP verification."""
    greeting = f"Hello {name}," if name and name.strip() else "Hello,"
    return (
        f"{greeting}\n\n"
        f"Thank you for registering on code0.\n"
        f"Your verification code is: {otp_code}\n\n"
        f"This code is valid for 10 minutes. For your security, do not share this code with anyone.\n"
        f"If you didn't create an account with code0, you can safely ignore this email.\n"
    )


async def send_otp_email(
    to_email: str,
    otp_code: str,
    name: str | None = None,
) -> dict[str, Any] | None:
    """Send an OTP verification email to the user via Resend.

    Args:
        to_email (str): Recipient's email address.
        otp_code (str): 6-digit OTP string.
        name (str | None): Recipient's display name or username.

    Returns:
        dict[str, Any] | None: Response dictionary from Resend API, or None if skipped.
    """
    api_key = settings.RESEND_API_KEY.strip() if settings.RESEND_API_KEY else ""
    if not api_key:
        logger.warning(
            "RESEND_API_KEY is not configured; skipping email delivery. OTP for {} is: {}",
            to_email,
            otp_code,
        )
        return None

    resend.api_key = api_key
    sender = get_sender_address()

    payload: resend.Emails.SendParams = {
        "from": sender,
        "to": [to_email],
        "subject": f"Your code0 verification code: {otp_code}",
        "html": build_otp_email_html(otp_code, name),
        "text": build_otp_email_text(otp_code, name),
    }

    try:
        # Offload synchronous Resend SDK HTTP request to thread pool
        result = await asyncio.to_thread(resend.Emails.send, payload)
        result_dict: dict[str, Any] = dict(result) if isinstance(result, dict) else {"id": str(result)}
        logger.info(
            "Sent verification OTP email to '{}' via Resend (id={})",
            to_email,
            result_dict.get("id"),
        )
        return result_dict
    except Exception as exc:
        logger.exception(
            "Failed to send OTP verification email to '{}' via Resend: {}", to_email, exc
        )
        raise
