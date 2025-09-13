import sqlite3

DB_PATH = "./farmer_chat_history.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS farmer_chat_history (
            user_id TEXT,
            session_id TEXT,
            role TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS farmer_summaries (
            user_id TEXT PRIMARY KEY,
            summary TEXT
        )
    """)

    conn.commit()
    conn.close()


def save_message(user_id: str, session_id: str, role: str, message: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farmer_chat_history (user_id, session_id, role, message)
        VALUES (?, ?, ?, ?)
    """, (user_id, session_id, role, message))
    conn.commit()
    conn.close()

def load_chat_history(user_id: str, session_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT role, message FROM farmer_chat_history
        WHERE user_id=? AND session_id=?
        ORDER BY timestamp
    """, (user_id, session_id))
    rows = cursor.fetchall()
    conn.close()
    return rows


def save_user_summary(user_id: str, summary: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farmer_summaries (user_id, summary)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET summary=excluded.summary
    """, (user_id, summary))
    conn.commit()
    conn.close()

def get_user_summary(user_id: str) -> str:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT summary FROM farmer_summaries WHERE user_id=?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else ""
