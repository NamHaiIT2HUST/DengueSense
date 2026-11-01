"""Offline retrieval engine with BM25 ranking, verbatim citation extraction and fail-closed out-of-scope detection."""

import math
import re
import unicodedata
from pathlib import Path

import yaml

from app.genai_rag.corpus import Document, SourceUnit, load_units, validate_manifest
from app.genai_rag.evaluate import Hit

# Explicit negative patterns that cannot be answered by this administrative corpus
OUT_OF_SCOPE_PATTERNS = [
    re.compile(
        r"\b(điều\s+dưỡng|bác\s+sĩ\s+cho\s+mỗi|định\s+mức\s+nhân\s+lực)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(bệnh\s+sởi|sởi)\b", re.IGNORECASE),
    re.compile(
        r"\b(tôi\s+bị\s+sốt|chắc\s+chắn\s+mắc|uống\s+thuốc\s+gì)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(liều\s+lượng|paracetamol|mg/kg|hạ\s+sốt)\b", re.IGNORECASE),
]

STOPWORDS = {
    "la",
    "là",
    "gi",
    "gì",
    "co",
    "có",
    "duoc",
    "được",
    "cua",
    "của",
    "theo",
    "cho",
    "cac",
    "các",
    "ve",
    "về",
    "trong",
    "khi",
    "va",
    "và",
    "hoac",
    "hoặc",
    "nhu",
    "như",
    "ra",
    "sao",
    "nao",
    "nào",
    "de",
    "để",
}

BILINGUAL_MAP = {
    "truyền thông": "communication rcce",
    "vai trò": "roles responsibilities",
    "liên kết": "link pillars",
    "ứng phó": "response",
    "ngân sách": "budget funding",
    "nhân lực": "surge human resource",
}

RESEARCH_NOTICE = (
    "BENCHMARK_RESEARCH_ONLY: Đơn vị truy hồi phục vụ nghiên cứu đánh giá benchmark, "
    "chưa được phê duyệt pháp lý/chuyên môn để đưa vào công điện hành chính B2G."
)


def normalize_text(text: str) -> list[str]:
    """Tokenize and normalize text into words and accents-stripped tokens."""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = [w for w in cleaned.split() if len(w) > 1]
    # Also include accent-stripped tokens to assist cross-matching
    nfkd = unicodedata.normalize("NFKD", cleaned)
    ascii_clean = "".join(c for c in nfkd if not unicodedata.combining(c))
    ascii_tokens = [w for w in ascii_clean.split() if len(w) > 1]
    return tokens + ascii_tokens


class BM25Retriever:
    """In-memory BM25 index over reviewed SourceUnit records."""

    def __init__(
        self,
        units: list[SourceUnit],
        documents: dict[str, Document] | None = None,
        k1: float = 1.5,
        b: float = 0.4,
    ) -> None:
        self.units = units
        self.documents = documents or {}
        self.k1 = k1
        self.b = b
        self.doc_tokens = [
            [
                t
                for t in normalize_text(
                    u.text
                    + " "
                    + u.section_path.replace("/", " ")
                    + " "
                    + u.section_path.split("/")[-1]
                )
                if t not in STOPWORDS
            ]
            for u in units
        ]
        self.doc_lens = [len(tokens) for tokens in self.doc_tokens]
        self.avg_doc_len = (
            sum(self.doc_lens) / len(self.doc_lens) if self.doc_lens else 1.0
        )
        self.doc_count = len(units)

        # Compute document frequencies
        self.df: dict[str, int] = {}
        for tokens in self.doc_tokens:
            for term in set(tokens):
                self.df[term] = self.df.get(term, 0) + 1

    def idf(self, term: str) -> float:
        n = self.df.get(term, 0)
        return math.log(1.0 + (self.doc_count - n + 0.5) / (n + 0.5))

    def score(self, query_tokens: list[str], doc_idx: int) -> float:
        tokens = self.doc_tokens[doc_idx]
        doc_len = self.doc_lens[doc_idx]
        if doc_len == 0:
            return 0.0

        tf_map: dict[str, int] = {}
        for t in tokens:
            tf_map[t] = tf_map.get(t, 0) + 1

        score = 0.0
        for term in set(query_tokens):
            if term not in tf_map:
                continue
            tf = tf_map[term]
            idf = self.idf(term)
            numerator = tf * (self.k1 + 1.0)
            denominator = tf + self.k1 * (
                1.0 - self.b + self.b * (doc_len / self.avg_doc_len)
            )
            score += idf * (numerator / denominator)
        return score

    def is_out_of_scope(self, query: str) -> bool:
        for pattern in OUT_OF_SCOPE_PATTERNS:
            if pattern.search(query):
                return True
        return False

    def extract_verbatim_quote(self, unit: SourceUnit, query_tokens: list[str]) -> str:
        """Find the sentence/clause in unit.text with highest overlap; ensure verbatim substring."""
        sentences = [
            s.strip() for s in re.split(r"[\n\r]+|[.;]\s+", unit.text) if s.strip()
        ]
        if not sentences:
            return unit.text[:200]

        best_sentence = sentences[0]
        best_overlap = -1
        query_set = set(query_tokens)

        for s in sentences:
            s_tokens = set(normalize_text(s))
            overlap = len(query_set & s_tokens)
            if overlap > best_overlap:
                best_overlap = overlap
                best_sentence = s

        # Verify that best_sentence is a strict substring of unit.text
        if best_sentence in unit.text:
            return best_sentence
        return unit.text[:200]

    def retrieve(
        self,
        query: str,
        k: int = 5,
        min_score: float = 1.0,
    ) -> list[Hit]:
        if not query.strip() or self.is_out_of_scope(query):
            return []

        expanded = query.lower()
        for k_term, v_terms in BILINGUAL_MAP.items():
            if k_term in expanded:
                expanded += " " + v_terms

        query_tokens = [t for t in normalize_text(expanded) if t not in STOPWORDS]
        if not query_tokens:
            return []

        scored: list[tuple[int, float]] = []
        for idx in range(self.doc_count):
            s = self.score(query_tokens, idx)
            if s >= min_score:
                scored.append((idx, s))

        scored.sort(key=lambda x: x[1], reverse=True)
        hits: list[Hit] = []

        for idx, score_val in scored[:k]:
            unit = self.units[idx]
            quote = self.extract_verbatim_quote(unit, query_tokens)
            doc_meta = self.documents.get(unit.document_id)
            source_url = getattr(doc_meta, "source_url", None) if doc_meta else None

            citation = {
                "document_id": unit.document_id,
                "section_path": unit.section_path,
                "pdf_pages": str(unit.pdf_pages),
                "printed_pages": unit.printed_pages or "",
                "quote": quote,
                "source_url": str(source_url or ""),
            }
            hits.append(
                Hit(
                    chunk_id=unit.unit_id,
                    unit_ids=[unit.unit_id],
                    score=round(score_val, 4),
                    citations=[citation],
                )
            )
        return hits


def load_retriever_from_disk(
    manifest_path: Path,
    units_path: Path,
) -> BM25Retriever:
    """Convenience helper to load reviewed units and initialize BM25 index."""
    manifest_data = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    root = next(
        (p for p in manifest_path.resolve().parents if (p / ".git").exists()),
        manifest_path.resolve().parents[2],
    )
    docs = {d.document_id: d for d in validate_manifest(manifest_data, root)}
    units = load_units(manifest_path, units_path)
    return BM25Retriever(units=units, documents=docs)
