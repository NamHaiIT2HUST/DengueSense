import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Chỉ số ROC-AUC của mô hình được đo như thế nào?",
    answer:
      "M4-R2 đạt ROC-AUC trung bình 0.809 trên sáu mùa 2005–2010 trong thí nghiệm exp_016. Đây là kết quả đánh giá dữ liệu lịch sử cấp tỉnh, không phải độ chính xác dự báo hiện nay. Thiết kế mô hình đã chịu ảnh hưởng của các mùa đánh giá, nên chưa thể coi đây là kiểm chứng độc lập hoàn toàn. Xem Hồ sơ mô hình để biết phương pháp và giới hạn.",
  },
  {
    question: "Phương án phân bổ đã được kiểm chứng ngoài thực địa chưa?",
    answer:
      "Chưa. Google OR-Tools giải bài toán phân bổ trong bản demo; ngân sách, hiệu quả giảm ca và tồn kho liên tỉnh là giả định mô phỏng. Cần dữ liệu thực địa và đánh giá chuyên môn trước khi dùng để điều hành.",
  },
  {
    question: "Dự thảo GenAI được kiểm soát thế nào?",
    answer:
      "Guardrails G1–G6 kiểm tra số liệu và trích dẫn; khi không đủ căn cứ, service chặn hoặc dùng mẫu dự phòng có nhãn. Văn bản vẫn chỉ là dự thảo mô phỏng, cần người có thẩm quyền xem và phê duyệt. Corpus truy hồi thử nghiệm chưa được dùng cho công điện B2G.",
  },
  {
    question: "Bản demo có dữ liệu cá nhân bệnh nhân không?",
    answer:
      "Bản demo dùng số ca cộng gộp cấp tỉnh và dữ liệu lịch sử. Không nhập tên, địa chỉ, số CCCD/BHYT hoặc hồ sơ bệnh án vào các biểu mẫu. Hệ thống chưa được thẩm định để xử lý dữ liệu bệnh nhân trong vận hành thực tế.",
  },
  {
    question: "Đã kết nối HIS/LIS hoặc hệ thống CDC chưa?",
    answer:
      "Chưa. Dự án có OpenAPI và kiến trúc service để phát triển tích hợp, nhưng bản thi chạy dữ liệu lịch sử trên localhost. Việc kết nối hệ thống y tế thực cần hợp đồng dữ liệu, phân quyền và kiểm thử riêng.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative space-y-8 overflow-hidden">
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
