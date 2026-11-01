"""Extract unreviewed PDF page drafts with OCR pipeline and PyMuPDF fallback."""

import argparse
import json
from pathlib import Path

import yaml

from app.genai_rag.corpus import (
    Document,
    extract_pages,
    render_page_images,
    validate_manifest,
)


def process_document(
    document: Document,
    out_dir: Path,
    images_dir: Path | None = None,
    use_fallback: bool = False,
) -> Path:
    target = out_dir / (document.document_id + ".json")
    if target.exists():
        raise FileExistsError(target)
    try:
        pages = extract_pages(document, use_fallback=use_fallback)
        target.write_text(
            json.dumps([p.model_dump() for p in pages], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except ValueError as exc:
        if str(exc) == "OCR_REQUIRED":
            # Scanned PDF: Render page images and save raw draft marked as unreviewed
            img_dir = images_dir or (out_dir / "rendered_pages" / document.document_id)
            render_page_images(document, img_dir)
            draft_pages = [
                {
                    "document_id": document.document_id,
                    "pdf_page": i,
                    "text": "",
                    "status": "raw_ocr_draft",
                    "review_status": "unreviewed",
                }
                for i in range(1, document.page_count + 1)
            ]
            target.write_text(
                json.dumps(draft_pages, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        else:
            raise
    return target


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--images-dir", type=Path, default=None)
    parser.add_argument("--use-fallback", action="store_true", default=False)
    args = parser.parse_args()
    manifest = yaml.safe_load(args.manifest.read_text(encoding="utf-8"))
    documents = validate_manifest(manifest, args.repo_root)
    args.out.mkdir(parents=True, exist_ok=True)
    for document in documents:
        process_document(
            document,
            args.out,
            images_dir=args.images_dir,
            use_fallback=args.use_fallback,
        )


if __name__ == "__main__":
    main()
