import hashlib

import pytest

from app.genai_rag.offline.corpus import extract_pages, load_units, validate_manifest


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
                "indexed_sections": [{"section_id": "s1", "unit_ids": ["sample/s1"]}],
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

    monkeypatch.setattr("app.genai_rag.offline.corpus.PdfReader", Reader)
    with pytest.raises(ValueError, match="OCR_REQUIRED"):
        extract_pages(doc)


def test_pages_and_review_status_are_validated(tmp_path):
    import json

    import yaml

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


def test_membership_uses_exact_unit_and_document_ids(tmp_path):
    import json

    import yaml

    (tmp_path / ".git").mkdir()
    manifest = manifest_for(tmp_path)
    manifest["documents"][0]["indexed_sections"] = [
        {"section_id": "section-7", "unit_ids": ["sample/s7"]}
    ]
    manifest["documents"].append(
        {
            **manifest["documents"][0],
            "document_id": "other",
            "indexed_sections": [{"section_id": "section-7", "unit_ids": ["other/s7"]}],
        }
    )
    mp = tmp_path / "manifest.yaml"
    mp.write_text(yaml.safe_dump(manifest), encoding="utf-8")
    path = tmp_path / "units.json"
    record = {
        "unit_id": "sample/s70",
        "document_id": "sample",
        "section_path": "section-70",
        "pdf_pages": [1],
        "printed_pages": None,
        "text": "text",
        "review_status": "checked",
        "eligibility": "benchmark_only",
    }
    path.write_text(json.dumps([record]))
    with pytest.raises(ValueError, match=r"OUT_OF_SCOPE.*sample/s70.*sample"):
        load_units(mp, path)
    record.update(unit_id="sample/s7", document_id="other")
    path.write_text(json.dumps([record]))
    with pytest.raises(ValueError, match=r"OUT_OF_SCOPE.*sample/s7.*other"):
        load_units(mp, path)
    record.update(document_id="sample", review_status="pending")
    path.write_text(json.dumps([record]))
    with pytest.raises(ValueError, match=r"UNREVIEWED_TEXT.*sample/s7.*sample"):
        load_units(mp, path)


def test_hcdc_section_spanning_pages_is_preserved(tmp_path):
    import json

    import yaml

    (tmp_path / ".git").mkdir()
    manifest = manifest_for(tmp_path)
    manifest["documents"][0]["indexed_sections"] = [
        {"section_id": "muc-7", "unit_ids": ["sample/muc-7"]}
    ]
    mp = tmp_path / "manifest.yaml"
    mp.write_text(yaml.safe_dump(manifest), encoding="utf-8")
    path = tmp_path / "units.json"
    text = "Mục 7: đầu trang.\nCuối trang sau: không cắt."
    path.write_text(
        json.dumps(
            [
                {
                    "unit_id": "sample/muc-7",
                    "document_id": "sample",
                    "section_path": "Mục 7",
                    "pdf_pages": [1, 2],
                    "printed_pages": None,
                    "text": text,
                    "review_status": "checked",
                    "eligibility": "benchmark_only",
                }
            ]
        )
    )
    unit = load_units(mp, path)[0]
    assert unit.pdf_pages == [1, 2]
    assert unit.text == text


def test_manifest_rejects_unit_id_assigned_to_two_documents(tmp_path):
    manifest = manifest_for(tmp_path)
    manifest["documents"].append({**manifest["documents"][0], "document_id": "other"})
    with pytest.raises(ValueError, match="DUPLICATE_UNIT_ID"):
        validate_manifest(manifest, tmp_path)
