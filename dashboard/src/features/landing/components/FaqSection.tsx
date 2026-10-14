import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Chỉ số độ chính xác 89.5% của Layer 1 được đo lường và kiểm chứng như thế nào?",
    answer:
      "Chỉ số 89.5% là độ chính xác phân loại sự kiện bùng phát dịch (tháng có số ca vượt ngưỡng P75 lịch sử của chính tỉnh đó) được đo lường trên tập dữ liệu đo thật qua 6 mùa dịch (2005–2010) tại 34 tỉnh trọng điểm. Mô hình tổ hợp M4-R2 (XGBoost + Random Forest) kết hợp 17 đặc trưng nhân quả từ dịch tễ học và dữ liệu tái phân tích khí hậu toàn cầu ERA5 (nhiệt độ, lượng mưa, độ ẩm), tuân thủ nghiêm ngặt quy tắc chia tập theo thời gian (Time-series split) và embargo 1 tháng để chống rò rỉ dữ liệu tương lai.",
  },
  {
    question: "Giải thuật tối ưu hoá nguồn lực (MILP) có bị chậm khi mở rộng hàng trăm huyện/xã?",
    answer:
      "Không. Hệ thống sử dụng công cụ giải toán công nghiệp Google OR-Tools CP-SAT, mô hình hoá xấp xỉ tuyến tính từng đoạn (piecewise linear) cho hàm lợi ích biên giảm dần. Trên quy mô 34 tỉnh trọng điểm toàn quốc, thời gian giải bài toán phân bổ chỉ mất từ vài chục mili-giây đến dưới 1 giây, hoàn toàn đáp ứng yêu cầu phản ứng khẩn cấp thời gian thực.",
  },
  {
    question:
      "Làm thế nào để đảm bảo Trợ lý GenAI không bị ảo giác (Hallucination) số liệu trong y tế?",
    answer:
      "DengueSense áp dụng cơ chế bảo vệ nghiêm ngặt Guardrail G1 (Strict Data Locking): Mô hình ngôn ngữ lớn (LLM) không được phép tự do sinh số liệu. Mọi số liệu trong văn bản (số ca dự báo, ngân sách, số giường bệnh, số hóa chất, số đội cơ động, tên địa bàn) đều được khóa cứng 100% từ kết quả tính toán của Layer 1 và Layer 2. Nếu phát hiện sai lệch dù chỉ 1 con số, hệ thống tự động kích hoạt bộ ngắt mạch (Circuit Breaker) và phục hồi về bản mẫu khóa cứng an toàn. Đồng thời tuân thủ cơ chế thẩm định 4 mắt (Human-in-the-loop: chuyên viên lập, lãnh đạo duyệt mới ký số).",
  },
  {
    question: "Hệ thống có bảo đảm an toàn dữ liệu cá nhân (PII) của bệnh nhân không?",
    answer:
      "Tuyệt đối an toàn. DengueSense là nền tảng giám sát dịch tễ học vĩ mô cấp cộng đồng (xã, huyện, tỉnh). Toàn bộ dữ liệu đầu vào là số liệu ca bệnh cộng gộp (aggregated data), hệ thống không thu thập, không lưu trữ và không xử lý bất kỳ thông tin nhận dạng cá nhân nào (như tên tuổi, địa chỉ nhà, số CCCD/BHYT) của người bệnh, tuân thủ đúng quy định bảo vệ dữ liệu cá nhân theo Nghị định số 13/2023/NĐ-CP.",
  },
  {
    question:
      "DengueSense có khả năng tích hợp vào các hệ thống HIS/LIS hiện hữu của bệnh viện không?",
    answer:
      "Có. Toàn bộ kiến trúc backend của DengueSense được thiết kế theo chuẩn RESTful API và sự kiện Event-Driven (NATS/Kafka) với hợp đồng dữ liệu chuẩn hóa OpenAPI 3.1. Các bệnh viện và viện nghiên cứu có thể tích hợp trực tiếp qua API Gateway để nhận cảnh báo sớm lâm sàng hoặc đồng bộ dự thảo báo cáo vào hệ thống quản lý bệnh viện (HIS) sẵn có mà không cần thay đổi hạ tầng cốt lõi.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative space-y-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400 mb-3">
          <HelpCircle size={13} />
          <span>HỎI ĐÁP CHUYÊN MÔN</span>
        </div>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          Giải đáp thắc mắc thường gặp
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          Những câu hỏi trọng tâm về phương pháp luận khoa học, độ tin cậy của AI và tính khả thi
          triển khai thực tế.
        </p>
      </div>

      {/* Accordion list */}
      <div className="max-w-3xl mx-auto space-y-3.5">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={faq.question}
              className="rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl transition-all overflow-hidden"
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full py-4 px-5 sm:px-6 flex items-center justify-between text-left gap-4 text-white hover:text-cyan-300 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="font-display font-semibold text-sm sm:text-base leading-snug">
                  {faq.question}
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 border border-slate-800 transition-transform duration-200 ${
                    isOpen
                      ? "rotate-180 bg-blue-500/20 text-cyan-400 border-blue-500/30"
                      : "text-slate-400"
                  }`}
                >
                  <ChevronDown size={16} />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="px-5 pb-5 sm:px-6 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
