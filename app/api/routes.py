from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from pydantic import BaseModel, Field
from app.services.audit import write_audit
from app.rag.vector_store import add_documents
from app.core.config import get_settings
from app.services.data_ingestion import load_file, chunk_documents
from app.rag.workflow import ask

SUPPORTED = {".pdf", ".txt", ".md", ".docx"}

router = APIRouter(prefix="/api")
settings = get_settings()

class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=3000)

#endpoints


@router.get("/health")
def health():
    return {"status":"ok", "service": settings.app_name}


#input from the user 
import logging
logger = logging.getLogger(__name__)

@router.post("/chat")
def chat(payload: ChatRequest):
    try:
        result = ask(payload.question)
        write_audit(payload.question, result["source_used"], result.get("trace", []))
        return {
            "answer": result["answer"],
            "source_used": result["source_used"],
            "trace": result.get("trace", []),
            "citations": result.get("citations", []),
            "rewritten_query": result.get("current_query", payload.question),
        }
    except Exception as exc:
        logger.exception("chat failed")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.") from exc


@router.post("/ingest")
def ingest(file: UploadFile = File(...), x_admin_key: str = Header(default="")):
    if not settings.admin_api_key or x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid admin key")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED:
        raise HTTPException(status_code=400, detail=f"Invalid file type {suffix}")
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    destination = upload_dir / Path(file.filename).name
    destination.write_bytes(file.file.read())
    docs = load_file(destination)
    chunks = chunk_documents(docs)
    ids = add_documents(chunks)
    return {"message": "Document indexed", "file": destination.name, "chunks": len(chunks), "ids_created": len(ids)}





    








        




 
    


    








    


