# dashboard

Admin Dashboard — **React + TypeScript + Vite**.

## Trách nhiệm

- Bản đồ nhiệt rủi ro dịch theo khu vực (Leaflet)
- Xem phương án tối ưu phân bổ nguồn lực từ `backend`
- Duyệt 1-click (Accept/Deny) lệnh điều phối do GenAI soạn (Closed-Loop Governance)
- Theo dõi trạng thái dispatch (B2G / B2B / Citizen)

## Scaffold (khi bắt đầu code)

```bash
npm create vite@latest dashboard -- --template react-ts
```

Thêm: TailwindCSS, Leaflet + react-leaflet, Framer Motion, TanStack Query, Zustand.

## Quy tắc

ESLint + Prettier bắt buộc pass CI, `tsconfig.json` để `strict: true`, gọi API qua 1 lớp service client tập trung (không fetch rải rác trong component). Xem [../CONTRIBUTING.md](../CONTRIBUTING.md).
