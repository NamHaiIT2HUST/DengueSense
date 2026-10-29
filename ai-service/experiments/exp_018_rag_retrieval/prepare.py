"""Extract unreviewed PDF page drafts; no OCR or network access."""

import argparse
import json
from pathlib import Path

import yaml

from app.genai_rag.corpus import extract_pages, validate_manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    manifest = yaml.safe_load(args.manifest.read_text(encoding="utf-8"))
    documents = validate_manifest(manifest, args.repo_root)
    args.out.mkdir(parents=True, exist_ok=True)
    for document in documents:
        target = args.out / (document.document_id + ".json")
        if target.exists():
            raise FileExistsError(target)
        pages = extract_pages(document)
        target.write_text(
            json.dumps([p.model_dump() for p in pages], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
