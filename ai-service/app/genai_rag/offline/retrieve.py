"""Offline lexical retrieval over reviewed chunks."""

import re
import unicodedata

from rank_bm25 import BM25Okapi

from app.genai_rag.offline.chunking import Chunk
from app.genai_rag.offline.evaluate import Hit


def _tokens(text: str) -> list[str]:
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFC", text).casefold())


def search_bm25(chunks: list[Chunk], query: str, top_k: int = 5) -> list[Hit]:
    if not chunks:
        raise ValueError("EMPTY_CORPUS")
    if type(top_k) is not int or top_k < 1:
        raise ValueError("INVALID_TOP_K")
    query_tokens = _tokens(query)
    if not query_tokens:
        raise ValueError("INVALID_QUERY")
    corpus = [_tokens(chunk.text) for chunk in chunks]
    if not any(corpus):
        raise ValueError("EMPTY_CORPUS")
    bm25 = BM25Okapi(corpus, k1=1.5, b=0.75)
    scores = bm25.get_scores(query_tokens)
    terms = set(query_tokens)
    matching = [i for i, tokens in enumerate(corpus) if terms.intersection(tokens)]
    matching.sort(key=lambda i: (-float(scores[i]), chunks[i].chunk_id))
    return [
        Hit(
            chunk_id=chunks[i].chunk_id,
            unit_ids=chunks[i].unit_ids,
            score=float(scores[i]),
            citations=chunks[i].citations,
            source_spans=chunks[i].source_spans,
        )
        for i in matching[:top_k]
    ]
