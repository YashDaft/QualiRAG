# QualiRAG

An IT support copilot that answers from a company knowledge base first, checks whether the evidence actually answers the question, and only then falls back to the web. When neither source is good enough, it says so and points to the service desk instead of guessing.

Built as a corrective RAG agent with LangGraph, Claude, Pinecone and FastAPI, on a synthetic knowledge base for a fictional retailer, Brightwick Retail Group.

![Python](https://img.shields.io/badge/python-3.14-blue)
![LangGraph](https://img.shields.io/badge/agent-LangGraph-1c3c3c)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688)
![Deployed on Vercel](https://img.shields.io/badge/deployed-Vercel-000000)

**Live demo:** [quali-rag.vercel.app](https://quali-rag.vercel.app)

Try "How do I set up MFA on my new phone?" for a knowledge base answer, "How do I clear the Microsoft Teams cache on Windows 11?" for a web answer, and "What is the parental leave policy?" to see it decline. The panel on the right shows which path the agent took and why.

---

## The problem with plain RAG

A basic RAG pipeline retrieves the top few chunks and asks the model to answer from them, whatever they contain. That breaks in ways that matter for IT support:

- The closest chunks aren't always relevant, and the model answers anyway.
- Companies keep old policies around. A superseded password standard can still be the closest match.
- The same question has different answers for different people. Remote access works one way for employees, another for store staff and another for contractors.
- Some questions simply aren't covered, and a confident made-up answer is worse than "I don't know".

QualiRAG handles these by grading the evidence before it writes anything.

## How a question is answered

![QualiRAG architecture](docs/architecture.png)

1. **Route.** Claude decides whether the message is an IT question or small talk. Small talk gets a direct reply with no retrieval.
2. **Retrieve.** The question is embedded and the 6 closest chunks are pulled from Pinecone. Each chunk comes back with its document's status: current or superseded.
3. **Grade the knowledge base evidence.** Claude ignores passages from superseded documents and marks the evidence `good` only if the current passages contain the specific facts needed, or say where to find them. It marks it `weak` if they're off-topic, only partly answer the question, or are meant for a different audience.
4. **Fall back to the web.** If the knowledge base is weak, Tavily searches the web and the results are graded the same way. Web results can't answer questions about Brightwick's own policies, so those grade `weak`.
5. **Rewrite and retry.** If both are weak, Claude rewrites the query with different keywords and expanded abbreviations, and the agent searches the knowledge base again. This happens once by default (`MAX_RETRIES=1`).
6. **Answer or stop.** A good grade leads to an answer with sources. Knowledge base answers cite only the files they actually used, never a superseded policy; web answers link the pages they drew on. If nothing grades good after the retry, the agent returns the service desk contact details instead of an answer.

Every step is recorded in a trace that comes back with the answer, so you can see why the agent did what it did.

## Features

- Evidence grading before every answer, with the option to decline
- Handles superseded policies and audience-specific documents in the knowledge base
- Web fallback with a separate grade, for general tech questions the knowledge base doesn't cover
- One automatic query rewrite and retry
- Citations to only the files the answer used, with outdated policies never cited
- Document upload from the UI (PDF, DOCX, TXT, Markdown), protected by an admin key
- A live view of the agent's path, its trace and its sources for each answer
- An audit log of every question, its answer source and its trace (SQLite)
- A 79-question evaluation harness with RAGAS scoring (see [Evaluation](#evaluation))

## Tech stack

| Layer | Choice |
|---|---|
| Agent orchestration | LangGraph |
| LLM | Claude Haiku 4.5 (Anthropic) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dimensions), through an OpenAI-compatible gateway |
| Vector store | Pinecone serverless, cosine similarity |
| Web search | Tavily |
| API | FastAPI, Uvicorn |
| Frontend | Jinja template, plain HTML, CSS and JavaScript |
| Audit log | SQLite |
| Packaging | uv, Docker |
| Hosting | Vercel |

## The knowledge base

`data/knowledge_base/` holds 35 synthetic documents for Brightwick Retail Group: KB articles, policies, runbooks and SOPs, in Markdown, text, Word and PDF. The set is built to be hard on purpose:

- Two policies are marked superseded and contradict the current ones.
- Remote access works differently for employees, store staff and contractors, and headquarters printing is separate from store receipt printers, so similar questions need different documents.
- Some topics, like payroll or annual leave, are deliberately missing, to test whether the agent declines.

Every company, person and policy in it is fictional. `data/MANIFEST.md` lists each file and the traps built into the set.

## Project structure

```text
.
├── app/
│   ├── main.py                 # FastAPI app, static files, page route
│   ├── api/routes.py           # /api/health, /api/chat, /api/ingest
│   ├── core/
│   │   ├── config.py           # Settings, read from environment variables or .env
│   │   └── logging.py
│   ├── rag/
│   │   ├── workflow.py         # LangGraph nodes, routing and graph
│   │   ├── state.py            # Agent state and structured-output schemas
│   │   └── vector_store.py     # Embeddings, Pinecone index and retriever
│   └── services/
│       ├── data_ingestion.py   # File loaders and chunking
│       └── audit.py            # SQLite audit log
├── static/                     # app.js, style.css
├── templates/index.html
├── data/
│   ├── knowledge_base/         # The 35 synthetic documents
│   ├── upload_samples/         # The 5 documents used to test uploading
│   └── MANIFEST.md
├── evals/                      # Question set, harness, RAGAS scoring and results
├── docs/architecture.png
├── ingest_kb.py                # Indexes the whole knowledge base folder
├── Dockerfile
├── pyproject.toml
└── uv.lock
```

## Running it locally

You need Python 3.14, [uv](https://docs.astral.sh/uv/), and API keys for Anthropic, Pinecone, Tavily and an OpenAI-compatible embeddings endpoint.

**1. Install dependencies**

```bash
uv sync
```

**2. Create a `.env` file in the project root**

```env
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
PINECONE_API_KEY=...
TAVILY_API_KEY=...
ADMIN_API_KEY=choose-a-long-random-string
```

Optional settings and their defaults are in `app/core/config.py`. The ones you're most likely to change:

| Variable | What it does |
|---|---|
| `OPENAI_BASE_URL` | Embeddings endpoint. Set it to `https://api.openai.com/v1` to use OpenAI directly. |
| `EMBEDDING_MODEL` | Embedding model name. With OpenAI directly, use `text-embedding-3-small`. |
| `ANTHROPIC_MODEL` | Claude model. Defaults to Haiku 4.5. |
| `PINECONE_INDEX_NAME` | Index to use. It's created on first run if it doesn't exist. |
| `TOP_K` | Chunks retrieved per search (default 6) |
| `MAX_RETRIES` | Query rewrites before giving up (default 1) |

**3. Index the knowledge base (once)**

```bash
uv run python ingest_kb.py
```

This loads every file in `data/knowledge_base/`, splits it into 900-character chunks with 120 characters of overlap, embeds them and stores them in Pinecone. Files containing a `Status: SUPERSEDED` line are marked as superseded in each chunk's metadata, so the agent can ignore them. Chunk IDs are the file name plus the chunk's position, so running it again overwrites the vectors instead of duplicating them.

**4. Start the app**

```bash
uv run uvicorn app.main:app --reload
```

Open http://localhost:8000.

## Running with Docker

```bash
docker build -t qualirag .
docker run --rm -p 8000:8000 --env-file .env \
  -v qualirag_data:/app/data -v qualirag_uploads:/app/uploads qualirag
```

The image installs the exact versions from `uv.lock` and runs as a non-root user. The two volumes keep the audit log and uploaded files across restarts. Write your `.env` values without quotes, because Docker passes quotes through as part of the value.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Returns `{"status": "ok", "service": ...}` |
| `POST` | `/api/chat` | Runs the agent on a question |
| `POST` | `/api/ingest` | Adds one document to the knowledge base. Needs the `X-Admin-Key` header. |

Ask a question:

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I set up MFA on my new phone?"}'
```

The response contains `answer`, `source_used` (`private_kb`, `web_search`, `direct` or `insufficient_evidence`), `trace`, `citations` and `rewritten_query`.

Upload a document:

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "X-Admin-Key: your-admin-key" \
  -F "file=@voicemail_pin_reset.md"
```

The response contains `file`, `chunks` and `ids_created`.

## Deployment

The live demo runs on Vercel, which detects the FastAPI app in `app/main.py` and installs from `uv.lock`. Two things differ from running it locally:

- **Writable folders.** Vercel functions can only write to `/tmp`, so the deployment sets `AUDIT_DB_PATH=/tmp/audit.db` and `UPLOAD_DIR=/tmp/uploads`. Both reset when the function restarts. Uploaded documents stay searchable, because they live in Pinecone.
- **Upload batching.** Vectors are upserted to Pinecone without a thread pool (`async_req=False`), because Vercel's runtime doesn't provide the shared memory Python's thread pool needs.

## Evaluation

The agent is measured on 79 labelled questions covering all 40 documents (`evals/`). Each question has an expected route, the source files and a reference answer, and every reference answer is backed by exact quotes from the documents. The harness (`evals/run_eval.py`) scores the agent's decisions, and RAGAS (`evals/score_ragas.py`, GPT-4.1 as judge) scores the answer text.

| Metric | Baseline | Final |
|---|---|---|
| Route accuracy | 91% | 94% |
| Superseded-policy questions routed correctly | 4 of 7 | 6 of 7 |
| Citation precision | 49% | 98% |
| Answers citing a superseded policy | 6 | 0 |
| Wrongly declined questions | 5 | 2 |
| Retrieval hit rate | 98% | 97% |
| Faithfulness (RAGAS) | 0.92 | 0.91 |
| Context recall (RAGAS) | 0.94 | 0.96 |

**What changed between the two runs**

1. **Document status in metadata.** Each chunk now carries its file's status (current or superseded) as metadata, and the grader and answer prompts show it next to every passage. The grader ignores superseded passages instead of treating them as a reason to decline.
2. **Citations from the passages actually used.** The answer step returns the numbers of the passages it relied on, and only those files are cited.
3. **Six chunks per search instead of four**, so two-part questions are more likely to find both documents.

A first attempt put the status label inside the chunk text. It fixed some grading errors but lowered retrieval from 98% to 95%, because the label changed every chunk's embedding. Moving the status to metadata kept the gains and restored retrieval.

**Reading the numbers.** Two baseline runs differed by one or two questions, because the model can't be made fully deterministic, so changes of that size are noise. The citation and superseded-policy improvements are well beyond it. The knowledge base is synthetic, so these scores measure the method, not performance on real company data.

## Known limitations

- Two-part questions can still miss the second document, mostly response times stored in a PDF table.
- General how-to questions, like taking a screenshot, are sometimes answered directly instead of being searched on the web.
- Each question is answered on its own. There's no conversation memory.
- The agent's steps appear after the answer finishes, not live.
- On Vercel, the audit log resets with the function, and uploads are capped at 4.5 MB per file, one file at a time.

## What's next

- Query decomposition, so two-part questions search for each part separately
- A router fix so general how-to questions always go to search
- Conversation memory for follow-up questions

## License

See [LICENSE](LICENSE).