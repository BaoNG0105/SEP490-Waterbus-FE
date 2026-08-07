# Câu hỏi checklist cho Mobile - Check-in/Checkout & Incident Management

## 1. CHECK-IN / CHECK-OUT

### 1.1. Quét QR
- [ ] Đã quét được mã QR ticket?
- [ ] Parse được ticketCode từ QR?

### 1.2. Gọi API scan
- [ ] Gọi API `POST /ticket-scan` được chưa?
- [ ] Response trả về có những field nào?
  - `canCheckIn` / `canCheckOut`
  - `blockedReason`
  - `status`
  - `passengerName`, `passengerPhone`
  - `tripCode`, `departureDate`
  - `fromStation`, `toStation`
  - `boatName`, `boatCode`

### 1.3. UI Status
- [ ] Hiển thị "Sẵn sàng check-in" khi `canCheckIn = true`?
- [ ] Hiển thị "Đã check-in" khi `canCheckOut = true`?
- [ ] Hiện `blockedReason` khi nút bị disable?

### 1.4. Thao tác Check-in/Check-out
- [ ] Gọi được API `POST /check-in`?
- [ ] Gọi được API `POST /check-out`?
- [ ] Cập nhật UI sau khi thao tác thành công?

---

## 2. INCIDENT MANAGEMENT

### 2.1. Lấy danh sách sự cố
- [ ] Gọi được API `GET /incidents?resolutionStatus=Open`?
- [ ] Hiển thị danh sách sự cố đang mở?

### 2.2. Tạo sự cố mới
- [ ] Form tạo sự cố hoạt động?
- [ ] Gọi được API `POST /incidents`?

### 2.3. Gán Manager
- [ ] Chọn và gán manager cho sự cố?
- [ ] Gọi được API `PUT /incidents/{id}/manager`?

### 2.4. Gán tàu cứu hộ
- [ ] Chọn tàu cứu hộ?
- [ ] Gọi được API `PUT /incidents/{id}/rescue-boat`?

### 2.5. Gán tàu thay thế
- [ ] Chọn tàu thay thế?
- [ ] Chọn loại mission (TransferAtIncidentLocation / ContinueFromStation)?
- [ ] Gọi được API `PUT /incidents/{id}/replacement-boat`?

### 2.6. Đóng sự cố
- [ ] Modal đóng sự cố hoạt động?
- [ ] Chọn được `boatStatus` và `tripStatus`?
- [ ] Gọi được API `PUT /incidents/{id}/resolve`?

---

## 3. CÁC VẤN ĐỀ GẶP PHẢI

### 3.1. API
- [ ] Endpoint nào chưa có? (404)
- [ ] Response format có đúng không?
- [ ] Thiếu field nào từ BE?

### 3.2. Logic
- [ ] Logic `canCheckIn`/`canCheckOut` đúng chưa?
- [ ] Logic tính số khách trên tàu có đúng?
- [ ] Xử lý case `replacementMissionType` nào chưa?

### 3.3. UI/UX
- [ ] Mockup có khớp với app thực tế không?
- [ ] Cần thêm/sửa field nào không?

---

## 4. NEXT STEPS

- [x] Đã họp với BE và confirm các endpoint (xem chi tiết ở Section 5)
- [ ] Cần mock data để test UI trước?
- [ ] Cần FE hỗ trợ gì thêm?

---

## 5. LIVE TRACKING (Theo dõi chuyến/tàu) — ENDPOINTS MOBILE

### 5.1. Danh sách chuyến của Staff trong ngày

```
GET /staff/me/trips?date=YYYY-MM-DD
Header: Authorization: Bearer {jwt}
```

**Mục đích:** Mobile load "Chuyến của tôi" theo ngày.

**Response cần có (chuẩn hóa tối thiểu):**
- `tripId`, `tripCode`, `routeName`
- `fromStationName`, `toStationName`
- `stops[]` (bến trung gian, có thể rỗng)
- `boatId`, `boatCode`, `boatName`
- `departureTime`, `arrivalTime` (ISO +07:00)
- `status` (Scheduled, Boarding, InProgress, Delayed, Completed, Cancelled)

**⚠️ Lưu ý:** BE trả PascalCase. Mobile cần map về camelCase.

---

### 5.2. Chi tiết 1 chuyến

```
GET /trips/{tripId}
Header: Authorization: Bearer {jwt}
```

**Response cần có (ngoài các field ở 5.1):**
- `stops[]` (có `actualArrival`, `actualDeparture`, `stopOrder`)
- `delayInfo` (`isDelayActive`, `delayStartedAt`, `delayMinutes`, `reason`, `stationName`, `startStopOrder`)
- `ticketCount`, `checkedInCount`, `onboardPassengerCount`
- `crew[]` (staff on board)
- `route` (`routeId`, `routeName`, `polyline`, `waypoints[]`)

---

### 5.3. ⭐ LIVE GPS theo chuyến

```
GET /tracking/trips/{tripId}/latest
Header: Authorization: Bearer {jwt}
```

**Mục đích:** Mobile poll GPS realtime theo chuyến (5-15s/lần).

**Response shape:**
```json
{
  "tripId": "...",
  "tripCode": "...",
  "boat": { "boatId": "...", "boatCode": "...", "boatName": "..." },
  "latestLocation": {
    "lat": 10.762,
    "lng": 106.704,
    "speed": 12.5,
    "heading": 45,
    "recordedAt": "2026-08-11T08:32:00+07:00",
    "source": "GPS",
    "stale": false,
    "dwellCountdown": {
      "startedAt": "...",
      "endsAt": "...",
      "remainingSeconds": 180,
      "remainingMinutes": 3,
      "stayDurationMinutes": 5,
      "isOverdue": false
    }
  },
  "hasLiveLocationForTrip": true
}
```

**Field semantics:**
- `hasLiveLocationForTrip = true` → GPS đúng chuyến hiện tại
- `hasLiveLocationForTrip = false` → có GPS nhưng không khớp trip
- `latestLocation = null` → tàu chưa gửi GPS
- `isGpsOnline = false` nếu GPS cũ hơn 60s (do BE set)
- `stale = true` khi tàu không online

**⚠️ BE confirm:** Dwell countdown BE trả sẵn → Mobile không cần tính tay.

---

### 5.4. ⭐ LIVE GPS theo tàu

```
GET /tracking/boats/{boatCode}/latest
GET /tracking/boats/latest
Header: Authorization: Bearer {jwt}
```

**Mục đích:** Mobile theo dõi 1 tàu hoặc tất cả tàu (không gắn trip).

**Response shape (mỗi boat):**
```json
{
  "boatId": "...",
  "boatCode": "WB-01",
  "boatName": "Bạch Đằng 1",
  "status": "Active",
  "lat": 10.762,
  "lng": 106.704,
  "speed": 12.5,
  "heading": 45,
  "recordedAt": "2026-08-11T08:32:00+07:00",
  "isGpsOnline": true,
  "currentTripId": "..." // optional: trip đang chạy
}
```

**⚠️ Lưu ý:** BE KHÔNG ẩn tàu sau 12h. Mobile tự quyết định có hiển thị hay không (FE policy).

---

### 5.5. Start / Resume Delay

```
POST /trips/{tripId}/delay/start
POST /trips/{tripId}/delay/resume
Header: Authorization: Bearer {jwt}
Content-Type: application/json
```

**Body start:**
```json
{
  "reason": "Tàu đang dừng tại bến Bạch Đằng",
  "startStopOrder": 2
}
```

**Body resume:**
```json
{
  "note": "Tàu tiếp tục hành trình"
}
```

**Mục đích:** Staff báo cáo delay từ mobile.

---

### 5.6. SignalR Realtime (optional, thay polling)

```
WSS /hubs/tracking?access_token={jwt}
```

**Events cần subscribe:**
- `boatLocationUpdated` (`{ boatId, lat, lng, speed, heading, recordedAt, tripId }`)
- `tripDelayUpdated` (`{ tripId, delayInfo, affectedTrips[] }`)
- `incidentCreated`, `incidentResolved`

**Methods BE cung cấp:**
- `joinBoat(boatId)` — subscribe boat cụ thể
- `joinTrip(tripId)` — subscribe trip cụ thể

**⚠️ Câu hỏi BE cần confirm:**
- [ ] Mobile có CORS/wss mở cho app không?
- [ ] access_token truyền qua query string đúng không?
- [ ] joinBoat có authz check (staff phải assigned tàu đó)?
- [ ] Có event mới nào mobile cần thêm không?

---

### 5.7. Authentication & Permission

**Câu hỏi BE cần confirm:**
- [ ] Mobile STAFF dùng chung role STAFF hay cần role riêng?
- [ ] Có cần permission mới "MobileStaff" không?
- [ ] `/staff/me/trips` có filter server-side theo quyền staff không?
- [ ] `/tracking/trips/{id}/latest` có cần staff là crew của trip đó không?
- [ ] `/tracking/boats/{code}/latest` có cần staff assigned tàu đó không?

**Response khi fail:**
- Không login → 401
- Không có quyền → 403 rõ ràng

---

### 5.8. Cases cần BE confirm

| Case | Expected response |
|------|-------------------|
| Staff chưa có ca trong ngày | `/staff/me/trips` trả `[]` hay 404? |
| Trip đã Completed/Cancelled | `/tracking/trips/{id}/latest` trả 200 với null hay 404? |
| Tàu chưa gửi GPS | `latestLocation = null`, `hasLiveLocationForTrip = false` đúng không? |
| Staff rời ca mà vẫn poll | 403 hay 200? |
| Network offline khi resume delay | Retry hay fail? |

---

### 5.9. Rate Limit / Polling

**Câu hỏi BE:**
- [ ] `/tracking/*` có rate limit không?
- [ ] Mobile poll 5-10s/lần có ảnh hưởng BE không?
- [ ] Có khuyến nghị interval tối thiểu không?
- [ ] Có nên dùng SignalR thay polling?

---

### 5.10. Sample Call Flow (Mobile)

```
1. Login → JWT token (role STAFF)

2. Mở app →
   GET /staff/me/trips?date={today}
   → Hiển thị danh sách chuyến hôm nay

3. Click vào chuyến →
   GET /trips/{tripId}
   → Hiển thị chi tiết (stops, route, delay info, crew)

4. Bật chế độ "Theo dõi" →
   GET /tracking/trips/{tripId}/latest
   → Poll mỗi 10s
   → Cập nhật vị trí tàu trên map

5. (Optional) Realtime →
   WSS /hubs/tracking?access_token={jwt}
   trackingHub.joinBoat(boatId)
   trackingHub.joinTrip(tripId)
   → Subscribe boatLocationUpdated
   → Cập nhật ngay khi có event (không cần poll)

6. Staff báo delay →
   POST /trips/{tripId}/delay/start { reason, startStopOrder }
   → Trip status = Delayed
   → UI hiển thị "Đang delay"
```

---

## 6. STATUS ENUM ĐÃ CONFIRM VỚI BE

| Enum | Values |
|------|--------|
| **BoatStatus** | Active, UnderMaintenance, Inactive, Retired, Incident |
| **BoatServiceType** | Passenger, Rescue |
| **TripStatus** | Scheduled, Boarding, InProgress, Completed, Cancelled, Delayed |
| **TicketStatus** | Active, CheckedIn, Cancelled, Expired, CheckedOut |
| **BookingStatus** | PendingPayment, Confirmed, Cancelled, Expired, Refunded, Quoted, Completed, PendingQuote |
| **TripStopStatus** | Scheduled, Arriving, Arrived, Departed, Skipped |
| **ReplacementMissionType** | None, TransferAtIncidentLocation, ContinueFromStation, PassengerRecoveryRequired |
| **Severity** | (string, max 30) — convention: Low, Medium, High, Critical |
| **IncidentType** | (string, max 50) — convention: MechanicalFailure, Collision, MedicalEmergency, Weather, Other |

**⚠️ Lưu ý:** BE trả PascalCase. Mobile cần map sang camelCase khi parse.

---

## 7. RULES NGẦM BE

| Rule | Chi tiết |
|------|----------|
| Booking hold | `holdExpiresAt = min(now + 15p, fromStopDeparture - 10p)` |
| Khóa chặng 10p | BE enforce theo `fromStopDeparture - 10p`; DTO có `isBookable`/`isBookingClosed` |
| Create trip lead | 20p hardcoded (`MinimumCreationLeadTime = 20m`) |
| Delay propagation | BE tự tính theo `adjustedArrival + 15p`; không có rule `>=15p` cố định |
| Charter quote hold | 2h (Quoted) → 12h (PendingPayment); auto-expire job mỗi 60s |
| Dwell countdown | BE trả sẵn trong operation schedule (`startedAt, endsAt, remainingSeconds, remainingMinutes, stayDurationMinutes, isOverdue`) |
| Sticky GPS | BE không ẩn tàu sau 12h; `isGpsOnline=false` nếu GPS cũ hơn 60s. Sticky 12h là FE policy |
| Charter deadline 24h | BE không cho update/import/add passenger trong 24h trước giờ khởi hành |

---

## 8. RESOLVE INCIDENT — FLOW XÁC NHẬN

### BoatStatus UnderMaintenance + có replacement:
- → Trip → `Delayed`

### BoatStatus UnderMaintenance + KHÔNG có replacement:
- → Trip → `Cancelled`

**⚠️ Future trips KHÔNG bị auto-cancel/remove.** BE chỉ xử lý trip hiện tại.

**⚠️ Resolve incident trả `IncidentDto` (không có countdown).** Mobile phải refetch `/api/boats/{boatId}` để lấy `estimatedMaintenanceEndAt`.

### Maintenance auto-Active (khi upload Inspection):
- Điều kiện: Boat `Inactive` hoặc `UnderMaintenance` + Passenger setup đủ ghế + đủ 4 docs + Inspection mới upload **sau** `maintenanceStartedAt`
- → BE auto-clear `estimatedMaintenanceEndAt` + `maintenanceNote` → set Active
