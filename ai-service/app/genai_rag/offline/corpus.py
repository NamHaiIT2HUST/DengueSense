"""Load source documents and reviewed extraction units for offline retrieval."""

import hashlib
import json
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


class IndexedSection(BaseModel):
    section_id: str
    unit_ids: list[str]
    description: str = ""


class Document(BaseModel):
    model_config = ConfigDict(extra="allow")
    document_id: str
    path: str
    sha256: str
    page_count: int
    legal_status: Literal[
        "unverified", "effective", "expired", "replaced", "not_applicable"
    ]
    professional_review: Literal["pending", "approved", "rejected"]
    indexed_sections: list[IndexedSection]
    resolved_path: Path


class PageDraft(BaseModel):
    document_id: str
    pdf_page: int
    text: str


class SourceUnit(BaseModel):
    unit_id: str
    document_id: str
    section_path: str
    pdf_pages: list[int]
    printed_pages: str | None
    text: str
    review_status: str
    eligibility: Literal["benchmark_only"]


def validate_manifest(manifest: dict, repo_root: Path) -> list[Document]:
    documents = []
    seen = set()
    unit_owners = {}
    root = repo_root.resolve()
    for item in manifest["documents"]:
        relative = Path(item["path"])
        path = (root / relative).resolve()
        if relative.is_absolute() or not path.is_relative_to(root):
            raise ValueError("INVALID_INPUT_PATH")
        if hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError("INPUT_HASH_MISMATCH")
        doc = Document.model_validate({**item, "resolved_path": path})
        if doc.document_id in seen or doc.page_count < 1:
            raise ValueError("INVALID_MANIFEST")
        section_ids = [section.section_id for section in doc.indexed_sections]
        unit_ids = [uid for section in doc.indexed_sections for uid in section.unit_ids]
        if (
            not all(section_ids)
            or len(set(section_ids)) != len(section_ids)
            or not all(unit_ids)
            or len(set(unit_ids)) != len(unit_ids)
        ):
            raise ValueError(f"INVALID_SECTIONS: {doc.document_id}")
        for unit_id in unit_ids:
            if unit_id in unit_owners:
                raise ValueError(
                    f"DUPLICATE_UNIT_ID: {unit_id} documents={unit_owners[unit_id]},{doc.document_id}"
                )
            unit_owners[unit_id] = doc.document_id
        seen.add(doc.document_id)
        documents.append(doc)
    return documents


def extract_pages(document: Document) -> list[PageDraft]:
    if PdfReader is None:
        raise RuntimeError("pypdf required; install requirements-rag.txt")
    pages = PdfReader(document.resolved_path).pages
    if len(pages) != document.page_count:
        raise ValueError("PAGE_COUNT_MISMATCH")
    result = [
        PageDraft(
            document_id=document.document_id, pdf_page=i, text=page.extract_text() or ""
        )
        for i, page in enumerate(pages, 1)
    ]
    if not any(page.text.strip() for page in result):
        raise ValueError("OCR_REQUIRED")
    return result


def load_units(manifest_path: Path, units_path: Path) -> list[SourceUnit]:
    manifest_path = manifest_path.resolve()
    root = next(
        (p for p in manifest_path.parents if (p / ".git").exists()),
        manifest_path.parent,
    )
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    documents = {d.document_id: d for d in validate_manifest(manifest, root)}
    units = [
        SourceUnit.model_validate(x)
        for x in json.loads(units_path.read_text(encoding="utf-8"))
    ]
    seen = set()
    for unit in units:
        if unit.document_id not in documents or unit.unit_id in seen:
            raise ValueError(
                f"INVALID_UNIT: {unit.unit_id} document={unit.document_id}"
            )
        seen.add(unit.unit_id)
        doc = documents[unit.document_id]
        allowed = {uid for section in doc.indexed_sections for uid in section.unit_ids}
        if unit.unit_id not in allowed:
            raise ValueError(
                f"OUT_OF_SCOPE: {unit.unit_id} document={unit.document_id}"
            )
        if not unit.pdf_pages or any(
            p < 1 or p > documents[unit.document_id].page_count for p in unit.pdf_pages
        ):
            raise ValueError(
                f"PAGE_RANGE_INVALID: {unit.unit_id} document={unit.document_id}"
            )
        if unit.review_status != "checked" or not unit.text.strip():
            raise ValueError(
                f"UNREVIEWED_TEXT: {unit.unit_id} document={unit.document_id}"
            )
    return units
