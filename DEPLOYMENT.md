# Triển khai thực tế

1. Cài Docker và Docker Compose trên VPS Ubuntu.
2. Sao chép `.env.deploy.example` thành `.env`, thay mật khẩu, JWT và tên miền.
3. Trỏ DNS tên miền về IP VPS, sau đó chạy `docker compose up -d --build`.
4. Đặt Cloudflare Proxy hoặc Caddy phía trước cổng 80 để cấp HTTPS tự động.
5. Chạy migration trong container: `docker compose exec backend npm run migrate:production`.
6. Sao lưu hằng ngày bằng cron gọi `sqlcmd` với file `backend/scripts/backupDatabase.sql`, rồi đồng bộ thư mục `backups` và volume ảnh lên dịch vụ cloud.

Không đưa file `.env`, mật khẩu SQL hoặc JWT lên GitHub.
