from fastapi import APIRouter, HTTPException, status

from ..catalog import PLANS
from ..schemas import BillingProduct, Plan, ValidateRequest, ValidateResult

router = APIRouter(prefix="/v1/billing", tags=["billing"])


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


@router.post("/validate", response_model=ValidateResult)
async def validate(req: ValidateRequest) -> ValidateResult:
    # Seam for real receipt validation: a live impl verifies req.receipt with the
    # App Store / Play Developer API, then records the entitlement against the
    # user. Here it just maps the product id back to a plan.
    plan_id = next((p.id for p in PLANS if f".{p.id}." in req.productId), None)
    if plan_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown product '{req.productId}'")
    return ValidateResult(entitled=True, planId=plan_id)
