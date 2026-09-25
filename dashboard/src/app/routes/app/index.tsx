import { createFileRoute, redirect } from "@tanstack/react-router";

// Trang đầu của console: hiện chỉ có "Mô hình & giới hạn"; bản đồ rủi ro thêm khi backend forecast sẵn sàng (Đợt 1).
export const Route = createFileRoute("/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/mo-hinh" });
  },
});
