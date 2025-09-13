from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes.farmer_route import router as farmer_route  
from backend.app.database import init_db
from backend.app.logic import run_conversation_stream

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(farmer_route)

@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await run_conversation_stream(user_id, session_id, data, websocket)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for {user_id}-{session_id}")
