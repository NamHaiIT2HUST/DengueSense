"""Structure-preserving chunks for reviewed source units."""

import hashlib
import json
from collections.abc import Callable
from dataclasses import dataclass

from app.genai_rag.corpus import SourceUnit


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    unit_ids: list[str]
    text: str
    citations: list[dict]
    token_counts: dict[str, int]
    content_hash: str
    source_spans: dict[str, list[tuple[int, int]]]


def build_chunks(
    units: list[SourceUnit],
    target_tokens: int,
    token_counters: dict[str, Callable[[str], int]],
) -> list[Chunk]:
    if target_tokens not in (256, 512, 1024):
        raise ValueError("INVALID_TARGET_TOKENS")
    if set(token_counters) != {"bge", "gte"}:
        raise ValueError("TOKEN_COUNTERS_REQUIRED")
    chunks = []
    seen = set()
    for unit in units:
        if (
            unit.unit_id in seen
            or unit.review_status != "checked"
            or not unit.text.strip()
        ):
            raise ValueError(f"INVALID_UNIT: {unit.unit_id}")
        seen.add(unit.unit_id)
        counts = {name: count(unit.text) for name, count in token_counters.items()}
        if any(type(n) is not int or n < 0 for n in counts.values()):
            raise ValueError(f"INVALID_TOKEN_COUNT: {unit.unit_id}")
        if counts["bge"] > target_tokens or any(n > 1152 for n in counts.values()):
            # shortcut: oversized units need reviewed semantic splits before indexing.
            raise ValueError(f"UNIT_REQUIRES_REVIEW: {unit.unit_id}")
        citation = {
            "document_id": unit.document_id,
            "section_path": unit.section_path,
            "pdf_pages": unit.pdf_pages.copy(),
            "printed_pages": unit.printed_pages,
            "eligibility": unit.eligibility,
        }
        content_hash = hashlib.sha256(unit.text.encode("utf-8")).hexdigest()
        identity = {
            "version": 1,
            "target_tokens": target_tokens,
            "unit_id": unit.unit_id,
            "content_hash": content_hash,
            "citation": citation,
        }
        chunk_id = hashlib.sha256(
            json.dumps(
                identity, sort_keys=True, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest()
        chunks.append(
            Chunk(
                chunk_id=chunk_id,
                unit_ids=[unit.unit_id],
                text=unit.text,
                citations=[citation],
                token_counts=counts,
                content_hash=content_hash,
                source_spans={unit.unit_id: [(0, len(unit.text))]},
            )
        )
    return chunks
