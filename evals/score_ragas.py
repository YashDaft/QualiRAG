"""Scores a saved evaluation run with RAGAS, using a GPT model through your OpenAI-compatible gateway as the judge.

It reads a results file written by run_eval.py, so it never calls your agent again.
RAGAS needs older LangChain packages than the app, so run it in its own environment
(uv creates it on the fly and leaves your project untouched). It uses Python 3.13 because
one RAGAS dependency, scikit-network, has no ready-made Windows package for 3.14 yet:

    uv run --no-project --python 3.13 --with ragas==0.4.3 --with langchain-community==0.3.31 --with langchain-openai python evals/score_ragas.py

Options:
    --run evals/results/run_XXXX.jsonl   score a specific run (default: the newest one)
    --limit 5                            score only the first N answers, for a quick check

Settings, read from your environment or the project's .env file:
    OPENAI_API_KEY    your gateway key (the same one the app uses for embeddings)
    OPENAI_BASE_URL   gateway URL (default https://api.airouter.in/v1)
    JUDGE_MODEL       the judge model's exact name on the gateway (required)
    EMBEDDING_MODEL   embeddings for answer relevancy (default openai/text-embedding-3-small)

Metrics, for answers that came from the knowledge base or the web:
    faithfulness         share of the answer's claims supported by the retrieved text (hallucination check)
    answer_relevancy     how directly the answer addresses the question
For knowledge base questions answered from the knowledge base, also:
    context_recall       share of the reference answer that the retrieved text supports
    factual_correctness  how closely the answer's facts match the reference answer
"""
import argparse
import json
import math
import os
import statistics
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVALS = Path(__file__).resolve().parent
RESULTS = EVALS / "results"


def load_env_file() -> None:
    """Reads KEY=value lines from the project's .env without overriding real environment variables."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def build_samples(run_path: Path, limit: int | None):
    questions = {q["id"]: q for q in json.loads((EVALS / "questions.json").read_text(encoding="utf-8"))["questions"]}
    answered, kb_answered = [], []
    for line in run_path.read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        if r.get("error") or r["route"] not in ("private_kb", "web_search"):
            continue  # direct replies and declines have no retrieved text to judge
        contexts = r.get("kb_contexts") if r["route"] == "private_kb" else ([r["web_context"]] if r.get("web_context") else [])
        if not contexts:
            continue
        sample = {"id": r["id"], "category": r["category"], "user_input": r["question"],
                  "response": r["answer"], "retrieved_contexts": contexts,
                  "reference": questions[r["id"]]["reference_answer"]}
        answered.append(sample)
        if r["route"] == "private_kb" and r["expected_route"] == "private_kb":
            kb_answered.append(sample)
    if limit:
        answered = answered[:limit]
        keep = {s["id"] for s in answered}
        kb_answered = [s for s in kb_answered if s["id"] in keep]
    return answered, kb_answered


def main() -> None:
    parser = argparse.ArgumentParser(description="Score a saved run with RAGAS.")
    parser.add_argument("--run", type=Path, help="results file from run_eval.py (default: newest)")
    parser.add_argument("--limit", type=int, help="only the first N answers")
    args = parser.parse_args()

    load_env_file()
    judge = os.environ.get("JUDGE_MODEL")
    if not judge:
        sys.exit("Set JUDGE_MODEL to the judge model's exact name on your gateway, e.g. in .env.")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.airouter.in/v1")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("OPENAI_API_KEY is not set.")

    runs = sorted(RESULTS.glob("run_*.jsonl"))
    run_path = args.run or (runs[-1] if runs else None)
    if not run_path or not run_path.exists():
        sys.exit("No results file found. Run evals/run_eval.py first.")

    answered, kb_answered = build_samples(run_path, args.limit)
    if not answered:
        sys.exit("No answers with retrieved text in that run. Was it made with the updated run_eval.py?")

    # Imported here so a missing package gives the clear message above first
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas import EvaluationDataset, evaluate
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import FactualCorrectness, Faithfulness, LLMContextRecall, ResponseRelevancy
    from ragas.run_config import RunConfig

    llm = LangchainLLMWrapper(ChatOpenAI(model=judge, api_key=api_key, base_url=base_url))
    embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings(
        model=os.environ.get("EMBEDDING_MODEL", "openai/text-embedding-3-small"),
        api_key=api_key, base_url=base_url, check_embedding_ctx_length=False))
    config = RunConfig(max_workers=4, timeout=180)

    def run_metrics(samples, metrics):
        data = EvaluationDataset.from_list([{k: s[k] for k in ("user_input", "response", "retrieved_contexts", "reference")} for s in samples])
        return evaluate(dataset=data, metrics=metrics, llm=llm, embeddings=embeddings, run_config=config).to_pandas()

    print(f"Judge: {judge}. Scoring {len(answered)} answers from {run_path.name}...")
    general = run_metrics(answered, [Faithfulness(), ResponseRelevancy()])
    kb = run_metrics(kb_answered, [LLMContextRecall(), FactualCorrectness()]) if kb_answered else None

    rows = []
    for i, s in enumerate(answered):
        row = {"id": s["id"], "category": s["category"],
               "faithfulness": general.iloc[i].get("faithfulness"),
               "answer_relevancy": general.iloc[i].get("answer_relevancy")}
        rows.append(row)
    if kb is not None:
        kb_cols = [c for c in kb.columns if c in ("context_recall",) or c.startswith("factual_correctness")]
        by_id = {s["id"]: kb.iloc[i] for i, s in enumerate(kb_answered)}
        for row in rows:
            if row["id"] in by_id:
                row["context_recall"] = by_id[row["id"]].get("context_recall")
                row["factual_correctness"] = by_id[row["id"]].get(kb_cols[-1]) if kb_cols else None

    metrics = ["faithfulness", "answer_relevancy", "context_recall", "factual_correctness"]

    def mean(values):
        values = [v for v in values if isinstance(v, (int, float)) and not math.isnan(v)]
        return (statistics.mean(values), len(values)) if values else (None, 0)

    def fmt(m):
        value, n = m
        return "n/a" if value is None else f"{value:.2f} (n={n})"

    stamp = run_path.stem.replace("run_", "")
    out_jsonl = RESULTS / f"ragas_{stamp}.jsonl"
    out_md = RESULTS / f"ragas_{stamp}.md"
    clean = lambda v: None if isinstance(v, float) and math.isnan(v) else (float(v) if isinstance(v, (int, float)) else v)
    with out_jsonl.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps({k: clean(v) for k, v in row.items()}) + "\n")

    lines = [f"# RAGAS scores for {run_path.name}", "",
             f"Judge model: {judge}. Scores run from 0 to 1, higher is better. "
             "n is how many answers each score is based on; failed judge calls are left out.", "",
             "| Metric | Score |", "|---|---|"]
    lines += [f"| {m.replace('_', ' ').capitalize()} | {fmt(mean(r.get(m) for r in rows))} |" for m in metrics]
    lines += ["", "## By category", "", "| Category | " + " | ".join(m.replace("_", " ") for m in metrics) + " |",
              "|---|" + "---|" * len(metrics)]
    cats = defaultdict(list)
    for r in rows:
        cats[r["category"]].append(r)
    for cat, rs in cats.items():
        lines.append(f"| {cat} | " + " | ".join(fmt(mean(r.get(m) for r in rs)) for m in metrics) + " |")
    low = sorted((r for r in rows if isinstance(r.get("faithfulness"), float) and r["faithfulness"] < 0.7),
                 key=lambda r: r["faithfulness"])
    lines += ["", f"## Answers with faithfulness below 0.7 ({len(low)})", ""]
    lines += [f"- **{r['id']}** ({r['category']}): {r['faithfulness']:.2f}" for r in low] or ["None."]
    out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("\n".join(lines[6:6 + len(metrics)]))
    print(f"\nScores: {out_jsonl.relative_to(ROOT)}\nReport: {out_md.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

