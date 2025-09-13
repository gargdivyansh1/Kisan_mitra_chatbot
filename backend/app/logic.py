from typing import Dict
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from dotenv import load_dotenv

LANGCHAIN_PROJECT='kisan_mitra_new'

load_dotenv()

from backend.app.database import save_message, load_chat_history, save_user_summary, get_user_summary

chat_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
summary_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

store: Dict[str, InMemoryChatMessageHistory] = {}
session_summary_cache: Dict[str, str] = {}

summary_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a summarizer. Read the conversation snippet and update the running summary "
     "about the farmer. Always output the full updated summary, not just the new info."),
    ("human", "Current summary:\n{current_summary}\n\nNew snippet:\n{conversation_snippet}")
])

def update_summary(user_id: str, snippet: str) -> str:
    old_summary = get_user_summary(user_id)
    out = (summary_prompt | summary_llm).invoke({
        "current_summary": old_summary or "No summary yet.",
        "conversation_snippet": snippet
    })
    new_summary = getattr(out, "content", str(out)).strip()
    save_user_summary(user_id, new_summary)
    session_summary_cache[user_id] = new_summary
    return new_summary

def build_prompt_with_summary(summary: str) -> ChatPromptTemplate:
    system_msg = (
        "You are a farmer assistant. Here is the long-term summary about the farmer:\n\n"
        f"{summary or 'No summary yet.'}\n\n"
        "Use this summary to answer queries. Do not invent details."
    )
    return ChatPromptTemplate.from_messages([
        ("system", system_msg),
        MessagesPlaceholder("history"),
        ("human", "{input}")
    ])

def run_conversation(user_id: str, session_id: str, user_input: str) -> str:
    summary = session_summary_cache.get(user_id) or get_user_summary(user_id)
    prompt_with_summary = build_prompt_with_summary(summary)

    chain = prompt_with_summary | chat_llm

    # Load or create history
    if session_id not in store:
        history = InMemoryChatMessageHistory()
        for role, msg in load_chat_history(user_id, session_id):
            history.add_message({"role": role, "content": msg}) #type:ignore
        store[session_id] = history

    with_message_history = RunnableWithMessageHistory(
        chain,
        lambda sid: store[sid],
        input_messages_key="input",
        history_messages_key="history"
    )

    result = with_message_history.invoke(
        {"input": user_input},
        config={"configurable": {"session_id": session_id}}
    )
    assistant_text = result.content if hasattr(result, "content") else str(result)

    save_message(user_id, session_id, "human", user_input)
    save_message(user_id, session_id, "ai", assistant_text)

    snippet = f"Farmer: {user_input}\nAssistant: {assistant_text}"
    update_summary(user_id, snippet)

    return assistant_text


async def run_conversation_stream(user_id: str, session_id: str, user_input: str, websocket):
    summary = session_summary_cache.get(user_id) or get_user_summary(user_id)
    prompt_with_summary = build_prompt_with_summary(summary)

    chain = prompt_with_summary | chat_llm

    if session_id not in store:
        history = InMemoryChatMessageHistory()
        for role, msg in load_chat_history(user_id, session_id):
            history.add_message({"role": role, "content": msg}) #type:ignore
        store[session_id] = history

    with_message_history = RunnableWithMessageHistory(
        chain,
        lambda sid: store[sid],
        input_messages_key="input",
        history_messages_key="history"
    )

    full_response = ""
    async for chunk in with_message_history.astream(
        {"input": user_input},
        config={"configurable": {"session_id": session_id}}
    ):
        content = chunk.content if hasattr(chunk, "content") else str(chunk)
        if content:
            full_response += content
            await websocket.send_text(content)

    save_message(user_id, session_id, "human", user_input)
    save_message(user_id, session_id, "ai", full_response)

    snippet = f"Farmer: {user_input}\nAssistant: {full_response}"
    update_summary(user_id, snippet)
