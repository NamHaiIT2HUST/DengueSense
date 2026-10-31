/**
 * SEIR-V Mechanistic Epidemiological Dynamic Model for Dengue Transmission
 * Solves coupled Ross-Macdonald ordinary differential equations using 4th-order Runge-Kutta (RK4).
 * Conforms to WHO vector-borne disease modeling standards and Decree 30/2020/NĐ-CP analytical frameworks.
 */

export interface SeirvParameters {
  /** Quy mô dân số mục tiêu (Người) */
  population: number;
  /** Tỷ lệ muỗi trên người (m = Nv / Nh) */
  mosquitoPerPerson: number;
  /** Nhiệt độ môi trường (°C), ảnh hưởng trực tiếp đến thời gian ủ bệnh ngoại sinh EIP */
  temperatureC: number;
  /** Hiệu quả kiểm soát bọ gậy / loăng quăng (0 = không can thiệp, 1 = diệt sạch 100%) */
  larvicideEfficacy: number;
  /** Độ bao phủ và hiệu lực phun hóa chất không gian ULV diệt muỗi trưởng thành (0 đến 1) */
  spaceSprayingCoverage: number;
  /** Số ngày mô phỏng (mặc định 120 ngày ~ 4 tháng) */
  simulationDays: number;
}

export interface SimulationStep {
  day: number;
  /** Số người nhạy cảm */
  sh: number;
  /** Số người ủ bệnh */
  eh: number;
  /** Số người nhiễm bệnh (ca hoạt động) */
  ih: number;
  /** Số người hồi phục và miễn dịch */
  rh: number;
  /** Tỷ lệ muỗi mang virus lây nhiễm (Iv / Nv) */
  ivFraction: number;
  /** Ca mắc mới tích lũy */
  cumulativeCases: number;
  /** Hệ số lây nhiễm hiệu dụng Rt */
  rt: number;
}

export interface SimulationResult {
  timeline: SimulationStep[];
  /** Hệ số lây nhiễm cơ bản ban đầu R0 */
  r0: number;
  /** Hệ số lây nhiễm hiệu dụng cuối kỳ Rt */
  finalRt: number;
  /** Đỉnh dịch (Số ca mắc tối đa trong ngày) */
  peakCases: number;
  /** Ngày đạt đỉnh dịch */
  peakDay: number;
  /** Tổng số ca mắc tích lũy trong toàn bộ chu kỳ */
  totalCases: number;
  /** Tỷ lệ tấn công cộng đồng (Attack rate %) */
  attackRatePercent: number;
  /** Trạng thái kiểm soát dịch bệnh */
  status: "contained" | "controlled" | "spreading" | "explosive";
}

export const DEFAULT_SEIRV_PARAMS: SeirvParameters = {
  population: 100000,
  mosquitoPerPerson: 2.5,
  temperatureC: 28.5,
  larvicideEfficacy: 0.2,
  spaceSprayingCoverage: 0.15,
  simulationDays: 120,
};

export type PresetKey = "baseline" | "larvicide_only" | "ulv_spraying" | "integrated_ivm";

export const PRESET_SCENARIOS: Record<
  PresetKey,
  { name: string; description: string; params: Partial<SeirvParameters> }
> = {
  baseline: {
    name: "Không can thiệp (Baseline Outbreak)",
    description:
      "Mô phỏng đà bùng phát tự nhiên khi không triển khai phun hóa chất hay diệt bọ gậy.",
    params: {
      larvicideEfficacy: 0.05,
      spaceSprayingCoverage: 0.05,
    },
  },
  larvicide_only: {
    name: "Chiến dịch Diệt bọ gậy cộng đồng",
    description:
      "Huy động cộng tác viên y tế cơ sở và người dân lật úp dụng cụ chứa nước (giảm 70% bọ gậy).",
    params: {
      larvicideEfficacy: 0.7,
      spaceSprayingCoverage: 0.1,
    },
  },
  ulv_spraying: {
    name: "Phun dập dịch khẩn cấp ULV",
    description: "Đội cơ động CDC phun hóa chất diệt muỗi không gian diện rộng với độ bao phủ 85%.",
    params: {
      larvicideEfficacy: 0.25,
      spaceSprayingCoverage: 0.85,
    },
  },
  integrated_ivm: {
    name: "Quản lý Vector tích hợp (IVM Tổng lực)",
    description:
      "Kết hợp đồng bộ diệt loăng quăng 80% và phun không gian ULV 85% dập tắt chu kỳ lây truyền.",
    params: {
      larvicideEfficacy: 0.8,
      spaceSprayingCoverage: 0.85,
    },
  },
};

/**
 * Calculates extrinsic incubation rate (sigma_v) as a function of temperature (°C).
 * Based on empirical Macdonald-Dengue thermodynamic formulations.
 */
export function calculateExtrinsicIncubationRate(temperatureC: number): number {
  if (temperatureC <= 16) {
    // Under 16°C, virus replication within Aedes aegypti halts
    return 0.001;
  }
  // EIP = 111 / (T - 11.2) days
  const eipDays = 111 / (temperatureC - 11.2);
  return 1 / Math.max(eipDays, 4.0);
}

/**
 * Executes 4th-Order Runge-Kutta simulation of Dengue SEIR-V dynamics.
 */
export function simulateSeirv(customParams?: Partial<SeirvParameters>): SimulationResult {
  const params: SeirvParameters = { ...DEFAULT_SEIRV_PARAMS, ...customParams };

  const Nh = params.population;
  const m = params.mosquitoPerPerson;
  const Nv0 = Nh * m;

  // Transmission parameters
  const biteRate = 0.4; // 0.4 bites/mosquito/day
  const betaH = 0.75; // Probability of human infection per infectious bite
  const betaV = 0.75; // Probability of mosquito infection per bite on infectious human
  const sigmaH = 1 / 5.5; // Intrinsic incubation rate in humans (~5.5 days)
  const gammaH = 1 / 7.0; // Recovery rate in humans (~7.0 days)

  // Vector parameters dependent on temperature & interventions
  const sigmaV = calculateExtrinsicIncubationRate(params.temperatureC);
  const naturalMosquitoMortality = 0.07; // 1 / 14 days natural lifespan
  const sprayMortalityBoost = params.spaceSprayingCoverage * 0.35; // Sprayed chemical extra mortality
  const muV = naturalMosquitoMortality + sprayMortalityBoost;

  // Recruitment rate of adult mosquitoes modulated by larvicide efficacy
  const larvicideSuppression = 1.0 - Math.min(Math.max(params.larvicideEfficacy, 0), 0.95);
  const lambdaV = naturalMosquitoMortality * Nv0 * larvicideSuppression;

  // Calculate R0 (Basic Reproduction Number)
  const r0Squared =
    (m * Math.pow(biteRate, 2) * betaH * betaV * sigmaV) / (gammaH * muV * (sigmaV + muV));
  const r0 = Math.sqrt(Math.max(r0Squared, 0));

  // Initial conditions: seeded with 10 initial active cases
  const initialInfectiousHumans = Math.min(10, Nh * 0.01);
  let sh = Nh - initialInfectiousHumans;
  let eh = 0;
  let ih = initialInfectiousHumans;
  let rh = 0;

  // Mosquito state variables
  let sv = Nv0 * 0.95;
  let ev = Nv0 * 0.03;
  let iv = Nv0 * 0.02;

  const dt = 0.25; // 6-hour timestep for stability
  const totalSteps = Math.round(params.simulationDays / dt);
  const recordInterval = Math.round(1 / dt); // Record once per day

  const timeline: SimulationStep[] = [];
  let peakCases = ih;
  let peakDay = 0;
  let cumulativeCases = ih;

  // Record initial state (Day 0)
  timeline.push({
    day: 0,
    sh: Math.round(sh),
    eh: Math.round(eh),
    ih: Math.round(ih),
    rh: Math.round(rh),
    ivFraction: Number((iv / (sv + ev + iv || 1)).toFixed(4)),
    cumulativeCases: Math.round(cumulativeCases),
    rt: Number(r0.toFixed(2)),
  });

  // Vector ODE derivatives
  const derivatives = (
    state: [number, number, number, number, number, number, number]
  ): [number, number, number, number, number, number, number] => {
    const [cSh, cEh, cIh, , cSv, cEv, cIv] = state;

    // Force of infection on humans (lambda_h)
    const lambdaH = (biteRate * betaH * cIv) / Nh;
    const dSh = -lambdaH * cSh;
    const dEh = lambdaH * cSh - sigmaH * cEh;
    const dIh = sigmaH * cEh - gammaH * cIh;
    const dRh = gammaH * cIh;

    // Force of infection on mosquitoes (lambda_v)
    const lambdaVForce = (biteRate * betaV * cIh) / Nh;
    const dSv = lambdaV - lambdaVForce * cSv - muV * cSv;
    const dEv = lambdaVForce * cSv - (sigmaV + muV) * cEv;
    const dIv = sigmaV * cEv - muV * cIv;

    return [dSh, dEh, dIh, dRh, dSv, dEv, dIv];
  };

  for (let step = 1; step <= totalSteps; step++) {
    const state: [number, number, number, number, number, number, number] = [
      sh,
      eh,
      ih,
      rh,
      sv,
      ev,
      iv,
    ];

    // RK4 integration
    const k1 = derivatives(state);
    const s2: [number, number, number, number, number, number, number] = state.map((v, i) =>
      Math.max(0, v + (dt / 2) * (k1[i] ?? 0))
    ) as [number, number, number, number, number, number, number];
    const k2 = derivatives(s2);
    const s3: [number, number, number, number, number, number, number] = state.map((v, i) =>
      Math.max(0, v + (dt / 2) * (k2[i] ?? 0))
    ) as [number, number, number, number, number, number, number];
    const k3 = derivatives(s3);
    const s4: [number, number, number, number, number, number, number] = state.map((v, i) =>
      Math.max(0, v + dt * (k3[i] ?? 0))
    ) as [number, number, number, number, number, number, number];
    const k4 = derivatives(s4);

    // Update state
    const dSh = (dt / 6) * ((k1[0] ?? 0) + 2 * (k2[0] ?? 0) + 2 * (k3[0] ?? 0) + (k4[0] ?? 0));
    sh = Math.max(0, sh + dSh);
    eh = Math.max(
      0,
      eh + (dt / 6) * ((k1[1] ?? 0) + 2 * (k2[1] ?? 0) + 2 * (k3[1] ?? 0) + (k4[1] ?? 0))
    );
    ih = Math.max(
      0,
      ih + (dt / 6) * ((k1[2] ?? 0) + 2 * (k2[2] ?? 0) + 2 * (k3[2] ?? 0) + (k4[2] ?? 0))
    );
    rh = Math.max(
      0,
      rh + (dt / 6) * ((k1[3] ?? 0) + 2 * (k2[3] ?? 0) + 2 * (k3[3] ?? 0) + (k4[3] ?? 0))
    );

    sv = Math.max(
      0,
      sv + (dt / 6) * ((k1[4] ?? 0) + 2 * (k2[4] ?? 0) + 2 * (k3[4] ?? 0) + (k4[4] ?? 0))
    );
    ev = Math.max(
      0,
      ev + (dt / 6) * ((k1[5] ?? 0) + 2 * (k2[5] ?? 0) + 2 * (k3[5] ?? 0) + (k4[5] ?? 0))
    );
    iv = Math.max(
      0,
      iv + (dt / 6) * ((k1[6] ?? 0) + 2 * (k2[6] ?? 0) + 2 * (k3[6] ?? 0) + (k4[6] ?? 0))
    );

    // People transitioning from Sh to Eh represent new incidence
    const newInfections = -dSh;
    if (newInfections > 0) {
      cumulativeCases += newInfections;
    }

    if (ih > peakCases) {
      peakCases = ih;
      peakDay = Math.round(step * dt * 10) / 10;
    }

    if (step % recordInterval === 0) {
      const currentDay = Math.round(step * dt);
      const currentSusceptibleRatio = sh / Nh;
      const currentNv = sv + ev + iv || 1;
      const effectiveM = currentNv / Nh;
      const dynamicR0Squared =
        (effectiveM * Math.pow(biteRate, 2) * betaH * betaV * sigmaV) /
        (gammaH * muV * (sigmaV + muV));
      const rt = Math.sqrt(Math.max(dynamicR0Squared, 0)) * currentSusceptibleRatio;

      timeline.push({
        day: currentDay,
        sh: Math.round(sh),
        eh: Math.round(eh),
        ih: Math.round(ih),
        rh: Math.round(rh),
        ivFraction: Number((iv / currentNv).toFixed(4)),
        cumulativeCases: Math.round(cumulativeCases),
        rt: Number(rt.toFixed(2)),
      });
    }
  }

  const finalStep = timeline[timeline.length - 1];
  const finalRt = finalStep ? finalStep.rt : r0;
  const attackRatePercent = Number(((cumulativeCases / Nh) * 100).toFixed(2));

  let status: SimulationResult["status"] = "spreading";
  if (finalRt < 0.8 && peakCases < Nh * 0.02) {
    status = "contained";
  } else if (finalRt < 1.0) {
    status = "controlled";
  } else if (finalRt > 2.0 || attackRatePercent > 15) {
    status = "explosive";
  }

  return {
    timeline,
    r0: Number(r0.toFixed(2)),
    finalRt,
    peakCases: Math.round(peakCases),
    peakDay: Math.round(peakDay),
    totalCases: Math.round(cumulativeCases),
    attackRatePercent,
    status,
  };
}
