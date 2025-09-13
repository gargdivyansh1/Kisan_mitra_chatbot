from fastapi import APIRouter
from typing import List

from backend.app.logic import run_conversation
from backend.app.schema import ChatRequest, ChatResponse, ChatMessage
from backend.app.database import load_chat_history, DB_PATH
import sqlite3

router = APIRouter(
    prefix="/farmer_query",
    tags=["chatBot"]
)

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    Endpoint to handle farmer chat messages
    """
    assistant_reply = run_conversation(
        user_id=request.user_id,
        session_id=request.session_id,
        user_input=request.message,
    )
    return ChatResponse(response=assistant_reply)


@router.get("/session/{user_id}/{session_id}/history", response_model=List[ChatMessage])
def get_session_history(user_id: str, session_id: str):
    """
    Return all chat messages for a given session.
    """
    print(user_id)
    rows = load_chat_history(user_id, session_id)
    formatted = []
    for role, msg in rows:
        role_name = "human" if role == "human" else "assistant"
        formatted.append({"role": role_name, "content": msg})
    return formatted


@router.get("/allSession_user/{user_id}", response_model=List[str])
def get_all_sessions_user(user_id: str):
    """
    Return all distinct session IDs for a given user.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT session_id
        FROM farmer_chat_history
        WHERE user_id=?
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]
