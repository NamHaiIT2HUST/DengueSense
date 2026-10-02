/**
 * Tài khoản của CHẾ ĐỘ DEMO (`VITE_APP_MODE=demo`, bản Vercel công khai). Chỉ tồn tại trong máy chủ giả MSW ở
 * trình duyệt — KHÔNG phải tài khoản thật, không có quyền gì với backend. Hiển thị công khai trên trang đăng nhập
 * demo để người xem thử dùng; tuyệt đối không dùng mật khẩu này (hay kiểu mật khẩu này) cho hệ thống thật.
 */
export interface DemoAccount {
  username: string;
  password: string;
  displayName: string;
  roles: ("viewer" | "analyst")[];
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    username: "demo.xem",
    password: "demo-2026-xem",
    displayName: "Người xem (demo)",
    roles: ["viewer"],
  },
  {
    username: "demo.phan-tich",
    password: "demo-2026-phan-tich",
    displayName: "Chuyên viên phân tích (demo)",
    roles: ["viewer", "analyst"],
  },
];
