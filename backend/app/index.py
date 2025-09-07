import uuid
import time
from typing import List, Optional, Generator
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain.callbacks.base import BaseCallbackHandler
from langchain_core.messages import AIMessage
from pinecone import Pinecone, ServerlessSpec
import os 
import sqlite3

os.environ['LANGCHAIN_PROJECT'] = "farmer-query"

load_dotenv()

pc = Pinecone()
index_name = "farmer-assistant"

if index_name not in pc.list_indexes().names():
    pc.create_index(
        name=index_name,
        dimension=1024,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1")
    )

index = pc.Index(index_name)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

chat_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=True)
fact_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=False)

class StreamingCallbackHandler(BaseCallbackHandler):
    def __init__(self):
        self.tokens = []
        
    def on_llm_new_token(self, token: str, **kwargs) -> None:
        self.tokens.append(token)
        
    def get_full_response(self) -> str:
        return "".join(self.tokens)

def get_thread_memory(session_id: str) -> SQLChatMessageHistory:
    return SQLChatMessageHistory(
        session_id=session_id,
        connection_string="sqlite:///./farmer_chat_history.db"
    )

def getting_all_threads_for_user(user_id: str):
    """
    Fetch all distinct session IDs (threads) for a given user_id prefix.
    Example: user_id="user1" → ["user1_session_id1", "user1_session_id2"]
    """
    conn = sqlite3.connect("./farmer_chat_history.db")
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT session_id
        FROM message_store
        WHERE session_id LIKE ?
    """, (f"{user_id}_%",))  
    rows = cursor.fetchall()
    conn.close()

    return [row[0] for row in rows]

def add_fact_for_user(user_id: str, fact_text: str):
    fact_id = f"{user_id}__{uuid.uuid4().hex}"
    vector = embeddings.embed_query(fact_text)
    index.upsert(
        vectors=[{
            "id": fact_id,
            "values": vector,
            "metadata": {"fact": fact_text, "ts": time.time()}
        }],
        namespace=user_id
    )

def get_user_facts(user_id: str, n_results: int = 8) -> List[str]:
    query_vec = embeddings.embed_query("important facts about farmer")
    res = index.query(
        vector=query_vec,
        top_k=n_results,
        include_metadata=True,
        namespace=user_id
    )
    return [m["metadata"]["fact"] for m in res.get("matches", []) if "metadata" in m]  # type:ignore

fact_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a fact extractor specialized for farmers. Read the conversation snippet and extract "
     "only **one concise fact** about the farmer that should be stored in long-term memory. "
     "Output 'NONE' if there is no new fact. Facts must be short, deterministic, and in plain text. "
     "Focus on information that can help improve the farmer's revenue and farm management. "
     "Categories of facts to capture include (but are not limited to):\n"
     "- Farmer's name\n"
     "- Farm size and location\n"
     "- Crop types and varieties\n"
     "- Current season and planting schedule\n"
     "- Recent harvest or yield\n"
     "- Pest or disease issues\n"
     "- Soil type or irrigation methods\n"
     "- Machinery or resources available\n"
     "- Market preferences or crop selling strategy\n"
     "- Any goals or plans to increase revenue\n"
     "Example outputs:\n"
     "- Name: Ravi\n"
     "- Farm size: 2 acres, Uttar Pradesh\n"
     "- Crop: wheat\n"
     "- Crop: rice\n"
     "- Pest issue: locusts in wheat field\n"
     "- Goal: increase tomato yield\n"
     "Always output **only one fact per snippet**. Do not combine multiple facts."),
    ("human", "{conversation_snippet}")
])

def extract_fact_from_snippet(snippet: str) -> Optional[str]:
    out = (fact_prompt | fact_llm).invoke({"conversation_snippet": snippet})
    text = getattr(out, "content", str(out)).strip()
    if text.upper() == "NONE" or text == "":
        return None
    return text

def build_prompt_with_facts(facts: List[str]) -> ChatPromptTemplate:
    facts_text = "\n".join(f"- {f}" for f in facts) if facts else "- No saved facts."
    system_msg = (
        "You are a farmer assistant. You have access to the following long-term facts about the farmer:\n\n"
        f"{facts_text}\n\n"
        "Use these facts to answer farmer queries accurately. Do not invent facts; ask clarifying questions if unsure."
    )
    return ChatPromptTemplate.from_messages([
        ("system", system_msg),
        MessagesPlaceholder("history"),
        ("human", "{input}")
    ])

session_fact_cache = {}

def run_conversation_stream(user_id: str, session_id: str, user_input: str) -> Generator[str, None, None]:
    """
    Stream the conversation response token by token
    """
    if session_id not in session_fact_cache:
        facts = get_user_facts(user_id, n_results=8)
        session_fact_cache[session_id] = set(facts)
    else:
        facts = list(session_fact_cache[session_id])

    prompt_with_facts = build_prompt_with_facts(facts)

    streaming_callback = StreamingCallbackHandler()
    
    chain = RunnableWithMessageHistory(
        prompt_with_facts | chat_llm,
        get_thread_memory,
        input_messages_key="input",
        history_messages_key="history",
    )

    for chunk in chain.stream(
        {"input": user_input},
        config={"configurable": {"session_id": session_id}, "callbacks": [streaming_callback]}
    ):
        if hasattr(chunk, 'content'):
            yield chunk.content
        elif isinstance(chunk, str):
            yield chunk
    
    full_response = streaming_callback.get_full_response()
    
    message_history = get_thread_memory(session_id)
    message_history.add_user_message(user_input)
    message_history.add_ai_message(full_response)
    
    snippet = f"Farmer: {user_input}\nAssistant: {full_response}"
    new_fact = extract_fact_from_snippet(snippet)
    if new_fact:
        add_fact_for_user(user_id, new_fact)
        if session_id in session_fact_cache:
            session_fact_cache[session_id].add(new_fact)
        print(f"\n[Summary memory updated for {user_id}]: {new_fact}")

def run_conversation(user_id: str, session_id: str, user_input: str, stream: bool = False) -> str:
    """
    Main function that can handle both streaming and non-streaming responses
    """
    if stream:
        full_response = ""
        for token in run_conversation_stream(user_id, session_id, user_input):
            full_response += token
        return full_response
    else:
        if session_id not in session_fact_cache:
            facts = get_user_facts(user_id, n_results=8)
            session_fact_cache[session_id] = set(facts)
        else:
            facts = list(session_fact_cache[session_id])

        prompt_with_facts = build_prompt_with_facts(facts)

        chain = RunnableWithMessageHistory(
            prompt_with_facts | chat_llm,
            get_thread_memory,
            input_messages_key="input",
            history_messages_key="history",
        )

        result = chain.invoke(
            {"input": user_input},
            config={"configurable": {"session_id": session_id}}
        )
        assistant_text = result.content

        snippet = f"Farmer: {user_input}\nAssistant: {assistant_text}"
        new_fact = extract_fact_from_snippet(snippet)
        if new_fact:
            add_fact_for_user(user_id, new_fact)
            if session_id in session_fact_cache:
                session_fact_cache[session_id].add(new_fact)
            print(f"\n[Summary memory updated for {user_id}]: {new_fact}")

        return assistant_text