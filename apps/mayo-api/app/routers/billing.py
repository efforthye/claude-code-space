from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

from .. import stripe_pay
from ..auth import store as users
from ..catalog import CREDIT_PACKS, PLANS
from ..config import settings
from ..schemas import BillingProduct, CreditPack, Plan, ValidateRequest, ValidateResult

router = APIRouter(prefix="/v1/billing", tags=["billing"])

# Stripe calls this without our API key — mounted WITHOUT the shared-key guard in
# main.py; the webhook signature (verified below) is its authentication.
webhook_router = APIRouter(prefix="/v1/billing", tags=["billing"])


def _product_for(plan: Plan) -> BillingProduct:
    return BillingProduct(
        id=f"im.mayo.{plan.id}.monthly",
        planId=plan.id,
        priceLabel=f"${plan.monthly}/mo",
    )


@router.get("/products", response_model=list[BillingProduct])
async def products() -> list[BillingProduct]:
    # Only paid plans are purchasable; free needs no product.
    return [_product_for(p) for p in PLANS if p.monthly > 0]


@router.get("/packs", response_model=list[CreditPack])
async def packs() -> list[CreditPack]:
    """One-time credit packs — purchasable with or WITHOUT a subscription."""
    return CREDIT_PACKS


class CheckoutRequest(BaseModel):
    planId: str | None = None  # subscription checkout ...
    packId: str | None = None  # ... OR a one-time credit pack (exactly one)


class CheckoutResult(BaseModel):
    url: str  # Stripe-hosted payment page


@router.post("/checkout", response_model=CheckoutResult)
async def checkout(
    req: CheckoutRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> CheckoutResult:
    """Start a card payment (web) for a plan OR a credit pack. Requires a
    signed-in user so the webhook can grant to the right account."""
    user = users.user_for_session(x_mayo_session or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign in to purchase")
    if bool(req.planId) == bool(req.packId):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="pass exactly one of planId or packId"
        )
    try:
        if req.planId:
            if req.planId not in {p.id for p in PLANS if p.monthly > 0}:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, detail=f"unknown plan '{req.planId}'"
                )
            url = await stripe_pay.create_checkout_session(req.planId, user["id"])
        else:
            pack = next((p for p in CREDIT_PACKS if p.id == req.packId), None)
            if pack is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, detail=f"unknown pack '{req.packId}'"
                )
            url = await stripe_pay.create_pack_checkout(pack.id, pack.credits, user["id"])
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return CheckoutResult(url=url)


@webhook_router.post("/stripe-webhook")
async def stripe_webhook(
    request: Request, stripe_signature: Optional[str] = Header(default=None)
) -> dict:
    payload = await request.body()
    if not stripe_pay.verify_webhook_signature(payload, stripe_signature or ""):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="bad signature")
    completed = stripe_pay.parse_completed_checkout(payload)
    if completed:
        from .. import ledger

        ledger.record(
            "purchase",
            completed.get("userId"),
            product=completed.get("planId") or f"pack:{completed.get('credits')}",
            amount=completed.get("planId") or f"{completed.get('credits')} credits",
        )
        if completed.get("planId"):
            plan_id = completed["planId"]
            users.set_plan(completed["userId"], plan_id)
            # First month's subscription credits land immediately (renewal
            # grants arrive with the invoice-paid webhook when we wire it).
            plan = next((p for p in PLANS if p.id == plan_id), None)
            if plan and plan.monthlyCredits:
                users.add_credits(completed["userId"], plan.monthlyCredits)
        elif completed.get("credits"):
            users.add_purchased_credits(completed["userId"], int(completed["credits"]))
    # Other event types are acknowledged and ignored.
    return {"received": True}


# App Store product ids (must match App Store Connect) -> what they grant.
# Subscriptions grant the plan + first month's credits; consumable packs grant
# purchased credits (premium-capable, same as the card path — ADR 0017 v2).
IAP_SUBSCRIPTIONS = {"im.mayo.pro.monthly": "pro", "im.mayo.studio.monthly": "studio"}
IAP_PACKS = {f"im.mayo.{p.id}": p.credits for p in CREDIT_PACKS}

_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt"
_VERIFY_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt"


async def _apple_verify(receipt: str) -> dict:
    """Ask Apple to validate the receipt. Production first; 21007 = a sandbox
    receipt (TestFlight/dev build) -> retry against the sandbox host, per
    Apple's documented flow. Returns Apple's JSON."""
    import httpx

    body = {"receipt-data": receipt, "password": settings.apple_shared_secret}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(_VERIFY_URL, json=body)
        data = resp.json()
        if data.get("status") == 21007:
            resp = await client.post(_VERIFY_SANDBOX_URL, json=body)
            data = resp.json()
    return data


@router.post("/validate", response_model=ValidateResult)
async def validate(
    req: ValidateRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> ValidateResult:
    """REAL App Store receipt validation (verifyReceipt + shared secret).

    PROD RULE: no fake successes — unconfigured server answers 501, a receipt
    Apple rejects answers 400, and grants only ever follow Apple saying yes.
    """
    if req.platform != "appstore":
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED,
            detail="only App Store receipts are supported for now",
        )
    if not settings.apple_shared_secret:
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED,
            detail="store receipt validation is not configured on this server yet",
        )
    user = users.user_for_session(x_mayo_session or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign in first")
    if not req.receipt:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="missing receipt")

    data = await _apple_verify(req.receipt)
    if data.get("status") != 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=f"receipt rejected (status {data.get('status')})"
        )
    # The purchased product must actually appear in the receipt Apple returned.
    purchases = list(data.get("latest_receipt_info") or []) + list(
        (data.get("receipt") or {}).get("in_app") or []
    )
    if not any(p.get("product_id") == req.productId for p in purchases):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="receipt does not contain this product"
        )

    from .. import ledger

    ledger.record(
        "purchase", user["id"], email=user.get("email", ""), product=req.productId,
        amount="appstore",
    )
    if req.productId in IAP_SUBSCRIPTIONS:
        plan_id = IAP_SUBSCRIPTIONS[req.productId]
        users.set_plan(user["id"], plan_id)
        plan = next((p for p in PLANS if p.id == plan_id), None)
        if plan and plan.monthlyCredits:
            users.add_credits(user["id"], plan.monthlyCredits)
        return ValidateResult(entitled=True, planId=plan_id)
    if req.productId in IAP_PACKS:
        users.add_purchased_credits(user["id"], IAP_PACKS[req.productId])
        return ValidateResult(entitled=True, planId=user.get("planId", "free"))
    raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown product '{req.productId}'")
