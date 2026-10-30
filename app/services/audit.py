import json
import sqlite3
from datetime import datetime, timezone
from app.core.config import get_settings
settings = get_settings()

def init_db() -> None:
    connection = sqlite3.connect(settings.audit_db_path)
    # db schema
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS query_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        question TEXT NOT NULL,
        source_used TEXT NOT NULL,
        trace_json TEXT NOT NULL
        )
        """
    )
    connection.commit()
    connection.close()

#insert question, source_used, trace in the db from workflow
def write_audit(question: str, source_used: str, trace: list[str]) -> None:
    connection = sqlite3.connect(settings.audit_db_path)
    connection.execute(
        """
        INSERT INTO query_audit(created_at, question, source_used, trace_json)
        VALUES (?, ?, ?, ?)
        """,
        #dumps for converting to a JSON string
        (datetime.now(timezone.utc).isoformat(), question, source_used, json.dumps(trace))
    )
    connection.commit()
    connection.close()

