import hashlib
import json
import math


def digest(value):
    encoded = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def distribution(values, total):
    ordered = sorted(v for v in values if v is not None)

    def percentile(p):
        if not ordered:
            return None
        return ordered[max(0, math.ceil(p * len(ordered)) - 1)]

    return {
        "p50": percentile(0.5),
        "p95": percentile(0.95),
        "observed": len(ordered),
        "missing": total - len(ordered),
    }
