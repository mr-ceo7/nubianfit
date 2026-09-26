"""
Transactional email via Resend (https://resend.com).
Without RESEND_API_KEY (dev/tests) messages are logged instead of sent.
"""

import html
import logging
from typing import List

import httpx

from app.config import settings

logger = logging.getLogger("nubianfit.email")

RESEND_ENDPOINT = "https://api.resend.com/emails"

# Tests inspect this to read login codes without a mail server.
outbox: List[dict] = []


class EmailDeliveryError(Exception):
    pass


async def send_email(to: str, subject: str, html_body: str, text_body: str) -> None:
    message = {"from": settings.FROM_EMAIL, "to": [to], "subject": subject, "html": html_body, "text": text_body}

    if not settings.RESEND_API_KEY:
        outbox.append(message)
        logger.info("Email (not sent, no RESEND_API_KEY) to=%s subject=%r\n%s", to, subject, text_body)
        return

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                RESEND_ENDPOINT,
                json=message,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
        res.raise_for_status()
    except httpx.HTTPError as e:
        logger.error("Resend delivery to %s failed: %s", to, e)
        raise EmailDeliveryError("Could not send email") from e


def _layout(heading: str, body_html: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;background:#0b1120;font-family:Helvetica,Arial,sans-serif;color:#e2e8f0">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:480px;background:#111827;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:#22d3ee;padding-bottom:8px">NubianFit</td></tr>
<tr><td style="font-size:18px;font-weight:600;padding-bottom:16px">{heading}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#cbd5e1">{body_html}</td></tr>
</table></td></tr></table></body></html>"""


async def send_login_code(to: str, code: str) -> None:
    minutes = settings.OTP_EXPIRE_MINUTES
    await send_email(
        to,
        f"Your NubianFit login code: {code}",
        _layout(
            "Your login code",
            f'<p>Enter this code to sign in:</p>'
            f'<p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#fff">{code}</p>'
            f"<p>It expires in {minutes} minutes. If you didn't request it, ignore this email.</p>",
        ),
        f"Your NubianFit login code is {code}. It expires in {minutes} minutes.",
    )


async def send_client_invite(to: str, client_name: str, coach_name: str) -> None:
    url = settings.CLIENT_URL
    await send_email(
        to,
        f"{coach_name} invited you to NubianFit",
        _layout(
            f"Welcome, {html.escape(client_name)}",
            f"<p>{html.escape(coach_name)} has set up your coaching account on NubianFit.</p>"
            f'<p><a href="{url}" style="display:inline-block;background:#22d3ee;color:#0b1120;'
            f'padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none">Open the app</a></p>'
            f"<p>Sign in with this email address and we'll send you a login code.</p>",
        ),
        f"{coach_name} invited you to NubianFit. Open {url} and sign in with this email address.",
    )
