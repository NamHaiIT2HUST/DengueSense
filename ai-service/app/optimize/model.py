"""Data models for Layer 2 Resource Optimization."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class OptimizeItemInput:
    province_id: str
    cases_pred: float
    cost_factor: float = 1.0
    is_high_risk: bool = False
    max_cost: float | None = None


@dataclass(frozen=True)
class ResourceCostConfig:
    cost_per_bed: float = 10_000_000.0  # 10 triệu VNĐ/giường
    cost_per_supply_unit: float = 2_000_000.0  # 2 triệu VNĐ/bộ hóa chất & máy phun
    cost_per_team: float = 25_000_000.0  # 25 triệu VNĐ/đội cơ động phản ứng nhanh


@dataclass
class OptimizedProvinceAllocation:
    province_id: str
    amount: float
    beds: int
    supplies: int
    teams: int
    cases_prevented: float
    explanation: str


@dataclass
class OptimizationResult:
    budget: float
    total_cost: float
    estimated_cases_prevented: float
    allocations: list[OptimizedProvinceAllocation]
    algorithm: str
    solve_time_ms: float
    is_optimal: bool
    strategy: Literal["milp_marginal", "simulated_annealing", "greedy_baseline"] = (
        "milp_marginal"
    )
