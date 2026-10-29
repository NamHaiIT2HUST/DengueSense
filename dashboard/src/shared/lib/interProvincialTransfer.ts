/**
 * DengueSense Inter-Provincial Mutual Aid & Emergency Supply Transfer Protocol
 * Conforms to Decree 30/2020/NĐ-CP & Regional CDC Inter-Provincial Mutual Aid Guidelines
 */

export interface ProvinceInventoryStock {
  provinceId: string;
  provinceName: string;
  region: "bac" | "trung" | "nam";
  ulvChemicalLiters: number; // Hóa chất diệt muỗi ULV (Lít)
  abateLarvicideKg: number; // Bột diệt bọ gậy Abate 1SG (Kg)
  dextran40Bags: number; // Túi dịch truyền cao phân tử Dextran 40 (túi 500ml)
  sprayerMachines: number; // Máy phun không gian ULV đeo vai (chiếc)
  riskLevel: "safe" | "moderate" | "alarm" | "critical";
}

export interface SupplyTransferRequest {
  targetProvinceId: string;
  targetProvinceName: string;
  donorProvinceId: string;
  donorProvinceName: string;
  ulvChemicalLiters: number;
  abateLarvicideKg: number;
  dextran40Bags: number;
  sprayerMachines: number;
}

export interface TransferEvaluation {
  isViable: boolean;
  warnings: string[];
  donorStockRemaining: {
    ulvLiters: number;
    abateKg: number;
    dextranBags: number;
    sprayers: number;
  };
  donorReserveRatio: number; // % remaining compared to initial
  transitDistanceKm: number;
  estimatedTransitHours: number;
  transferManifestId: string;
  restitutionDueDate: string; // 14 days loan return date
}

export const PROVINCE_INVENTORY_REGISTRY: Record<string, ProvinceInventoryStock> = {
  angiang: {
    provinceId: "angiang",
    provinceName: "An Giang",
    region: "nam",
    ulvChemicalLiters: 120, // Deficit
    abateLarvicideKg: 350,
    dextran40Bags: 60,
    sprayerMachines: 8,
    riskLevel: "critical",
  },
  can_tho: {
    provinceId: "can_tho",
    provinceName: "Cần Thơ",
    region: "nam",
    ulvChemicalLiters: 950, // High surplus
    abateLarvicideKg: 2100,
    dextran40Bags: 450,
    sprayerMachines: 32,
    riskLevel: "safe",
  },
  dong_thap: {
    provinceId: "dong_thap",
    provinceName: "Đồng Tháp",
    region: "nam",
    ulvChemicalLiters: 680,
    abateLarvicideKg: 1400,
    dextran40Bags: 280,
    sprayerMachines: 20,
    riskLevel: "safe",
  },
  hcm: {
    provinceId: "hcm",
    provinceName: "TP. Hồ Chí Minh",
    region: "nam",
    ulvChemicalLiters: 450, // High consumption rate
    abateLarvicideKg: 950,
    dextran40Bags: 180,
    sprayerMachines: 24,
    riskLevel: "alarm",
  },
  binh_duong: {
    provinceId: "binh_duong",
    provinceName: "Bình Dương",
    region: "nam",
    ulvChemicalLiters: 820,
    abateLarvicideKg: 1850,
    dextran40Bags: 340,
    sprayerMachines: 28,
    riskLevel: "safe",
  },
  danang: {
    provinceId: "danang",
    provinceName: "Đà Nẵng",
    region: "trung",
    ulvChemicalLiters: 740,
    abateLarvicideKg: 1600,
    dextran40Bags: 310,
    sprayerMachines: 26,
    riskLevel: "safe",
  },
  khanh_hoa: {
    provinceId: "khanh_hoa",
    provinceName: "Khánh Hòa",
    region: "trung",
    ulvChemicalLiters: 220,
    abateLarvicideKg: 500,
    dextran40Bags: 90,
    sprayerMachines: 12,
    riskLevel: "alarm",
  },
  hanoi: {
    provinceId: "hanoi",
    provinceName: "Hà Nội",
    region: "bac",
    ulvChemicalLiters: 1200,
    abateLarvicideKg: 3200,
    dextran40Bags: 600,
    sprayerMachines: 45,
    riskLevel: "safe",
  },
};

/**
 * Estimated road transit distance between key provinces (km)
 */
const ROAD_DISTANCE_MATRIX_KM: Record<string, Record<string, number>> = {
  angiang: {
    can_tho: 65,
    dong_thap: 45,
    hcm: 190,
    binh_duong: 220,
  },
  hcm: {
    binh_duong: 32,
    dong_thap: 145,
    can_tho: 165,
    angiang: 190,
  },
  khanh_hoa: {
    danang: 520,
    hcm: 430,
  },
  danang: {
    khanh_hoa: 520,
    hanoi: 760,
  },
};

export function getEstimatedRoadDistanceKm(p1: string, p2: string): number {
  const norm1 = p1.toLowerCase();
  const norm2 = p2.toLowerCase();
  if (norm1 === norm2) return 0;
  return (
    ROAD_DISTANCE_MATRIX_KM[norm1]?.[norm2] ?? ROAD_DISTANCE_MATRIX_KM[norm2]?.[norm1] ?? 150 // default regional average distance
  );
}

/**
 * Evaluates whether donor province can safely transfer supplies to target province
 * without depleting donor's stock below the 35% safety threshold.
 */
export function evaluateSupplyTransfer(request: SupplyTransferRequest): TransferEvaluation {
  const donor = PROVINCE_INVENTORY_REGISTRY[request.donorProvinceId.toLowerCase()] ?? {
    provinceId: request.donorProvinceId,
    provinceName: request.donorProvinceName,
    region: "nam",
    ulvChemicalLiters: 500,
    abateLarvicideKg: 1000,
    dextran40Bags: 200,
    sprayerMachines: 20,
    riskLevel: "safe",
  };

  const remainingUlv = donor.ulvChemicalLiters - request.ulvChemicalLiters;
  const remainingAbate = donor.abateLarvicideKg - request.abateLarvicideKg;
  const remainingDextran = donor.dextran40Bags - request.dextran40Bags;
  const remainingSprayers = donor.sprayerMachines - request.sprayerMachines;

  const warnings: string[] = [];

  const ulvReservePct = (remainingUlv / Math.max(1, donor.ulvChemicalLiters)) * 100;
  const abateReservePct = (remainingAbate / Math.max(1, donor.abateLarvicideKg)) * 100;
  const dextranReservePct = (remainingDextran / Math.max(1, donor.dextran40Bags)) * 100;

  const minReservePct = Math.min(ulvReservePct, abateReservePct, dextranReservePct);

  if (donor.riskLevel === "critical" || donor.riskLevel === "alarm") {
    warnings.push(
      `Đơn vị chi viện (${donor.provinceName}) đang ở mức nguy cơ dịch ${donor.riskLevel.toUpperCase()}, không khuyến nghị xuất điều phối.`
    );
  }

  if (remainingUlv < 0 || remainingAbate < 0 || remainingDextran < 0 || remainingSprayers < 0) {
    warnings.push("Số lượng yêu cầu chi viện vượt quá tổng tồn kho thực tế của đơn vị điều phối.");
  } else if (minReservePct < 35) {
    warnings.push(
      `Tồn kho dự trữ còn lại của ${donor.provinceName} xuống dưới ngưỡng an toàn tối thiểu 35% (${minReservePct.toFixed(1)}%).`
    );
  }

  const distanceKm = getEstimatedRoadDistanceKm(request.targetProvinceId, request.donorProvinceId);
  // Average logistics truck speed: 50 km/h + 0.5h loading/unloading
  const transitHours = Number((distanceKm / 50 + 0.5).toFixed(1));

  // Manifest ID conforming to Decree 30 standard
  const manifestId = `CV-MILP-${new Date().toISOString().slice(2, 4)}${new Date().toISOString().slice(5, 7)}-${request.donorProvinceId.slice(0, 3).toUpperCase()}${request.targetProvinceId.slice(0, 3).toUpperCase()}`;

  // Loan return due in 14 days
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    isViable: warnings.length === 0,
    warnings,
    donorStockRemaining: {
      ulvLiters: Math.max(0, remainingUlv),
      abateKg: Math.max(0, remainingAbate),
      dextranBags: Math.max(0, remainingDextran),
      sprayers: Math.max(0, remainingSprayers),
    },
    donorReserveRatio: Math.max(0, Number(minReservePct.toFixed(1))),
    transitDistanceKm: distanceKm,
    estimatedTransitHours: transitHours,
    transferManifestId: manifestId,
    restitutionDueDate: dueDate,
  };
}
