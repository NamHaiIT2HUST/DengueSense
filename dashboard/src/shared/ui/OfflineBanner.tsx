import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { notify } from "@/shared/lib/notify";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      notify.success("Đã khôi phục kết nối mạng", "Đồng bộ hóa trực tuyến đã sẵn sàng", {
        type: "system",
      });
    }

    function handleOffline() {
      setIsOnline(false);
      notify.warning(
        "Mất kết nối Internet",
        "Hệ thống chuyển sang chế độ đệm ngoại tuyến (Offline Resiliency)",
        { type: "system" }
      );
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2 shadow-xs transition-colors print:hidden"
    >
      <WifiOff size={14} className="text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
      <span>
        <strong>Chế độ Ngoại tuyến (Offline):</strong> Bạn đang mất kết nối Internet. Dữ liệu tra
        cứu được lưu trong bộ nhớ đệm cục bộ và sẽ tự động đồng bộ khi có mạng.
      </span>
    </div>
  );
}
