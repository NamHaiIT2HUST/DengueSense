"""Lớp phục vụ (serving) của các service AI: API, job, hạ tầng dùng chung.

Logic ML KHÔNG nằm ở đây — `app.serving` chỉ gọi `app.forecast` / `app.data` (đã có test riêng); ngược lại
`app.forecast` không được import `app.serving` (kiểm bằng import-linter, xem `.importlinter`). docs/09 §10.4.
"""
