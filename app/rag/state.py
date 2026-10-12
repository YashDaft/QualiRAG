from typing import Literal
from typing_extensions import TypedDict
from pydantic import BaseModel, Field
from langchain_core.documents import Document

#BaseModel: where you need validated data from the LLM
class RouteDecision(BaseModel):
    #Literal: the value must be exactly one of these
    route: Literal["kb", "direct"] = Field(
        description=(
            "kb if the question is about IT support, company policy, devices, "
            "accounts, access or procedures and needs a knowledge base lookup. "
            "direct only for greetings, thanks or small talk that needs no lookup."
        )
    )


class EvidenceGrade(BaseModel):
    grade: Literal["good", "weak"] = Field(
        description=(
            "good if the retrieved passages contain the specific facts needed to "
            "answer the question fully. weak if they are off topic, incomplete "
            "or only loosely related to the question."
        )
    )



class AgentState(TypedDict):
    question: str
    current_query: str
    kb_docs: list[Document]
    web_results: str
    kb_grade: str
    web_grade: str
    answer: str
    source_used: str
    retry_count: int
    trace: list[str]
    citations: list[dict]



    
