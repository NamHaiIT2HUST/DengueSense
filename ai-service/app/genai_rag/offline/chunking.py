"""Structure-preserving chunks for reviewed source units."""

import hashlib
import json
import re
from collections.abc import Callable
from dataclasses import dataclass

from app.genai_rag.offline.corpus import SourceUnit

# Both pinned tokenizers add two special tokens to a single text.
MAX_CONTENT_TOKENS = 1150


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
    """Count content tokens with the pinned BGE and GTE tokenizers, without specials."""
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
        ranges = [[(0, len(unit.text))]]
        if counts["bge"] > target_tokens or any(
            n > MAX_CONTENT_TOKENS for n in counts.values()
        ):
            # shortcut: only the reviewed HCDC numbered structure can be split.
            if unit.unit_id != "hcdc-sxh-snapshot-2025/muc-7":
                raise ValueError(f"UNIT_REQUIRES_REVIEW: {unit.unit_id}")
            matches = list(re.finditer(r"(?m)^0[1-7]\. ", unit.text))
            if [m.group()[:2] for m in matches] != [f"{i:02}" for i in range(1, 8)]:
                raise ValueError(f"UNIT_REQUIRES_REVIEW: {unit.unit_id}")
            prefix_end = matches[0].start()
            heading_end = unit.text.find("\n") + 1
            if heading_end <= 0 or heading_end >= prefix_end:
                raise ValueError(f"UNIT_REQUIRES_REVIEW: {unit.unit_id}")
            intro_counts = {
                name: count(unit.text[:prefix_end])
                for name, count in token_counters.items()
            }
            if any(type(n) is not int or n < 0 for n in intro_counts.values()):
                raise ValueError(f"INVALID_TOKEN_COUNT: {unit.unit_id}")
            if intro_counts["bge"] > target_tokens or any(
                n > MAX_CONTENT_TOKENS for n in intro_counts.values()
            ):
                raise ValueError(f"UNIT_REQUIRES_REVIEW: {unit.unit_id}")
            ranges = [[(0, prefix_end)]]
            start = prefix_end
            ends = [m.start() for m in matches[1:]] + [len(unit.text)]
            for end in ends:
                candidate = unit.text[:heading_end] + unit.text[start:end]
                candidate_counts = {
                    name: count(candidate) for name, count in token_counters.items()
                }
                if any(type(n) is not int or n < 0 for n in candidate_counts.values()):
                    raise ValueError(f"INVALID_TOKEN_COUNT: {unit.unit_id}")
                if candidate_counts["bge"] > target_tokens or any(
                    n > MAX_CONTENT_TOKENS for n in candidate_counts.values()
                ):
                    previous = next(
                        (value for value in reversed(ends) if start < value < end), None
                    )
                    if previous is None:
                        raise ValueError(f"UNIT_REQUIRES_REVIEW: {unit.unit_id}")
                    ranges.append([(0, heading_end), (start, previous)])
                    start = previous
                    candidate = unit.text[:heading_end] + unit.text[start:end]
                    candidate_counts = {
                        name: count(candidate) for name, count in token_counters.items()
                    }
                    if any(
                        type(n) is not int or n < 0 for n in candidate_counts.values()
                    ):
                        raise ValueError(f"INVALID_TOKEN_COUNT: {unit.unit_id}")
                    if candidate_counts["bge"] > target_tokens or any(
                        n > MAX_CONTENT_TOKENS for n in candidate_counts.values()
                    ):
                        raise ValueError(f"UNIT_REQUIRES_REVIEW: {unit.unit_id}")
            ranges.append([(0, heading_end), (start, len(unit.text))])
        citation = {
            "document_id": unit.document_id,
            "section_path": unit.section_path,
            "pdf_pages": unit.pdf_pages.copy(),
            "printed_pages": unit.printed_pages,
            "eligibility": unit.eligibility,
        }
        for spans in ranges:
            text = "".join(unit.text[start:end] for start, end in spans)
            counts = {name: count(text) for name, count in token_counters.items()}
            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            identity = {
                "version": 2 if len(spans) > 1 else 1,
                "target_tokens": target_tokens,
                "unit_id": unit.unit_id,
                "content_hash": content_hash,
                "citation": citation,
            }
            if len(spans) > 1:
                identity["source_spans"] = spans
            chunk_id = hashlib.sha256(
                json.dumps(
                    identity, sort_keys=True, ensure_ascii=False, separators=(",", ":")
                ).encode("utf-8")
            ).hexdigest()
            chunks.append(
                Chunk(
                    chunk_id=chunk_id,
                    unit_ids=[unit.unit_id],
                    text=text,
                    citations=[citation],
                    token_counts=counts,
                    content_hash=content_hash,
                    source_spans={unit.unit_id: spans},
                )
            )
    return chunks
