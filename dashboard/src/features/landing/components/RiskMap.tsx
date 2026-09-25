import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import type { Layer, StyleFunction } from "leaflet";
import type { Feature, Geometry } from "geojson";
import { motion } from "framer-motion";
import { riskColor, riskLabel } from "../model/riskScale";
import { fetchStaticJson } from "@/shared/api";
import { formatCount } from "@/shared/lib/format";
import { DataSourceBadge } from "@/shared/ui/Badge";
import type { ProvinceRisk } from "../model/types";

interface ProvinceProps {
  province_id: string;
  name: string;
  population: number;
  area_km2: number;
}

function FitBounds({ geojson }: { geojson: GeoJSON.FeatureCollection | null }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson) return;
    // Việt Nam trải dài Bắc-Nam — khung nhìn cố định đọc rõ hơn fitBounds tự động
    map.setView([16.2, 106.5], 5.4);
  }, [geojson, map]);
  return null;
}

export function RiskMap({ provinces }: { provinces: ProvinceRisk[] }) {
  const { data: geojson = null } = useQuery({
    queryKey: ["landing", "provinces-geojson"],
    queryFn: () => fetchStaticJson<GeoJSON.FeatureCollection>("/data/provinces.geojson"),
    staleTime: Infinity,
  });
  const [hovered, setHovered] = useState<ProvinceRisk | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, ProvinceRisk>();
    provinces.forEach((p) => m.set(p.province_id, p));
    return m;
  }, [provinces]);

  const style: StyleFunction = (feature) => {
    const props = feature?.properties as ProvinceProps;
    const p = byId.get(props?.province_id);
    return {
      fillColor: p ? riskColor(p.risk_score) : "#2c2c2a",
      fillOpacity: 0.85,
      color: "#0a0a0a",
      weight: 1,
      opacity: 1,
    };
  };

  const onEachFeature = (feature: Feature<Geometry, ProvinceProps>, layer: Layer) => {
    const p = byId.get(feature.properties.province_id);
    layer.on({
      mouseover: (e) => {
        setHovered(p ?? null);
        (e.target as L.Path).setStyle({ weight: 2.5, color: "#ffffff" });
      },
      mouseout: (e) => {
        (e.target as L.Path).setStyle({ weight: 1, color: "#0a0a0a" });
      },
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="glass-panel relative h-[560px] overflow-hidden rounded-2xl">
        <MapContainer
          center={[16.2, 106.5]}
          zoom={5.4}
          scrollWheelZoom={false}
          zoomControl={true}
          attributionControl={false}
          style={{ height: "100%", width: "100%", background: "var(--bg-page)" }}
        >
          {geojson && (
            <>
              <GeoJSON
                key={provinces.length}
                data={geojson}
                style={style}
                onEachFeature={onEachFeature}
              />
              <FitBounds geojson={geojson} />
            </>
          )}
        </MapContainer>

        {/* Legend */}
        <div className="glass-panel absolute bottom-4 left-4 z-[400] rounded-xl px-4 py-3">
          <div className="mb-2 text-[11px] font-medium text-[var(--ink-muted)]">
            Điểm rủi ro (xếp hạng tương đối, 12 tháng gần nhất)
          </div>
          <div className="flex h-2.5 w-52 overflow-hidden rounded-full">
            {[
              "--risk-1",
              "--risk-2",
              "--risk-3",
              "--risk-4",
              "--risk-5",
              "--risk-6",
              "--risk-7",
              "--risk-8",
            ].map((v) => (
              <div key={v} className="flex-1" style={{ background: `var(${v})` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[var(--ink-muted)]">
            <span>Thấp</span>
            <span>Cao</span>
          </div>
        </div>
      </div>

      {/* Panel thông tin tỉnh đang hover */}
      <div className="glass-panel flex h-[560px] flex-col rounded-2xl p-5">
        {hovered ? (
          <motion.div
            key={hovered.province_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              {hovered.region} Bộ
            </div>
            <h3 className="font-display mt-1 text-xl font-semibold">{hovered.name}</h3>
            <div className="mt-3">
              <DataSourceBadge source={hovered.data_source} />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="text-[12px] text-[var(--ink-muted)]">Điểm rủi ro</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className="font-display text-3xl font-semibold tabular-nums"
                    style={{ color: riskColor(hovered.risk_score) }}
                  >
                    {hovered.risk_score.toFixed(0)}
                  </span>
                  <span className="text-sm text-[var(--ink-muted)]">/100</span>
                </div>
                <div className="mt-1 text-[13px] font-medium text-[var(--ink-secondary)]">
                  {riskLabel(hovered.risk_score)}
                </div>
              </div>

              <div className="h-px bg-[var(--border-hairline)]" />

              <div>
                <div className="text-[12px] text-[var(--ink-muted)]">Số ca (12 tháng gần nhất)</div>
                <div className="font-display mt-1 text-2xl font-semibold tabular-nums">
                  {formatCount(hovered.cases_last_12m)}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 h-10 w-10 rounded-full border-2 border-dashed border-[var(--border-strong)]" />
            <p className="text-sm text-[var(--ink-muted)]">
              Rê chuột vào một tỉnh trên bản đồ
              <br />
              để xem chi tiết
            </p>
          </div>
        )}

        <div className="mt-auto border-t border-[var(--border-hairline)] pt-4 text-[11px] leading-relaxed text-[var(--ink-muted)]">
          Điểm rủi ro hiện là xếp hạng tương đối từ dữ liệu ca bệnh thô,{" "}
          <b>chưa qua model dự báo Layer 1</b> (đang xây ở Phase 2). Xem{" "}
          <a
            href="https://github.com/NamHaiIT2HUST/DengueSense/blob/main/docs/01-chien-luoc-du-lieu.md"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted hover:text-[var(--ink-secondary)]"
          >
            phương pháp luận
          </a>
          .
        </div>
      </div>
    </div>
  );
}
