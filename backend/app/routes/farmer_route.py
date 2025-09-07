from fastapi import FastAPI, APIRouter
from app.index import run_conversation, get_thread_memory, getting_all_threads_for_user
from app.schema import ChatRequest, ChatResponse, ChatMessage
from typing import List

router = APIRouter(
    prefix = "/farmer_query",
    tags = ["chatBot"]
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
        stream = False
    )
    return ChatResponse(response=assistant_reply)

@router.get("/session/{session_id}/history", response_model=List[ChatMessage])
def get_session_history(session_id: str):
    """Return all the chat messages for a given session."""
    history = get_thread_memory(session_id)
    messages = history.messages # type:ignore

    formatted = []
    for msg in messages:
        if hasattr(msg, "content"):
            role = "human" if msg.type == "human" else "assistant"
            formatted.append({"role": role, "content": msg.content})

    return formatted

@router.get("/allSession_user/{user_id}", response_model=List[str])
def get_all_session_user(user_id: str):
    """Return all the session for the particular user"""
    sessions = getting_all_threads_for_user(user_id)
    return sessions
