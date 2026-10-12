import time
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

from collections import Counter
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()

_embeddings = None
_vectorstore =  None

#different embedding models to use, to not rely on only one model
EMBEDDING_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
    "all-minilm-l6-v2": 384
}

#return expected dimension from the model being used
def get_embedding_dimension(model_name: str | None=None) -> int:
    name = (model_name or settings.embedding_model or "").strip()
    if not name:
        raise RuntimeError("Embedding model is not set yet.")

    normalized = name.lower()

    if normalized in EMBEDDING_DIMENSIONS:
        return EMBEDDING_DIMENSIONS[normalized]
    if 'text-embedding-3-small' in normalized:
        return 1536
    if 'text-embedding-3-large' in normalized:
        return 3072
    if 'text-embedding-ada-002' in normalized:
        return 1536
    if 'all-minilm' in normalized:
        return 384
    
    raise ValueError(f'Unsupported embedding model: {name}'
    'Add the matching dimension to EMBEDDING_DIMENSIONS')


#generating embeddings
def get_embeddings():
    global _embeddings
    if _embeddings is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY not set.")
        _embeddings = OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openai_api_key
        )
    return _embeddings


#ensure the index is created with the correct dimensions and metrics
def ensure_index():
    if not settings.pinecone_api_key:
        raise RuntimeError("PINECONE_API_KEY not set or missing.")

    name = settings.pinecone_index_name
    desired_dimension = get_embedding_dimension()

    pc = Pinecone(api_key=settings.pinecone_api_key)
    names = [x["name"] for x in pc.list_indexes()]
    
    # check the existing index matches the embedding model
    if name in names:
        current_dimension = pc.describe_index(name).dimension
        if current_dimension != desired_dimension:
            raise RuntimeError(
                f"Index {name} has dimension {current_dimension} "
                f"but the embedding model needs {desired_dimension}. "
                "Use a different index name or delete it in the Pinecone console."
            )
    #create index if it doesn't exist
    else:
        pc.create_index(
            name=name,
            dimension=desired_dimension,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(name).status["ready"]:
            time.sleep(1)

    return pc.Index(name)

#
def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        index = ensure_index()
        #converting chunks to vectors and storing to pincone vector store
        _vectorstore = PineconeVectorStore(
            index=index,
            embedding=get_embeddings(),
            namespace=settings.pinecone_namespace
        )
    return _vectorstore

def get_retriever():
    return get_vectorstore().as_retriever(search_kwargs={'k':settings.top_k})


def add_documents(chunks):
    store = get_vectorstore()
    #method of pinecone object
    
    #fixed id per chunk: file name + its position within that file
    counts = Counter()
    ids = []
    for chunk in chunks:
        source = Path(chunk.metadata["source"])

        ids.append(f"{source}-{counts[source]}")
        counts[source] += 1


    return store.add_documents(chunks, ids=ids)












    
    





            
        
       
    




        


    
    




