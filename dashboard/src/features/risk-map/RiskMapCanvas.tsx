import "leaflet/dist/leaflet.css";
import type { Feature, Geometry } from "geojson";
import type { Layer, Path, StyleFunction } from "leaflet";
import { useEffect } from "react";
import { GeoJSON, MapContainer, useMap } from "react-leaflet";

import type { GeoJsonFeatureCollection } from "@/shared/api";
import { classColorVar, resolveColor } from "@/shared/lib/riskClass";
import { vi } from "@/shared/i18n/vi";

import type { Row } from "./model";

interface Props {
  geometry: GeoJsonFeatureCollection;
  rows: readonly Row[];
  /** Đổi khi dữ liệu/kiểu tô đổi → dựng lại lớp GeoJSON. */
  styleKey: string;
  selectedId: string | null;
  onHover: (provinceId: string | null) => void;
  onOpen: (provinceId: string) => void;
}

function View() {
  const map = useMap();
  useEffect(() => {
    // Việt Nam trải dài Bắc–Nam: khung nhìn cố định đọc rõ hơn fitBounds.
    map.setView([16.2, 106.5], 5.4);
  }, [map]);
  return null;
}

const STROKE = "#0a0a0a";

/**
 * Bản đồ tô lớp rời rạc (docs/10 §11.1). Thao tác trên bản đồ (rê chuột, bấm) đều có tương đương ở bảng bên cạnh —
 * bản đồ Leaflet không thao tác được bằng bàn phím nên bảng là đường truy cập chính cho bàn phím/trình đọc màn hình.
 * Tỉnh không có dự báo: xám. Tỉnh có đầu vào ước lượng: viền nét đứt.
 */
export default function RiskMapCanvas({
  geometry,
  rows,
  styleKey,
  selectedId,
  onHover,
  onOpen,
}: Props) {
  const byId = new Map(rows.map((r) => [r.item.province_id, r] as const));

  const style: StyleFunction = (feature) => {
    const id = (feature?.properties as { province_id?: string } | undefined)?.province_id ?? "";
    const row = byId.get(id);
    const est = row?.item.forecast?.flags.includes("estimated_inputs") ?? false;
    const selected = id === selectedId;
    return {
      fillColor: resolveColor(classColorVar(row?.cls ?? null)),
      fillOpacity: row ? 0.9 : 0.35, // tỉnh ngoài bộ lọc vùng mờ đi
      color: selected ? "#ffffff" : STROKE,
      weight: selected ? 2.5 : est ? 1.6 : 1,
      dashArray: est ? "4 3" : undefined,
      opacity: 1,
    };
  };

  const onEachFeature = (feature: Feature<Geometry, { province_id: string }>, layer: Layer) => {
    const id = feature.properties.province_id;
    layer.on({
      mouseover: (e) => {
        onHover(id);
        (e.target as Path).setStyle({ weight: 2.5, color: "#ffffff" });
      },
      mouseout: (e) => {
        onHover(null);
        (e.target as Path).setStyle(style(feature) as Record<string, unknown>);
      },
      click: () => onOpen(id),
    });
  };

  return (
    <MapContainer
      center={[16.2, 106.5]}
      zoom={5.4}
      scrollWheelZoom={false}
      attributionControl={false}
      style={{ height: "100%", width: "100%", background: "var(--bg-page)" }}
      aria-label={vi.map.mapLabel}
    >
      <GeoJSON
        key={styleKey}
        data={geometry as never}
        style={style}
        onEachFeature={onEachFeature as never}
      />
      <View />
    </MapContainer>
  );
}
