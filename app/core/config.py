from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

#getting base directory 
BASE_DIR = Path(__file__).resolve().parents[2]

#configuration settings class
class Settings(BaseSettings):
    #configuration variables
    app_name: str = "QauliRAG"
    app_env: str = "development"
    #secrets
    anthropic_api_key: str = ""
    #for embedding models
    openai_api_key: str = ""
    tavily_api_key: str = ""
    pinecone_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    pinecone_index_name: str = "qaulirag"  
    anthropic_model: str = "claude-haiku-4-5-20251001"
    pinecone_namespace: str = "knowledge_base"
    top_k: int = 4
    max_retries: int = 1
    admin_api_key: str = "change-me"
    #for storing conversations
    audit_db_path: str = str(BASE_DIR/"data"/"audit.db")
    #stored documents
    upload_dir: str = str(BASE_DIR/"uploads")
    #knowledge base local
    kb_dir: str = str(BASE_DIR/"data"/"knowledge_base")

    model_config = SettingsConfigDict(env_file=str(BASE_DIR/ ".env"), extra="ignore")


#skips the function and hands back the same saved object for fastapi no re-reading or reparsing
@lru_cache
def get_settings() -> Settings:
    return Settings()


    
