import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { StatTiles } from "./components/StatTiles";
import { RiskMap } from "./components/RiskMap";
import { ProvinceRanking } from "./components/ProvinceRanking";
import { OptimizationPreview } from "./components/OptimizationPreview";
import { DispatchPreview } from "./components/DispatchPreview";
import { RoadmapStrip } from "./components/RoadmapStrip";
import { SectionHeader } from "./components/SectionHeader";
import { Footer } from "./components/Footer";
import { useRiskData } from "./lib/useRiskData";
import { Loader2 } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      <p className="text-sm text-[var(--ink-muted)]">Đang tải dữ liệu tỉnh thành…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-[var(--status-critical)]">{message}</p>
    </div>
  );
}

function Dashboard() {
  const { data, isLoading, isError } = useRiskData();

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorScreen message="Không tải được dữ liệu rủi ro." />;

  const top = [...data.provinces].sort((a, b) => b.risk_score - a.risk_score)[0];

  return (
    <>
      <Navbar />
      <Hero />

      <main className="mx-auto max-w-7xl space-y-28 px-6 pb-28">
        <section>
          <StatTiles provinces={data.provinces} />
        </section>

        <section id="map">
          <SectionHeader
            eyebrow="Dữ liệu thật, không phải mock"
            title="Bản đồ rủi ro theo 34 tỉnh thành"
            desc={`Tổng hợp từ ${data.meta.window_start} đến ${data.meta.window_end}. ${data.meta.note}`}
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <RiskMap provinces={data.provinces} />
            <ProvinceRanking provinces={data.provinces} />
          </div>
        </section>

        <section id="optimize">
          <SectionHeader
            eyebrow="Layer 2"
            title="Tối ưu phân bổ nguồn lực"
            desc="Không xếp hạng theo rủi ro thuần — tối ưu số ca giảm được dưới ràng buộc ngân sách."
          />
          <OptimizationPreview provinces={data.provinces} />
        </section>

        <section id="dispatch">
          <SectionHeader
            eyebrow="Layer 3"
            title="GenAI soạn lệnh điều phối"
            desc="Con người luôn duyệt cuối — không có đường nào ban hành mà không qua phê duyệt."
          />
          <DispatchPreview top={top} />
        </section>

        <section id="roadmap">
          <SectionHeader
            eyebrow="Đang xây dựng công khai"
            title="Lộ trình kỹ thuật"
            desc="Theo dõi chi tiết tại ROADMAP.md — mỗi phase có cổng nghiệm thu rõ ràng."
          />
          <RoadmapStrip />
        </section>
      </main>

      <Footer />
    </>
  );
}

export default function App() {
  return <Dashboard />;
}
