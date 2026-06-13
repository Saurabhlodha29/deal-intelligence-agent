from collections import Counter
from typing import List
from fastapi import APIRouter, HTTPException, status
from db.client import supabase
from models.deal import DealCreate, DealUpdate, DealResponse

router = APIRouter(prefix="/deals", tags=["deals"])

@router.get("/", response_model=List[DealResponse])
def list_deals():
    try:
        deals_res = supabase.table("deals").select("*").execute()
        meetings_res = supabase.table("meetings").select("deal_id").execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    meeting_counts = Counter(m["deal_id"] for m in meetings_res.data)

    deals = []
    for d in deals_res.data:
        d_copy = dict(d)
        d_copy["total_meetings"] = meeting_counts[d["id"]]
        deals.append(DealResponse(**d_copy))
    return deals

@router.post("/", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
def create_deal(deal: DealCreate):
    try:
        deal_data = deal.model_dump(exclude_unset=True)
        res = supabase.table("deals").insert(deal_data).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create deal record"
            )
        created_deal = res.data[0]
        deal_id = created_deal["id"]
        company = created_deal["company"]

        hindsight_tags = [
            f"deal:{deal_id}",
            f"company:{company.lower().replace(' ', '_')}"
        ]

        update_res = supabase.table("deals").update({"hindsight_tags": hindsight_tags}).eq("id", deal_id).execute()
        if not update_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update deal hindsight tags"
            )
        
        final_deal = update_res.data[0]
        final_deal["total_meetings"] = 0
        return DealResponse(**final_deal)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/{deal_id}", response_model=DealResponse)
def get_deal(deal_id: str):
    try:
        deal_res = supabase.table("deals").select("*").eq("id", deal_id).execute()
        if not deal_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        deal_data = deal_res.data[0]

        meetings_res = supabase.table("meetings").select("id").eq("deal_id", deal_id).execute()
        deal_data["total_meetings"] = len(meetings_res.data)
        
        return DealResponse(**deal_data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.put("/{deal_id}", response_model=DealResponse)
def update_deal(deal_id: str, deal_update: DealUpdate):
    try:
        update_data = deal_update.model_dump(exclude_none=True)
        
        if update_data:
            deal_res = supabase.table("deals").update(update_data).eq("id", deal_id).execute()
        else:
            deal_res = supabase.table("deals").select("*").eq("id", deal_id).execute()
            
        if not deal_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
            
        deal_data = deal_res.data[0]
        
        meetings_res = supabase.table("meetings").select("id").eq("deal_id", deal_id).execute()
        deal_data["total_meetings"] = len(meetings_res.data)
        
        return DealResponse(**deal_data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/{deal_id}")
def delete_deal(deal_id: str):
    try:
        res = supabase.table("deals").delete().eq("id", deal_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        return {"success": True, "id": deal_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
