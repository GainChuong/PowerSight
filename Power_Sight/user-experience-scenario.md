# Kịch bản Trải nghiệm Người dùng: Xử lý Báo cáo Tài chính

## Goal
Kịch bản hướng dẫn người dùng trải nghiệm thực tế luồng làm việc an toàn trên PowerSight (thời lượng dự kiến: 10 phút), bao gồm nhận task, làm việc trên app ngoài (Gmail, Sheets), xem KPI và tương tác AI.

## Tasks

- [ ] Task 1: Đăng nhập & Kiểm tra Lịch trình (1 phút)
  - **Hành động:** Người dùng đăng nhập vào hệ thống (EM001). Truy cập tab **Lịch làm việc (Calendar)**.
  - **Verify:** Thấy nhiệm vụ được giao trong ngày hôm nay: *"Xử lý sheet báo cáo kết quả hoạt động kinh doanh từ phòng Tài chính"*.

- [ ] Task 2: Kích hoạt Giám sát & Bắt đầu làm việc (1 phút)
  - **Hành động:** Quay lại tab **Time Tracker** hoặc nhấn thẳng vào nút **Bắt đầu làm việc**.
  - **Verify:** Thanh tracking bar trên cùng chuyển sang màu xanh (Đang hoạt động), thời gian bắt đầu đếm, màn hình tự động chuyển sang Fullscreen. 

- [ ] Task 3: Tiếp nhận & Xử lý File Báo cáo (4 phút)
  - **Hành động:**
    - Mở ứng dụng **Gmail** từ thanh điều hướng (Sidebar hoặc Dropdown).
    - Mở email tự động gửi báo cáo kết quả kinh doanh bằng file sheet.
    - Mở file qua **Google Sheets (Google Drive)**, thực hiện vài thao tác cơ bản (tính tổng, đổi màu, format data).
    - Quay lại Gmail, soạn một email phản hồi báo cáo đã hoàn chỉnh và nhấn Gửi.
  - **Verify:** Luồng làm việc qua tab mới diễn ra mượt mà, không bị cảnh báo vi phạm. Timer vẫn tiếp tục đếm.

- [ ] Task 4: Đánh giá Hiệu suất trên Dashboard (2 phút)
  - **Hành động:** Chuyển về tab chính của hệ thống, chọn mục **Dashboard KPI**.
  - **Hành động:** Thay đổi Filter thời gian: Chọn từ **Tháng 1** đến **Tháng hiện tại** của năm nay.
  - **Verify:** Biểu đồ (Orders, Working Hours, Fraud Events) và các chỉ số (Completion Rate, Total Profit) cập nhật lại đúng với dữ liệu được filter. Quan sát được các nhận xét và chỉ số cụ thể.

- [ ] Task 5: Tham vấn cùng AI Chatbot (2 phút)
  - **Hành động:** Chuyển sang tab **Chatbot**. Nhập lần lượt 3 câu hỏi sau:
    1. *"Bạn hãy đánh giá hiệu suất làm việc của tôi từ đầu năm tới nay"*
    2. *"Tôi đã vi phạm bao nhiêu lần ngày hôm nay và những lỗi gì"*
    3. *"Làm sao để tối ưu và giảm sai sót khi xử lý báo cáo?"*
  - **Verify:** Chatbot phản hồi đúng thông tin dựa vào dữ liệu KPI và log hệ thống, đồng thời đưa ra được lời khuyên tối ưu công việc hữu ích.

## Done When
- [ ] Người dùng hoàn tất toàn bộ quy trình mà không gặp lỗi kỹ thuật hay lỗi crash app.
- [ ] Extension theo dõi thời gian và trạng thái đúng như kì vọng trong suốt 10 phút trải nghiệm.
- [ ] Các tính năng cốt lõi (Giám sát, URL check, Dashboard filter, Chatbot ngữ cảnh) đều được phô diễn thành công.

## Notes
- **Face Verification:** Hệ thống có thể ngẫu nhiên yêu cầu quét khuôn mặt trong 10 phút này. Người dùng cần chuẩn bị sẵn sàng camera để minh họa tính năng bảo mật liên tục.
- Đảm bảo trong Data/Calendar của ngày hôm nay đã được mock sẵn task báo cáo này để người dùng có thể thấy ngay khi vào.
