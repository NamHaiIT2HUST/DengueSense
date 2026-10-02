"""Danh mục phiên bản mô hình + model card + giới hạn — đọc từ file KHOÁ `app/serving/model_versions/*.yaml`
(docs/09 §10.1). Chỉ phiên bản `approved` mới được chạy ở chế độ live; backtest dùng phiên bản `approved` hiện hành.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

DEFAULT_DIR = Path(__file__).resolve().parents[1] / "model_versions"


@dataclass(frozen=True)
class ModelVersionEntry:
    model_version: str
    status: str
    description: str
    source_experiments: list[str]
    model_card: dict[str, Any]
    limitations: list[dict[str, Any]]

    def as_version(self) -> dict[str, Any]:
        return {
            "model_version": self.model_version,
            "status": self.status,
            "description": self.description,
            "source_experiments": list(self.source_experiments),
        }


class Catalog:
    def __init__(self, entries: list[ModelVersionEntry]) -> None:
        if not entries:
            raise ValueError("cần ít nhất một phiên bản mô hình")
        self._entries = {e.model_version: e for e in entries}
        approved = [e for e in entries if e.status == "approved"]
        if len(approved) != 1:
            raise ValueError("phải có ĐÚNG MỘT phiên bản `approved` hiện hành")
        self.current = approved[0]

    @classmethod
    def load(cls, directory: Path = DEFAULT_DIR) -> Catalog:
        entries: list[ModelVersionEntry] = []
        for path in sorted(directory.glob("*.yaml")):
            doc = yaml.safe_load(path.read_text("utf-8"))
            entries.append(
                ModelVersionEntry(
                    model_version=doc["model_version"],
                    status=doc["status"],
                    description=doc["description"],
                    source_experiments=list(doc.get("source_experiments", [])),
                    model_card=doc["model_card"],
                    limitations=list(doc["limitations"]),
                )
            )
        return cls(entries)

    def get(self, model_version: str) -> ModelVersionEntry | None:
        return self._entries.get(model_version)

    def versions(self) -> list[dict[str, Any]]:
        return [e.as_version() for e in self._entries.values()]
