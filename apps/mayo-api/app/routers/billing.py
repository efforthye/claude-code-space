from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

from .. import stripe_pay
from ..auth import store as users
from ..catalog import PLANS
from ..schemas import BillingProduct, Plan, ValidateRequest, ValidateResult

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


class CheckoutRequest(BaseModel):
    planId: str


class CheckoutResult(BaseModel):
    url: str  # Stripe-hosted payment page


@router.post("/checkout", response_model=CheckoutResult)
async def checkout(
    req: CheckoutRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> CheckoutResult:
    """Start a card payment (web) for a plan. Requires a signed-in user so the
    webhook can grant the plan to the right account."""
    user = users.user_for_session(x_mayo_session or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign in to purchase a plan")
    if req.planId not in {p.id for p in PLANS if p.monthly > 0}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown plan '{req.planId}'")
    try:
        url = await stripe_pay.create_checkout_session(req.planId, user["id"])
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
        user_id, plan_id = completed
        users.set_plan(user_id, plan_id)
    # Other event types are acknowledged and ignored.
    return {"received": True}


@router.post("/validate", response_model=ValidateResult)
async def validate(req: ValidateRequest) -> ValidateResult:
    # Seam for real receipt validation: a live impl verifies req.receipt with the
    # App Store / Play Developer API, then records the entitlement against the
    # user. Here it just maps the product id back to a plan.
    plan_id = next((p.id for p in PLANS if f".{p.id}." in req.productId), None)
    if plan_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown product '{req.productId}'")
    return ValidateResult(entitled=True, planId=plan_id)
