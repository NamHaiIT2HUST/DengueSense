# ADR-0005 — JWT EdDSA + refresh token xoay vòng qua cookie HttpOnly

**Trạng thái:** accepted · 2026-09-25

## Bối cảnh
Người dùng là cán bộ y tế đăng nhập từ trình duyệt; quyết định duyệt/gửi văn bản có giá trị hành chính nên phiên phải an toàn. Sau này có thể tích hợp SSO của Sở Y tế (chưa biết).

## Quyết định
- Access token JWT ký **EdDSA (Ed25519)**, hiệu lực 15 phút; `identity` công bố JWKS, `gateway` xác minh cục bộ.
- Refresh token: chuỗi ngẫu nhiên 256-bit, **lưu hash**, **xoay vòng mỗi lần dùng**, phát hiện dùng lại → thu hồi cả chuỗi. Gửi qua cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
- Frontend giữ access token **chỉ trong bộ nhớ**; tải lại trang → gọi `/auth/refresh`.
- Mật khẩu băm Argon2id. Token dịch vụ riêng (audience theo service, 5 phút) cho lời gọi nội bộ.
- Dashboard và API **cùng origin** qua reverse proxy → không cần CORS.

## Phương án đã cân nhắc
- **Token trong localStorage:** dễ, nhưng XSS đọc được — không chấp nhận với dữ liệu y tế.
- **Session cookie phía server (không JWT):** đơn giản hơn nhưng gateway phải tra state mỗi request; JWT cho phép xác minh cục bộ.
- **RS256:** phổ biến hơn nhưng khoá lớn, chữ ký chậm hơn; EdDSA đủ hỗ trợ ở thư viện Go/JS.
- **OIDC/SSO ngay:** chưa có đối tác — để mở (docs/09 Q1).

## Hệ quả
- (+) Ăn cắp access token chỉ có hiệu lực 15 phút; refresh bị đánh cắp bị phát hiện khi dùng lại.
- (−) Thu hồi access token tức thì không có (chỉ chờ hết hạn) — chấp nhận với TTL ngắn; vai trò `admin` khoá tài khoản chặn refresh.
