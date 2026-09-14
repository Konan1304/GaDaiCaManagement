# Bộ ảnh Chương 3

Các ảnh dưới đây được tạo và kiểm tra theo mã nguồn hiện tại của hệ thống Gà Đại Ca.

| Số hình | Tệp ảnh | Nội dung/nguồn |
|---|---|---|
| Hình 3.7 | `Hinh_3_7_ERD_SQL_Server_FINAL.png` | Sơ đồ 8 bảng theo bố cục SQL Server Database Diagram, gồm users, admin_audit_logs, employees, branches, positions, shifts, employee_schedules và payrolls. |
| Hình 3.8 | `Hinh_3_8_Database_Van_hanh_ca.png` | Sơ đồ dữ liệu mở/đóng ca, báo cáo doanh thu, kiểm tiền, chi phí, bàn giao và tệp minh chứng. |
| Hình 3.9 | `Hinh_3_9_Database_Kho_Nha_cung_cap.png` | Sơ đồ dữ liệu sản phẩm, tồn kho, nhập/xuất, đơn đặt hàng, nhà cung cấp và kiểm kho theo ca. |
| Hình 3.10 | `Hinh_3_10_Database_Chat_Thong_bao_Cai_dat.png` | Sơ đồ dữ liệu chat, thành viên, tệp đính kèm, thông báo, cấu hình và nhật ký quản trị. |
| Hình 3.11 | `Hinh_3_11_Sequence_Dang_nhap.png` | UML Sequence Diagram chức năng đăng nhập giữa Người dùng, ReactJS, Node.js/ExpressJS và Microsoft SQL Server. |
| Hình 3.12 | `Hinh_3_12_Trang_Tong_quan_Admin.png` | Ảnh chụp giao diện thật của trang Tổng quan Admin; chọn dữ liệu ngày 25/08/2026. |
| Hình 3.13 | `Hinh_3_13_Trang_chu_Nhan_vien.png` | Ảnh chụp giao diện thật của trang chủ Nhân viên và các tiện ích được phân quyền. |
| Hình 3.14 | `Hinh_3_14_So_do_dieu_huong_theo_vai_tro.png` | Sơ đồ điều hướng sau đăng nhập theo đúng hai vai trò Admin và Nhân viên; các màn hình được phân nhánh theo nhóm chức năng và không biểu diễn luồng truy cập tuần tự. |

## Cách chèn vào báo cáo

- Với Hình 3.7–3.10, nên đặt trang Word nằm ngang (Landscape), ảnh rộng khoảng 23–24 cm và chọn **Keep with next** cho dòng dẫn hình.
- Với Hình 3.12–3.13, có thể đặt trên trang dọc, ảnh rộng khoảng 16 cm.
- Với Hình 3.14, nên dùng trang nằm ngang (Landscape), căn giữa và đặt ảnh rộng khoảng 23–24 cm.
- Dòng chú thích đặt dưới ảnh, căn giữa, ví dụ: **Hình 3.7. Cơ sở dữ liệu nhân viên, lịch làm việc, chấm công và lương**.
- Phần nguồn có thể ghi: **Nguồn: Tác giả tổng hợp từ cơ sở dữ liệu và giao diện hệ thống Gà Đại Ca**.

## Đoạn dẫn gợi ý

“Để làm rõ thiết kế dữ liệu, hệ thống được chia thành các nhóm bảng theo từng nghiệp vụ. Các khóa chính (PK), khóa ngoại (FK) và quan hệ N–1 thể hiện cách dữ liệu được liên kết, bảo đảm tính nhất quán giữa nhân sự, vận hành ca, kho hàng và các chức năng hỗ trợ.”

“Giao diện Tổng quan Admin trình bày các chỉ số vận hành quan trọng theo ngày và chi nhánh, trong khi trang chủ Nhân viên chỉ hiển thị các chức năng phù hợp với quyền sử dụng của nhân viên.”
