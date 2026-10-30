# Climate Features & Environmental Preprocessing

This reference specifies the climate variables extracted from ERA5-Land reanalysis and how they map to vector biology indicators in DengueSense.

---

## 1. Primary Variables

| Feature Name | Source Band | Unit | Transformation | Biological Relevance |
|---|---|---|---|---|
| `temp_mean` | 2m temperature | $^\circ\text{C}$ | Monthly Mean | Governs viral replication rate in vector |
| `temp_min` | 2m temperature | $^\circ\text{C}$ | Monthly Min | Extreme cold halts mosquito flight and larval survival |
| `temp_max` | 2m temperature | $^\circ\text{C}$ | Monthly Max | Extreme heat ($>36^\circ\text{C}$) increases vector mortality |
| `precip_total` | Total precipitation | mm | Monthly Sum | Determines standing water breeding site availability |
| `humidity_mean` | Relative humidity | % | Derived from Dewpoint | Direct influence on adult mosquito lifespan and desiccation |

---

## 2. Lag Structures
- **Lag 1 (t-1)**: Immediate vector activity and adult biting density.
- **Lag 2 (t-2)**: Larval development cycle and pupation resulting from precipitation 30-60 days prior.
- **Lag 3 (t-3)**: Base ecological priming (egg hydration, seasonal rainfall onset).
