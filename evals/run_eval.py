"""Runs the QualiRAG evaluation set through the agent and scores the results.

Run from the project root:
    uv run python evals/run_eval.py                      # all questions
    uv run python evals/run_eval.py --limit 5            # first 5, for a quick check
    uv run python evals/run_eval.py --category jargon    # one category
    uv run python evals/run_eval.py --ids S01 P03 U11    # specific questions

Every question makes real calls to Claude, the embeddings API, Pinecone and (when the
agent falls back to the web) Tavily, so a full run costs money and API credits.

Writes two files to evals/results/:
    run_<timestamp>.jsonl   one line per question with everything the agent returned
    report_<timestamp>.md   the scores, per category, and every failed check
"""
import argparse
import json
import statistics
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))  # lets "import app" work when this file is run directly

from app.rag.workflow import ask  # noqa: E402

EVALS = Path(__file__).resolve().parent
QUESTIONS = EVALS / "questions.json"
RESULTS = EVALS / "results"
SUPERSEDED = {"password_standard_v2.1.md", "remote_work_guidelines_2024.txt"}
DECLINE = "insufficient_evidence"


#running

def file_name(source: str) -> str:
    """Loaders store full paths (PDF, TXT, MD) or bare names (DOCX). Compare on the name only."""
    return Path(str(source).replace("\\", "/")).name


def run_one(question: dict) -> dict:
    started = time.perf_counter()
    try:
        state = ask(question["question"])
        error = None
    except Exception as exc:  # one failing question shouldn't stop the run
        state, error = {}, f"{type(exc).__name__}: {exc}"
    seconds = time.perf_counter() - started

    kb_docs = state.get("kb_docs", []) or []
    retrieved = [file_name(d.metadata.get("source", "")) for d in kb_docs]
    citations = state.get("citations", []) or []
    trace = [str(t) for t in state.get("trace", []) or []]
    return {
        "id": question["id"],
        "category": question["category"],
        "question": question["question"],
        "expected_route": question["expected_route"],
        "expected_sources": question["expected_sources"],
        "source_match": question["source_match"],
        "route": state.get("source_used"),
        "answer": state.get("answer", ""),
        "retrieved_sources": sorted(set(retrieved)),
        "cited_kb": sorted({file_name(c.get("title", "")) for c in citations if c.get("type") == "private_kb"}),
        "cited_web": [c.get("url", "") for c in citations if c.get("type") != "private_kb"],
        "rewrites": sum(1 for t in trace if t.strip().lower().startswith("query rewrite")),
        # the text the answer was generated from, for RAGAS (score_ragas.py)
        "kb_contexts": [d.page_content for d in kb_docs],
        "web_context": state.get("web_results", "") or "",
        "trace": trace,
        "seconds": round(seconds, 2),
        "error": error,
    }


#scoring

def score(r: dict) -> dict:
    """Adds pass/fail checks to one result. A check is None when it doesn't apply."""
    expected, match = set(r["expected_sources"]), r["source_match"]
    retrieved, cited = set(r["retrieved_sources"]), set(r["cited_kb"])
    is_kb = r["expected_route"] == "private_kb"

    def covers(found: set) -> bool:
        return expected <= found if match == "all" else bool(expected & found)

    checks = {
        "route_correct": r["error"] is None and r["route"] == r["expected_route"],
        # retrieval: only the last retrieval is kept in the state, so after a rewrite this is the second search
        "retrieval_hit": covers(retrieved) if is_kb and r["error"] is None else None,
        # citations: did the answer cite the right files, and only those?
        "cited_expected": covers(cited) if is_kb and r["route"] == "private_kb" else None,
        "citation_precision": (len(cited & expected) / len(cited)) if is_kb and cited else None,
        "cited_superseded": bool(cited & SUPERSEDED) if cited else None,
        "declined_correctly": (r["route"] == DECLINE) if r["expected_route"] == DECLINE else None,
        "declined_wrongly": (r["route"] == DECLINE) if r["expected_route"] in ("private_kb", "web_search") else None,
    }
    return {**r, "checks": checks}


def rate(values) -> str:
    values = [v for v in values if v is not None]
    if not values:
        return "n/a"
    return f"{100 * sum(values) / len(values):.0f}% ({sum(1 for v in values if v)}/{len(values)})" \
        if all(isinstance(v, bool) for v in values) else f"{100 * statistics.mean(values):.0f}%"


def build_report(results: list[dict], started: str) -> str:
    c = lambda key: [r["checks"][key] for r in results]
    secs = [r["seconds"] for r in results if r["error"] is None]
    lines = [
        f"# QualiRAG evaluation report", "",
        f"Run started {started}. {len(results)} questions. Synthetic Brightwick knowledge base.", "",
        "## Overall", "",
        "| Metric | Score | What it means |", "|---|---|---|",
        f"| Route accuracy | {rate(c('route_correct'))} | Took the expected path: knowledge base, web, direct reply or decline |",
        f"| Retrieval hit rate | {rate(c('retrieval_hit'))} | The right document was among the retrieved chunks (knowledge base questions) |",
        f"| Cited the right document | {rate(c('cited_expected'))} | Knowledge base answers that cited the expected file |",
        f"| Citation precision | {rate(c('citation_precision'))} | Share of cited files that were actually relevant |",
        f"| Cited a superseded policy | {rate(c('cited_superseded'))} | Answers citing an outdated document (lower is better) |",
        f"| Correct declines | {rate(c('declined_correctly'))} | Declined when the topic isn't covered |",
        f"| Wrong declines | {rate(c('declined_wrongly'))} | Declined a question it should have answered (lower is better) |",
        f"| Questions with a rewrite | {sum(1 for r in results if r['rewrites'])} | The agent rewrote the query at least once |",
        f"| Errors | {sum(1 for r in results if r['error'])} | The agent raised an exception |",
    ]
    if secs:
        lines.append(f"| Time per question | median {statistics.median(secs):.1f}s, max {max(secs):.1f}s | End-to-end, including every API call |")

    lines += ["", "## By category", "",
              "| Category | Questions | Route accuracy | Retrieval hit | Cited right document |", "|---|---|---|---|---|"]
    by_cat = defaultdict(list)
    for r in results:
        by_cat[r["category"]].append(r)
    for cat, rs in by_cat.items():
        g = lambda key: [r["checks"][key] for r in rs]
        lines.append(f"| {cat} | {len(rs)} | {rate(g('route_correct'))} | {rate(g('retrieval_hit'))} | {rate(g('cited_expected'))} |")

    confusion = Counter((r["expected_route"], r["route"] or "error") for r in results)
    routes = ["private_kb", "web_search", "direct", DECLINE]
    actual = routes + sorted({a for _, a in confusion if a not in routes})
    lines += ["", "## Expected route vs actual route", "",
              "| Expected \\ Actual | " + " | ".join(actual) + " |", "|---|" + "---|" * len(actual)]
    for e in routes:
        lines.append(f"| {e} | " + " | ".join(str(confusion.get((e, a), 0)) for a in actual) + " |")

    failures = [r for r in results if r["error"] or any(
        r["checks"][k] is False for k in ("route_correct", "retrieval_hit", "cited_expected", "declined_correctly"))
        or r["checks"]["cited_superseded"] or r["checks"]["declined_wrongly"]]
    lines += ["", f"## Failed checks ({len(failures)} questions)", ""]
    for r in failures:
        why = []
        if r["error"]:
            why.append(f"error: {r['error']}")
        if r["checks"]["route_correct"] is False and not r["error"]:
            why.append(f"route {r['route']}, expected {r['expected_route']}")
        if r["checks"]["retrieval_hit"] is False:
            why.append(f"retrieved {r['retrieved_sources'] or 'nothing'}, expected {r['expected_sources']}")
        if r["checks"]["cited_expected"] is False:
            why.append(f"cited {r['cited_kb'] or 'nothing'}")
        if r["checks"]["cited_superseded"]:
            why.append("cited a superseded policy")
        if r["checks"]["declined_wrongly"]:
            why.append("declined an answerable question")
        lines.append(f"- **{r['id']}** ({r['category']}) {r['question']}  \n  {'; '.join(why)}")
    return "\n".join(lines) + "\n"


#main

def main() -> None:
    parser = argparse.ArgumentParser(description="Run the QualiRAG evaluation set.")
    parser.add_argument("--ids", nargs="*", help="only these question IDs")
    parser.add_argument("--category", help="only this category")
    parser.add_argument("--limit", type=int, help="only the first N questions")
    args = parser.parse_args()

    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
    if args.ids:
        questions = [q for q in questions if q["id"] in set(args.ids)]
    if args.category:
        questions = [q for q in questions if q["category"] == args.category]
    if args.limit:
        questions = questions[: args.limit]
    if not questions:
        sys.exit("No questions match those filters.")

    RESULTS.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_path, report_path = RESULTS / f"run_{stamp}.jsonl", RESULTS / f"report_{stamp}.md"

    results = []
    with run_path.open("w", encoding="utf-8") as out:
        for i, q in enumerate(questions, 1):
            r = score(run_one(q))
            results.append(r)
            out.write(json.dumps(r, ensure_ascii=False) + "\n")
            out.flush()  # keep finished questions even if the run is interrupted
            mark = "ok " if r["checks"]["route_correct"] else "XX "
            print(f"[{i:>2}/{len(questions)}] {mark}{q['id']:<4} {r['route'] or 'error':<22} {r['seconds']:>5.1f}s  {q['question'][:60]}")

    report_path.write_text(build_report(results, stamp), encoding="utf-8")
    print(f"\nRoute accuracy: {rate([r['checks']['route_correct'] for r in results])}")
    print(f"Results: {run_path.relative_to(ROOT)}\nReport:  {report_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()