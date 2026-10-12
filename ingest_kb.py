from pathlib import Path
from app.core.config import get_settings
from app.services.data_ingestion import load_file, chunk_documents
from app.rag.vector_store import add_documents

settings = get_settings()

kb_dir = Path(settings.kb_dir)

#get all files in the directory
SUPPORTED = {".pdf", ".docx", ".txt", ".md"}
files = sorted(f for f in kb_dir.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED)


all_docs = []
for file in files:
    all_docs.extend(load_file(file))


chunks = chunk_documents(all_docs)
ids = add_documents(chunks)

print(f"Indexed {len(files)} files -> {len(chunks)} chunks -> {len(ids)} pinecone vectors")


























    