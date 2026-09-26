"""
Minimal Paystack API client (https://paystack.com/docs/api/).

Amounts are in the currency's subunit (KES cents). Every call raises PaystackError with a
readable message on failure. Tests monkeypatch these functions.
"""

import hashlib
import json
import hmac
import logging
import time
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger("nubianfit.paystack")

BASE_URL = "https://api.paystack.co"
_bank_cache: Dict[str, tuple] = {}


class PaystackError(Exception):
    pass


def configured() -> bool:
    return bool(settings.PAYSTACK_SECRET_KEY)


async def _request(method: str, path: str, **kwargs) -> Dict[str, Any]:
    if not configured():
        raise PaystackError("Payments aren't set up yet (PAYSTACK_SECRET_KEY is missing).")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.request(
                method, f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}, **kwargs
            )
        body = res.json()
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("Paystack %s %s failed: %s", method, path, e)
        raise PaystackError("Couldn't reach Paystack. Try again shortly.") from e
    if res.status_code >= 400 or not body.get("status"):
        raise PaystackError(body.get("message") or f"Paystack error ({res.status_code})")
    return body.get("data") or {}


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """x-paystack-signature is HMAC-SHA512 of the raw body keyed with the secret key."""
    if not configured() or not signature:
        return False
    expected = hmac.new(settings.PAYSTACK_SECRET_KEY.encode(), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)


async def list_banks(country: str = "kenya") -> List[Dict[str, Any]]:
    """Settlement options Paystack supports in the country (cached for a day)."""
    hit = _bank_cache.get(country)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    banks = await _request("GET", "/bank", params={"country": country, "perPage": 200})
    result = [{"name": b["name"], "code": b["code"], "type": b.get("type", "")} for b in banks if b.get("active", True)]
    _bank_cache[country] = (time.monotonic() + 86400, result)
    return result


async def create_subaccount(business_name: str, bank_code: str, account_number: str, email: str) -> Dict[str, Any]:
    return await _request("POST", "/subaccount", json={
        "business_name": business_name,
        "bank_code": bank_code,
        "account_number": account_number,
        "percentage_charge": settings.PLATFORM_FEE_PERCENT,
        "primary_contact_email": email,
    })


async def update_subaccount(code: str, **fields) -> Dict[str, Any]:
    return await _request("PUT", f"/subaccount/{code}", json=fields)


async def initialize_transaction(
    *, email: str, amount: int, reference: str, callback_url: str, subaccount: str, metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """Returns {authorization_url, access_code, reference}. The coach's subaccount bears Paystack's fee."""

    return await _request("POST", "/transaction/initialize", json={
        "email": email,
        "amount": str(amount),
        "currency": settings.PAYMENT_CURRENCY,
        "reference": reference,
        "callback_url": callback_url,
        "subaccount": subaccount,
        "bearer": "subaccount",
        "metadata": json.dumps(metadata),
    })


async def verify_transaction(reference: str) -> Dict[str, Any]:
    return await _request("GET", f"/transaction/verify/{reference}")


async def charge_authorization(
    *, email: str, amount: int, authorization_code: str, reference: str, subaccount: str, metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """Charge a saved card for a renewal; same split as the original payment."""

    return await _request("POST", "/transaction/charge_authorization", json={
        "email": email,
        "amount": str(amount),
        "currency": settings.PAYMENT_CURRENCY,
        "authorization_code": authorization_code,
        "reference": reference,
        "subaccount": subaccount,
        "bearer": "subaccount",
        "metadata": json.dumps(metadata),
    })
