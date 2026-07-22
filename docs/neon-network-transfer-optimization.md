# Tối ưu Network Transfer / DB Reads (Neon)

Ghi chú gửi team BE + các thay đổi đã làm ở FE để giảm **Data transfer (egress)** và **Compute time** trên Neon.

## Bối cảnh

Neon tính chi phí/giới hạn theo 3 trục: **Compute hours**, **Data transfer (egress)**, **Storage**.
Vấn đề hiện tại là đọc dữ liệu quá nhiều → tăng cả transfer lẫn compute. FE không nối trực tiếp Neon
(đi qua BE), nên gốc rễ phải xử lý ở tầng **BE ↔ Neon**; FE chỉ giúp giảm **số lần** BE phải query.

---

## Phần BE cần làm (ưu tiên cao → thấp)

### 1. Bật connection pooling (quan trọng nhất)
- Dùng connection string có `-pooler` (PgBouncer của Neon), ví dụ:
  `...-pooler.<region>.aws.neon.tech`.
- Nếu mỗi request mở connection trực tiếp → Neon phải wake compute liên tục, tốn compute + transfer.
- Với .NET (Npgsql): giữ pooling bật, `Maximum Pool Size` hợp lý; tránh mở/đóng `NpgsqlConnection`
  thủ công ngoài scope DI.

### 2. Cấu hình autosuspend hợp lý
- Mỗi cold start Neon phải nạp lại → tốn compute. Nếu app poll đều đều nhưng thưa, cân nhắc:
  - Giảm tần suất poll để compute ngủ hẳn khi không dùng, HOẶC
  - Tăng autosuspend timeout nếu traffic đều.

### 3. Chỉ SELECT cột cần dùng
- Tránh `SELECT *` với bảng có cột lớn (JSON/text: payments, passengers, itinerary, stops...).
- Query cho **danh sách** trả DTO gọn (id, code, status, ngày, tổng tiền...); dữ liệu đầy đủ chỉ trả
  ở **endpoint chi tiết**.

### 4. Bỏ N+1 query
- Màn admin charter trước đây FE kéo list rồi hydrate từng booking (1 round-trip/booking).
  → FE đã bỏ (xem phần dưới). BE nên gộp bằng `JOIN`/`IN (...)` nếu cần trả kèm boats.

### 5. Phân trang ở DB, không cắt ở app
- Dùng `LIMIT/OFFSET` hoặc keyset pagination. Đừng `SELECT` cả bảng rồi `.Skip().Take()` sau khi
  đã đọc hết row từ Neon.

### 6. Index cho cột lọc hay dùng
- `status`, `departureDate`, `boatId`, `sourceBookingId`... để tránh full table scan.
- Kiểm tra bằng `EXPLAIN (ANALYZE, BUFFERS)` các query nặng.

### 7. Nén + cache response
- Bật gzip/brotli cho API response (đặc biệt list/detail JSON lớn).
- ETag/`304 Not Modified` cho dữ liệu ít đổi; cân nhắc Redis cache cho catalog (boats, stations, routes).

### 8. Realtime thay cho polling
- Ưu tiên đẩy qua SignalR (đã có hub) thay vì client poll; poll chỉ khi bắt buộc và với interval thưa.

---

## Cách đo để tìm điểm tốn

- **Neon Console → Monitoring**: xem *Data transfer* và *Compute time* theo thời gian.
- Bật `pg_stat_statements` để tìm query đọc nhiều row / gọi nhiều lần nhất:
  ```sql
  SELECT query, calls, rows, total_exec_time
  FROM pg_stat_statements
  ORDER BY rows DESC
  LIMIT 20;
  ```

---

## Phần FE đã làm (trong PR/commit này)

1. **Charter detail — bỏ kéo full list cho gate tạo trip**
   (`src/pages/Admin/CharterBookingManagement/Detail.jsx`)
   - Xóa effect `loadGateBookings` (kéo full list để pre-check trùng giờ khi tạo trip).
   - Trùng lịch khi tạo trip / chốt giá **do BE validate**; FE hiện message lỗi
     (`isCharterBoatScheduleConflictError`).

2. **Dropdown chốt giá vẫn ẩn tàu đã giữ (gọn UX, nhẹ hơn trước)**
   - Giữ soft-filter `occupiedBoatIds` để dropdown không hiện tàu đã bận cùng ngày.
   - Gom vào `fetchOccupiedBoatIdsForCharterDate` (`charterBookingService.js`):
     - Cache TTL 2 phút + dedupe in-flight.
     - Chỉ hydrate detail các booking **cùng ngày** đang holding mà list thiếu `selectedBoats`
       (không hydrate cả list).
     - Invalidate cache sau khi chốt giá thành công.
   - **Khuyến nghị BE:** thêm `GET /charter-bookings/admin/occupied-boats?date=YYYY-MM-DD`
     trả `{ boatIds: [] }` để bỏ hẳn list+hydrate.

3. **Cache danh sách tàu Active** (`src/services/boatService.js`)
   - `fetchActiveBoatsByServiceType` có cache TTL 5 phút + dedupe request đang bay.
   - `invalidateActiveBoatsCache()` được gọi sau create/update/updateStatus/delete tàu.

4. **Debounce hub refresh** (`src/hooks/useCharterBookingDetailHub.js`)
   - Tăng debounce 100ms → 500ms để 1 loạt event chỉ refetch chi tiết 1 lần.

### Gợi ý FE tiếp theo (nếu cần)
- Cache stations/routes tương tự boats (dữ liệu catalog ít đổi).
- Rà soát các màn live-tracking/operations: kiểm tra interval poll, dừng poll khi tab `hidden`
  (`document.visibilityState`).
- Thay occupied-boats soft-filter bằng endpoint BE nhẹ khi BE sẵn sàng.
