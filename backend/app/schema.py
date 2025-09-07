from pydantic import BaseModel

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    stream: bool = True 

class ChatResponse(BaseModel):
    response: str

class ChatMessage(BaseModel):
    role: str
    content: str

