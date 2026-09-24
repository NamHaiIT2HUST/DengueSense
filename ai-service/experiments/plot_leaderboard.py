"""Vẽ biểu đồ so sánh MASE giữa mọi model đã chạy (exp_001..exp_004) theo
horizon — dùng cho MODEL_ZOO_RESULTS.md và slide báo cáo. Số liệu chép tay
từ RESULTS.md của từng experiment (không đọc lại results.json vì mỗi
experiment lưu schema khác nhau) — mỗi khi có model mới, thêm 1 dòng vào
`RESULTS` bên dưới rồi chạy lại.

Chạy: python experiments/plot_leaderboard.py   (từ ai-service/)
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt

_OUT_PATH = Path(__file__).resolve().parent / "leaderboard_mase.png"

# (tên hiển thị, MASE h=1, h=2, h=3, h=6, màu, kiểu nét, độ dày, zorder)
# Nguồn: exp_001/RESULTS.md (B1-B4), exp_002/RESULTS.md (M1/M2a/M2b),
# exp_004/RESULTS.md (M3, bản v2 có climatology khí hậu — bản tốt nhất hiện
# tại). exp_003 (T2 tuning) không có ở đây vì kết quả âm tính, không thay
# đổi bảng xếp hạng (xem MODEL_ZOO_RESULTS.md).
GRAY = "#b0b6bd"
RESULTS: list[tuple[str, float, float, float, float, str, str, float, int]] = [
    ("B1 Persistence", 0.758, 1.196, 1.620, 2.164, GRAY, "--", 1.3, 1),
    ("B2 Seasonal naive", 0.739, 1.028, 1.399, 1.998, GRAY, "--", 1.3, 1),
    (
        "B3 Climatology (mốc mạnh nhất)",
        0.522,
        0.757,
        1.069,
        1.638,
        "#555b63",
        "--",
        1.6,
        2,
    ),
    ("B4 GLM Poisson (pooled)", 0.943, 1.333, 1.768, 2.367, GRAY, "--", 1.3, 1),
    ("M1 GLM NegBin", 0.497, 0.736, 1.138, 1.644, "#4c72b0", "-", 2.0, 3),
    ("M2a XGBoost", 0.449, 0.698, 0.963, 1.611, "#55a868", "-", 2.0, 4),
    ("M2b LightGBM", 0.447, 0.694, 1.001, 1.608, "#dd5f4b", "-", 2.0, 5),
    (
        "M4 Ensemble E1 (tốt nhất)",
        0.429,
        0.671,
        0.898,
        1.479,
        "#e8a317",
        "-",
        3.2,
        7,
    ),
    (
        "M3 hhh4 (+khí hậu, loại khỏi M4)",
        0.542,
        1.014,
        1.477,
        2.232,
        "#8172b2",
        "-",
        2.0,
        4,
    ),
]
HORIZONS = [1, 2, 3, 6]


def plot() -> None:
    fig, ax = plt.subplots(figsize=(8.5, 5.5), dpi=150)

    for name, h1, h2, h3, h6, color, ls, lw, zorder in RESULTS:
        values = [h1, h2, h3, h6]
        ax.plot(
            HORIZONS,
            values,
            marker="o",
            markersize=5,
            linewidth=lw,
            linestyle=ls,
            color=color,
            zorder=zorder,
            label=name,
        )

    ax.axhline(1.0, color="#c0392b", linestyle=":", linewidth=1, alpha=0.6)
    ax.text(
        6.05,
        1.0,
        "MASE=1",
        color="#c0392b",
        fontsize=8,
        va="center",
        alpha=0.8,
    )

    ax.set_xticks(HORIZONS)
    ax.set_xticklabels([f"h={h}" for h in HORIZONS])
    ax.set_xlabel("Horizon dự báo (tháng)")
    ax.set_ylabel("MASE (trung bình qua 8 origin, thấp hơn = tốt hơn)")
    ax.set_title(
        "DengueSense — so sánh MASE mọi model đã thử (panel v0.2.0, real-only 1994-2010)",
        fontsize=10.5,
    )
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.set_xlim(0.8, 6.6)

    handles, labels = ax.get_legend_handles_labels()
    ax.legend(
        handles,
        labels,
        loc="upper left",
        fontsize=8,
        framealpha=0.9,
        title="Baseline (Tier 0)  |  Model (Tier 1)",
        title_fontsize=7.5,
    )

    fig.tight_layout()
    fig.savefig(_OUT_PATH)
    print(f"Đã lưu {_OUT_PATH}")


if __name__ == "__main__":
    plot()
