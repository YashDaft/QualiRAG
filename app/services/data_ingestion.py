from pathlib import Path
from typing import Iterable
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
import docx2txt


#function to load the types of supported files
def load_file(path: Path) -> list[Document]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        docs = PyPDFLoader(str(path)).load()
    elif suffix in {".txt", ".md"}:
        docs = TextLoader(str(path), encoding="utf-8").load()
    elif suffix == ".docx":
        text = docx2txt.process(path)
        docs = [Document(page_content=text, metadata={"source": path.name})]
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    #outdated documents have a line "Status: SUPERSEDED" near the top
    #a PDF is loaded as one Document per page, so join all pages to check the whole file
    full_text = ""
    for doc in docs:
        full_text += doc.page_content

    if "Status: SUPERSEDED" in full_text:
        status = "SUPERSEDED, do not follow"
    else:
        status = "current"

    #save the status on every page of this file
    for doc in docs:
        doc.metadata["status"] = status

    return docs


def chunk_documents(docs: Iterable[Document]) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=120, add_start_index=True)
    #each chunk keeps its file's metadata, including "status", which Pinecone stores next to the vector
    return splitter.split_documents(docs)