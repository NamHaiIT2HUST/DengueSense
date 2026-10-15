import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { StatTiles } from "./components/StatTiles";
import { ProblemSolutionFramework } from "./components/ProblemSolutionFramework";
import { OutbreakTimeline } from "./components/OutbreakTimeline";
import { ProvinceRanking } from "./components/ProvinceRanking";
import { InteractiveLayers } from "./components/InteractiveLayers";
import { ComparisonSection } from "./components/ComparisonSection";
import { FaqSection } from "./components/FaqSection";
import { RoadmapStrip } from "./components/RoadmapStrip";
import { SectionHeader } from "./components/SectionHeader";
import { TeamSection } from "./components/TeamSection";
import { CtaBanner } from "./components/CtaBanner";
import { Footer } from "./components/Footer";
import { useRiskSummary } from "./model/useRiskSummary";

// Leaflet (~40 KB gzip) chỉ tải khi tới khu bản đồ — giữ chunk khởi đầu nhỏ (docs/10 §15).
const RiskMap = lazy(() => import("./components/RiskMap").then((m) => ({ default: m.RiskMap })));

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

function MapFallback() {
  return (
    <div
      className="glass-panel flex h-[520px] items-center justify-center rounded-2xl"
      role="status"
      aria-label="Đang tải bản đồ"
    >
      <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
    </div>
  );
}

export function LandingPage() {
  const { data, isLoading, isError } = useRiskSummary();

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorScreen message="Không tải được dữ liệu rủi ro." />;

  return (
    <>
      <Navbar />
      <Hero />

      <main className="mx-auto max-w-7xl space-y-28 px-6 pb-28">
        <section>
          <StatTiles provinces={data.provinces} />
        </section>

        <ProblemSolutionFramework />

        <OutbreakTimeline />

        <InteractiveLayers />

        <section id="map">
          <SectionHeader
            eyebrow="Giám sát dịch tễ không gian"
            title="Bản Đồ Phân Vùng Rủi Ro 34 Tỉnh Thành"
            desc="Hệ thống tự động theo dõi, xếp hạng nguy cơ dịch bệnh và hỗ trợ cảnh báo sớm các điểm nóng truyền nhiễm trên toàn quốc."
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Suspense fallback={<MapFallback />}>
              <RiskMap provinces={data.provinces} />
            </Suspense>
            <ProvinceRanking provinces={data.provinces} />
          </div>
        </section>

        <ComparisonSection />

        <section id="roadmap">
          <SectionHeader
            eyebrow="Kế hoạch triển khai toàn diện"
            title="Lộ Trình Phát Triển & Triển Khai Thực Địa"
            desc="Kế hoạch nghiên cứu R&D, kiểm chứng thực địa tại các bệnh viện và chuyển giao công nghệ cho các cơ sở y tế dự phòng."
          />
          <RoadmapStrip />
        </section>

        <TeamSection />

        <FaqSection />

        <CtaBanner />
      </main>

      <Footer />
    </>
  );
}
