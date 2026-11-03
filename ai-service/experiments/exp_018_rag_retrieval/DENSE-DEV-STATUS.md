# Dense dev: lượt GTE bị dừng

Lượt GTE dev chưa hoàn tất và **chưa có Recall@5, MRR hay Noise@5 hợp lệ**. Watchdog gửi SIGTERM sau ba mẫu memory pressure mức 2 liên tiếp; swap ghi nhận 6435,75 MiB không đổi trong các mẫu. RSS tiến trình cao nhất được watchdog quan sát là 1.791.574.016 bytes. Đây là số lấy mẫu, không phải peak RSS được tiến trình báo khi kết thúc bình thường.

Lượt đã ghi 53 bản ghi input vào checkpoint một phần; vector cache nằm ngoài Git. [Log cấu hình và lần dừng](dense-gte-dev-v0.1.json) ghi revision, 53 bản ghi và các mẫu tài nguyên. Không suy ra rằng runner gây áp lực hệ thống, hoặc rằng máy không thể chạy benchmark. BGE dev, hybrid và eval chưa chạy.

Chỉ resume khi memory pressure trở lại bình thường và ổn định; giữ nguyên watchdog và cấu hình. Dùng output và partial path mới, không ghi đè lần dừng; cache chỉ được tái sử dụng nếu fingerprint khớp. Báo thời gian lượt mới và số cache hit riêng.
