import hashlib
import json
from pathlib import Path

import pytest
import yaml

from app.genai_rag.corpus import (
    extract_pages,
    load_units,
    validate_manifest,
)
from experiments.exp_018_rag_retrieval.prepare import process_document


def manifest_for(tmp_path):
    file = tmp_path / "source.pdf"
    file.write_bytes(b"example")
    return {
        "documents": [
            {
                "document_id": "sample",
                "path": "source.pdf",
                "sha256": hashlib.sha256(b"example").hexdigest(),
                "page_count": 2,
                "legal_status": "unverified",
                "professional_review": "pending",
            }
        ]
    }


def test_hash_mismatch_rejected(tmp_path):
    manifest = manifest_for(tmp_path)
    manifest["documents"][0]["sha256"] = "0" * 64
    with pytest.raises(ValueError, match="INPUT_HASH_MISMATCH"):
        validate_manifest(manifest, tmp_path)


def test_page_count_mismatch(tmp_path, monkeypatch):
    manifest = manifest_for(tmp_path)
    manifest["documents"][0]["page_count"] = 5
    manifest["documents"][0]["sha256"] = hashlib.sha256(b"example").hexdigest()
    doc = validate_manifest(manifest, tmp_path)[0]

    class Page:
        def extract_text(self):
            return "sample text"

    class Reader:
        def __init__(self, _):
            self.pages = [Page(), Page()]

    monkeypatch.setattr("app.genai_rag.corpus.PdfReader", Reader)
    with pytest.raises(ValueError, match="PAGE_COUNT_MISMATCH"):
        extract_pages(doc)


def test_blank_pdf_requires_ocr(tmp_path, monkeypatch):
    doc = validate_manifest(manifest_for(tmp_path), tmp_path)[0]

    class Page:
        def extract_text(self):
            return ""

    class Reader:
        def __init__(self, _):
            self.pages = [Page(), Page()]

    monkeypatch.setattr("app.genai_rag.corpus.PdfReader", Reader)
    with pytest.raises(ValueError, match="OCR_REQUIRED"):
        extract_pages(doc)


def test_complex_pdf_uses_second_parser(tmp_path, monkeypatch):
    doc = validate_manifest(manifest_for(tmp_path), tmp_path)[0]

    class StreamLimit(Exception):
        pass

    class Page:
        def extract_text(self):
            raise StreamLimit()

    class Reader:
        def __init__(self, _):
            self.pages = [Page(), Page()]

    class FallbackPage:
        def get_text(self):
            return "verified source text"

    class FallbackPdf:
        def __enter__(self):
            return [FallbackPage(), FallbackPage()]

        def __exit__(self, *_):
            return False

    class FallbackModule:
        @staticmethod
        def open(_):
            return FallbackPdf()

    from app.genai_rag import corpus

    monkeypatch.setattr(corpus, "PdfReader", Reader)
    monkeypatch.setattr(corpus, "LimitReachedError", StreamLimit)
    original_import_module = corpus.importlib.import_module
    monkeypatch.setattr(
        corpus.importlib,
        "import_module",
        lambda name: (
            FallbackModule if name == "pymupdf" else original_import_module(name)
        ),
    )
    pages = extract_pages(doc)
    assert len(pages) == 2
    assert pages[0].text == "verified source text"


def test_fallback_parser_direct(tmp_path, monkeypatch):
    doc = validate_manifest(manifest_for(tmp_path), tmp_path)[0]

    class FallbackPage:
        def get_text(self):
            return "fallback direct text"

    class FallbackPdf:
        def __enter__(self):
            return [FallbackPage(), FallbackPage()]

        def __exit__(self, *_):
            return False

        def __len__(self):
            return 2

    class FallbackModule:
        @staticmethod
        def open(_):
            return FallbackPdf()

    from app.genai_rag import corpus

    original_import_module = corpus.importlib.import_module
    monkeypatch.setattr(
        corpus.importlib,
        "import_module",
        lambda name: (
            FallbackModule if name == "pymupdf" else original_import_module(name)
        ),
    )
    pages = extract_pages(doc, use_fallback=True)
    assert len(pages) == 2
    assert pages[0].text == "fallback direct text"


def test_render_page_images_and_ocr_draft(tmp_path, monkeypatch):
    doc = validate_manifest(manifest_for(tmp_path), tmp_path)[0]

    class BlankPage:
        def extract_text(self):
            return ""

    class Reader:
        def __init__(self, _):
            self.pages = [BlankPage(), BlankPage()]

    monkeypatch.setattr("app.genai_rag.corpus.PdfReader", Reader)

    rendered_calls: list[Path] = []

    def fake_render(document, out_dir, dpi=150):
        out_dir.mkdir(parents=True, exist_ok=True)
        for i in range(1, document.page_count + 1):
            p = out_dir / f"{document.document_id}-page-{i}.png"
            p.write_bytes(b"png")
            rendered_calls.append(p)
        return rendered_calls

    monkeypatch.setattr(
        "experiments.exp_018_rag_retrieval.prepare.render_page_images", fake_render
    )

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    target = process_document(doc, out_dir)
    assert target.exists()
    assert len(rendered_calls) == 2

    data = json.loads(target.read_text(encoding="utf-8"))
    assert len(data) == 2
    assert data[0]["status"] == "ocr_required"
    assert data[0]["review_status"] == "unreviewed"


def test_pages_and_review_status_are_validated(tmp_path):
    # Model a separate repository even when pytest puts tmp_path inside the checkout.
    (tmp_path / ".git").mkdir()
    manifest = manifest_for(tmp_path)
    mp = tmp_path / "manifest.yaml"
    mp.write_text(yaml.safe_dump(manifest), encoding="utf-8")
    units = tmp_path / "units.json"
    record = {
        "unit_id": "sample/s1",
        "document_id": "sample",
        "section_path": "s1",
        "pdf_pages": [0],
        "printed_pages": None,
        "text": "sample",
        "review_status": "checked",
        "eligibility": "benchmark_only",
        "pdf_sha256": manifest["documents"][0]["sha256"],
    }
    units.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValueError, match="PAGE_RANGE_INVALID"):
        load_units(mp, units)
    record["pdf_pages"] = [1, 2]
    units.write_text(json.dumps([record]), encoding="utf-8")
    unit = load_units(mp, units)[0]
    assert unit.eligibility == "benchmark_only"
    record.pop("pdf_sha256")
    units.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValueError, match="UNIT_HASH_MISMATCH"):
        load_units(mp, units)
    record["pdf_sha256"] = manifest["documents"][0]["sha256"]
    record["review_status"] = "pending"
    units.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValueError, match="UNREVIEWED_TEXT"):
        load_units(mp, units)


def test_unit_hash_mismatch(tmp_path):
    (tmp_path / ".git").mkdir()
    manifest = manifest_for(tmp_path)
    mp = tmp_path / "manifest.yaml"
    mp.write_text(yaml.safe_dump(manifest), encoding="utf-8")
    units = tmp_path / "units.json"
    record = {
        "unit_id": "sample/s1",
        "document_id": "sample",
        "section_path": "s1",
        "pdf_pages": [1, 2],
        "printed_pages": None,
        "text": "sample",
        "review_status": "checked",
        "eligibility": "benchmark_only",
        "pdf_sha256": "bad" * 21 + "b",
    }
    units.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValueError, match="UNIT_HASH_MISMATCH"):
        load_units(mp, units)
