from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

from .. import stripe_pay
from ..auth import store as users
from ..catalog import CREDIT_PACKS, PLANS
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


@router.post("/validate", response_model=ValidateResult)
async def validate(req: ValidateRequest) -> ValidateResult:
    # PROD RULE: no fake successes. Until real App Store / Play receipt
    # verification is wired (needs a store build — Expo Go can't do IAP), this
    # endpoint refuses instead of pretending the receipt checked out. Plans are
    # granted through the REAL path: Stripe card checkout + verified webhook.
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        detail="store receipt validation is not live yet — purchase plans via card checkout",
    )
