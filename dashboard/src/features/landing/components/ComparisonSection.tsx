import { Check, X, ShieldCheck, Scale } from "lucide-react";
import { TiltCard3D } from "@/shared/ui/TiltCard3D";

const COMPARISONS = [
  {
    criterion: "Thời điểm phát hiện nguy cơ",
    traditional: "Bị động: Chỉ phát hiện khi số ca nhập viện đã tăng vọt tại cơ sở y tế.",
    denguesense: "Chủ động đón đầu: Cảnh báo sớm trước 1–6 tháng bằng mô hình học máy tổ hợp.",
  },
  {
    criterion: "Nguồn dữ liệu dự báo",
    traditional: "Chỉ dựa vào số ca mắc lịch sử báo cáo chậm trễ 1–2 tháng.",
    denguesense:
      "Tích hợp đa tầng: Kết hợp dữ liệu dịch tễ với dữ liệu viễn thám khí hậu toàn cầu ERA5 (nhiệt độ, lượng mưa, độ ẩm).",
  },
  {
    criterion: "Khả năng phân định cảnh báo sớm",
    traditional:
      "Dự đoán định tính theo kinh nghiệm chuyên gia, dễ sai lệch ở mùa dịch bất thường.",
    denguesense:
      "ROC-AUC trung bình 6 mùa đạt 0.809 ± 0.041 (mùa 2009 đạt 0.857; mùa khó nhất 2010 đạt 0.758; PR-AUC 0.65 so với mức nền 0.35), kiểm chứng trên 6 mùa dịch thực tế (2005–2010).",
  },
  {
    criterion: "Phương pháp phân bổ nguồn lực",
    traditional: "Phân bổ cào bằng hoặc duyệt đề xuất thủ công mất từ 1–2 tuần.",
    denguesense:
      "Quy hoạch nguyên hỗn hợp (MILP / Google OR-Tools) tối ưu hóa đa mục tiêu dưới 1 phút theo lợi ích biên giảm dần.",
  },
  {
    criterion: "Danh mục nguồn lực điều phối",
    traditional: "Thường chỉ tập trung cấp phát hóa chất dập dịch khi ổ dịch đã lan rộng.",
    denguesense:
      "Cân đối đồng thời 3 trụ cột thiết yếu: Giường bệnh hồi sức, Hóa chất Cloramin B/máy phun và Đội phản ứng nhanh.",
  },
  {
    criterion: "Soạn thảo công văn chỉ đạo",
    traditional: "Mất 2–3 ngày soạn thảo và thẩm định qua nhiều cấp trung gian.",
    denguesense:
      "GenAI Guardrails tự động sinh dự thảo văn bản chuẩn Nghị định 30/2020/NĐ-CP & Quyết định 02/2016/QĐ-TTg chỉ trong 5 phút.",
  },
  {
    criterion: "Kiểm soát số liệu & trích dẫn văn bản",
    traditional: "Rủi ro thất lạc, nhầm lẫn số liệu thống kê giữa các tuyến báo cáo.",
    denguesense:
      "Guardrails G1–G6 khóa cứng số liệu từ phương án phân bổ và đối chiếu trích dẫn danh mục tĩnh, kèm cơ chế thẩm định 4 mắt (Human-in-the-loop).",
  },
];

export function ComparisonSection() {
  return (
    <section id="comparison" className="relative space-y-8 overflow-hidden">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400 mb-3">
          <Scale size={13} />
          <span>SO SÁNH NĂNG LỰC VƯỢT TRỘI</span>
        </div>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          Tại sao chọn DengueSense?
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          So sánh trực diện giữa phương thức ứng phó dịch tễ truyền thống và hệ thống AI thế hệ mới
          của DengueSense.
        </p>
      </div>

      {/* Comparison Table 3D Tilt Card */}
      <TiltCard3D
        maxTilt={3}
        scale={1.008}
        glare={true}
        glareOpacity={0.08}
        className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-xs sm:text-sm uppercase tracking-wider font-display">
                <th className="py-4 px-5 text-slate-400 font-bold w-1/4">Tiêu chí đánh giá</th>
                <th className="py-4 px-5 text-slate-400 font-bold w-[37.5%]">
                  Phương thức truyền thống
                </th>
                <th className="py-4 px-5 text-cyan-300 font-bold w-[37.5%] bg-blue-950/40 border-l border-blue-500/30">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400 shrink-0">
                      <ShieldCheck size={14} />
                    </span>
                    <span className="uppercase tracking-wide text-xs sm:text-sm">
                      DengueSense AI Solution
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
              {COMPARISONS.map((row, idx) => (
                <tr
                  key={row.criterion}
                  className={`transition-colors hover:bg-slate-900/40 ${
                    idx % 2 === 1 ? "bg-slate-900/20" : ""
                  }`}
                >
                  <td className="py-4 px-5 font-semibold text-white">{row.criterion}</td>
                  <td className="py-4 px-5 text-slate-400 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <X size={16} className="text-red-400 shrink-0 mt-0.5" />
                      <span>{row.traditional}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-slate-200 leading-relaxed bg-blue-950/15 border-l border-blue-500/20 font-medium">
                    <div className="flex items-start gap-2">
                      <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                      <span>{row.denguesense}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TiltCard3D>
    </section>
  );
}
