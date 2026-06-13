import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api.deals import router as deals_router
from api.meetings import router as meetings_router
from api.intelligence import router as intelligence_router

app = FastAPI(title="Deal Intelligence Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "deal-intelligence-agent"}

app.include_router(deals_router, prefix="/api/v1")
app.include_router(meetings_router, prefix="/api/v1")
app.include_router(intelligence_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
