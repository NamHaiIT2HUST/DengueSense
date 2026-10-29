import hashlib

import pytest

from app.genai_rag.corpus import extract_pages, load_units, validate_manifest


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


def test_pages_and_review_status_are_validated(tmp_path):
    import json

    import yaml

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
    }
    units.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValueError, match="PAGE_RANGE_INVALID"):
        load_units(mp, units)
    record["pdf_pages"] = [1, 2]
    units.write_text(json.dumps([record]), encoding="utf-8")
    unit = load_units(mp, units)[0]
    assert unit.eligibility == "benchmark_only"
    record["review_status"] = "pending"
    units.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValueError, match="UNREVIEWED_TEXT"):
        load_units(mp, units)
