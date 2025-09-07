from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from backend.app.routes import farmer_route

app = FastAPI(title="Kisan Mitra Chatbot API", version="1.0.0")

@app.head("/uptime")
def run():
    return {"status": "OK"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(farmer_route.router)

