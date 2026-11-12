"""Checks evals/questions.json against the knowledge base files.

Run from the project root:  uv run python evals/verify_questions.py
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

import docx2txt
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
KB_DIRS = [ROOT / "data" / "knowledge_base", ROOT / "data" / "upload_samples"]
QUESTIONS = Path(__file__).resolve().parent / "questions.json"
SUPERSEDED = {"password_standard_v2.1.md", "remote_work_guidelines_2024.txt"}


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def read(path: Path) -> str:
    if path.suffix == ".pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    if path.suffix == ".docx":
        return docx2txt.process(str(path))
    return path.read_text(encoding="utf-8")


texts = {p.name: normalise(read(p)) for d in KB_DIRS if d.exists() for p in d.iterdir() if p.is_file()}
questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
problems = []

ids = Counter(q["id"] for q in questions)
problems += [f"duplicate id {i}" for i, n in ids.items() if n > 1]

for q in questions:
    for source in q["expected_sources"]:
        if source not in texts:
            problems.append(f"{q['id']}: unknown source {source}")
        if source in SUPERSEDED:
            problems.append(f"{q['id']}: superseded document listed as a source")
    for ev in q["evidence"]:
        if ev["source"] not in texts:
            problems.append(f"{q['id']}: evidence file missing: {ev['source']}")
        elif normalise(ev["quote"]) not in texts[ev["source"]]:
            problems.append(f"{q['id']}: quote not found in {ev['source']}: {ev['quote'][:60]}...")
        if ev["source"] not in q["expected_sources"]:
            problems.append(f"{q['id']}: evidence file {ev['source']} not in expected_sources")
    if q["expected_route"] == "private_kb" and not q["evidence"]:
        problems.append(f"{q['id']}: knowledge base question has no evidence")

print(f"{len(questions)} questions, {sum(len(q['evidence']) for q in questions)} evidence quotes")
print("by category:", dict(Counter(q["category"] for q in questions)))
print("by route:   ", dict(Counter(q["expected_route"] for q in questions)))
print("verified:   ", sum(q["human_verified"] for q in questions), "of", len(questions))
if problems:
    print("\nProblems:")
    for p in problems:
        print(" -", p)
    sys.exit(1)
print("\nAll checks passed.")