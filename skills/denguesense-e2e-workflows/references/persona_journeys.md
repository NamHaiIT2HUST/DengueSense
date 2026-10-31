# Persona Journeys & Live Demonstration Runbook

This runbook provides the verbatim narrative script and automated assertions for conducting a flawless live demonstration of DengueSense.

---

## 1. Live Pitch Narrative Flow (5 Minutes)

### Minute 0:00 - 1:00: Problem & Real-Time Risk Map
- **Narrative**: Vietnam experiences severe dengue cycles across 34 provinces. Traditional surveillance is reactive and siloed.
- **Action**: Log in as `demo.xem` or `demo.phan-tich`. Show the 34-province interactive map with Conformal Prediction uncertainty intervals (80%, 90%, 95%) and SHAP interpretability.

### Minute 1:00 - 2:30: Alert Detection to Resource Planning
- **Narrative**: High vector indices ($BI \ge 30$) trigger automatic alerts.
- **Action**: Switch to `officer`. Accept alert $\to$ Open Case $\to$ Run Tactical Scenario S2 (Spraying + Larvicide) $\to$ Lock resource allocation plan with immutable cryptographic snapshot.

### Minute 2:30 - 4:00: Guardrailed GenAI Dispatch Synthesis
- **Narrative**: In high-stakes public health, LLM hallucinations are dangerous. DengueSense enforces 6 automated guardrail gates.
- **Action**: Generate B2G dispatch. Highlight verified citations from the Government Gazette (Công báo Chính phủ) and the `CHƯA KÝ` safety watermark.

### Minute 4:00 - 5:00: 4-Eyes Principle & Inter-Provincial Logistics
- **Narrative**: Compliance requires strict 4-eyes oversight and inter-provincial resource mobilization.
- **Action**: Switch to `approver`. Approve & digitally sign the decree. Export inter-provincial supply transfer manifest.

---

## 2. Automated E2E Verification
To run automated Playwright E2E tests validating this exact journey:
```powershell
cd dashboard
npx playwright test
```
All 47 scenarios must pass.
