# Evaluation set

`questions.json` holds 79 labelled questions: 63 on the 35 documents in `data/knowledge_base/`, and 16 on the 5 documents added through the upload feature, whose copies live in `data/upload_samples/`. Each one says which path the agent should take, which documents hold the answer, and what a correct answer contains.

## What each field means

| Field | Meaning |
|---|---|
| `id` | Short ID. The letter shows the group: S single document, P superseded, A audience, M multi-document, J jargon, W web, D small talk, X missing topic, U uploaded documents. |
| `category` | What the question tests (see below) |
| `expected_route` | The `source_used` the agent should return: `private_kb`, `web_search`, `direct` or `insufficient_evidence` |
| `expected_sources` | Knowledge base files that contain the answer |
| `source_match` | `any`: one of the files is enough. `all`: the answer needs every file. `none`: no knowledge base file applies. |
| `reference_answer` | A correct answer, written from the documents |
| `key_facts` | The facts a correct answer must include, for grading |
| `evidence` | Exact quotes from the source files that support the answer |
| `trap` | What could lead the agent astray, if anything |
| `human_verified` | Set to `true` once you've checked the question yourself |

## Categories

| Category | Count | Tests whether the agent... |
|---|---|---|
| `single_doc` | 37 | answers from one document |
| `superseded_trap` | 7 | uses the current policy, not the superseded one |
| `audience_trap` | 9 | picks the document for the right group (employees, store staff, contractors, HQ vs stores) |
| `multi_doc` | 6 | combines facts from two documents |
| `jargon` | 5 | copes with abbreviations and slang, which may need a query rewrite |
| `web_general` | 5 | falls back to the web for general tech questions |
| `small_talk` | 3 | replies directly without retrieval |
| `absent_topic` | 7 | declines when the documents don't cover the topic |

## Checking the set

```bash
uv run python evals/verify_questions.py
```

This reads `data/knowledge_base/` and `data/upload_samples/`, and confirms every evidence quote appears word for word in its source file, that no question relies on a superseded document, and that the IDs are unique. Run it after editing any question.

## Notes

- The knowledge base is synthetic, so scores measure the method, not performance on real company data.
- The answers for `web_general` questions are written from general knowledge, not from the documents, so grade those on the key facts only.
- The `U` questions only pass if their documents have been uploaded to Pinecone. Keep copies of those files in `data/upload_samples/` so the checker can read them.
- None of the `absent_topic` questions overlap with the uploaded documents. Check them again if you upload more files.