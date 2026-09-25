"""Hạ tầng dùng chung cho mọi API Python: cấu hình, log JSON, lỗi problem+json, health, middleware.

Cố ý phản chiếu `backend/pkg/*` của phía Go (cùng trường log, cùng hình dạng lỗi, cùng luật request-id)
để hai runtime cho ra log/lỗi đồng nhất — gỡ lỗi xuyên service không phải dịch qua lại.
"""
