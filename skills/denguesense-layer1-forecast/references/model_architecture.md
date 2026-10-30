# DengueSense Model Architecture & Calibration Reference

This document describes the mathematical formulation, hyperparameter bounds, and calibration protocols for DengueSense Layer 1 models.

---

## 1. SEIR-V Mathematical Equations

The coupled ODE system is defined as follows:

$$\frac{dS_h}{dt} = \mu_h N_h - \frac{a(T) \beta_{vh} I_v}{N_h} S_h - \mu_h S_h$$
$$\frac{dE_h}{dt} = \frac{a(T) \beta_{vh} I_v}{N_h} S_h - (\gamma_h + \mu_h) E_h$$
$$\frac{dI_h}{dt} = \gamma_h E_h - (\sigma_h + \mu_h) I_h$$
$$\frac{dR_h}{dt} = \sigma_h I_h - \mu_h R_h$$

Vector population dynamics:
$$\frac{dS_v}{dt} = \Lambda_v(T) - \frac{a(T) \beta_{hv} I_h}{N_h} S_v - \mu_v(T) S_v$$
$$\frac{dE_v}{dt} = \frac{a(T) \beta_{hv} I_h}{N_h} S_v - (\gamma_v(T) + \mu_v(T)) E_v$$
$$\frac{dI_v}{dt} = \gamma_v(T) E_v - \mu_v(T) I_v$$

Where:
- $a(T)$: Temperature-dependent biting rate
- $\gamma_v(T) = \frac{1}{EIP(T)}$: Extrinsic incubation rate
- $\mu_v(T)$: Temperature-dependent mosquito mortality rate

---

## 2. Conformal Prediction Protocol

1. **Non-Conformity Measure**:
   $$s_i = |y_i - \hat{y}_i|$$
2. **Empirical Quantile**:
   For coverage $1 - \alpha$, compute:
   $$\hat{q}_{1-\alpha} = \text{Quantile}\left(\{s_i\}_{i=1}^n, \frac{\lceil(n+1)(1-\alpha)\rceil}{n}\right)$$
3. **Calibrated Interval**:
   $$C(x) = [\max(0, \hat{y} - \hat{q}_{1-\alpha}), \hat{y} + \hat{q}_{1-\alpha}]$$

In DengueSense, intervals are bounded at zero because case counts cannot be negative.
