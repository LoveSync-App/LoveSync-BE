# API chia sẻ vị trí và trạng thái online

Tính năng có hai chế độ độc lập:

1. Gửi một vị trí cố định vào khung chat.
2. Bật chia sẻ trực tiếp để partner theo dõi vị trí mới nhất trên bản đồ.

Tất cả REST API và kết nối Socket.IO yêu cầu JWT của ứng dụng.

## 1. Gửi vị trí cố định qua tin nhắn

```http
POST /chat/location
Authorization: Bearer <jwt>
Content-Type: application/json
```

```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracy": 8,
  "address": "Quận 1, TP.HCM",
  "label": "Vị trí hiện tại",
  "capturedAt": "2026-07-01T10:30:00.000Z"
}
```

Response là một chat timeline item có `type: "LOCATION"` và
`payload.mode: "snapshot"`. Đây là vị trí cố định trong lịch sử chat. Partner
nhận item qua event `message:new` của namespace `/chat`.

## 2. Chia sẻ vị trí trực tiếp

### Bắt đầu

```http
POST /locations/live/start
Authorization: Bearer <jwt>
Content-Type: application/json
```

```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracy": 8,
  "heading": 120,
  "speed": 1.2,
  "address": "Quận 1, TP.HCM",
  "untilStopped": false,
  "durationMinutes": 60
}
```

`durationMinutes` mặc định là 60 và tối đa 1440 phút.

Để chia sẻ cho đến khi người dùng chủ động tắt, gửi:

```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "untilStopped": true
}
```

Khi `untilStopped` là `true`, backend không đặt thời gian hết hạn,
`sharingExpiresAt` trả về `null`, và phiên chỉ kết thúc khi gọi
`POST /locations/live/stop` hoặc couple không còn `ACTIVE`.

### Cập nhật bằng Socket.IO

Kết nối namespace:

```js
const socket = io(`${API_URL}/locations`, {
  auth: { token: accessToken },
});
```

Khi thiết bị di chuyển đáng kể hoặc sau chu kỳ 5–15 giây, client emit:

```js
socket.emit(
  'location:update',
  {
    latitude: 10.7775,
    longitude: 106.7015,
    accuracy: 6,
    heading: 125,
    speed: 1.5,
    capturedAt: '2026-07-01T10:30:10.000Z',
  },
  (ack) => {
    // ack.ok === true khi vị trí đã được lưu và broadcast
  },
);
```

ACK thành công:

```json
{
  "ok": true,
  "location": {
    "userId": "...",
    "isSharing": true,
    "latitude": 10.7775,
    "longitude": 106.7015,
    "accuracy": 6,
    "heading": 125,
    "speed": 1.5,
    "capturedAt": "2026-07-01T10:30:10.000Z",
    "untilStopped": false,
    "sharingExpiresAt": "2026-07-01T11:30:00.000Z"
  }
}
```

ACK lỗi:

```json
{
  "ok": false,
  "code": "LIVE_SHARING_NOT_ACTIVE",
  "message": "Live location sharing is not active"
}
```

Các mã lỗi ACK khác:

- `VALIDATION_ERROR`: tọa độ hoặc payload không hợp lệ.
- `RATE_LIMITED`: cập nhật nhanh hơn giới hạn server; mặc định 1 giây/lần.
- `INVALID_LOCATION_TIMESTAMP`: `capturedAt` quá cũ, ở tương lai hoặc cũ hơn
  tọa độ mới nhất đã lưu.
- `LOCATION_UPDATE_FAILED`: lỗi lưu trữ hoặc lỗi server khác.

Khi nhận `location:update`, server phải thực hiện theo thứ tự:

1. Xác thực JWT và kiểm tra couple `ACTIVE`.
2. Kiểm tra phiên live của người gửi còn hiệu lực.
3. Validate tọa độ, thời gian và giới hạn tần suất cập nhật.
4. Ghi đè tọa độ live mới nhất trong storage, không lưu lịch sử hành trình.
5. Emit `location:updated` cho partner và các thiết bị khác của người gửi.
6. Trả ACK sau khi storage cập nhật thành công.

Client chỉ xem ACK là thành công sau bước lưu storage. Nếu socket chưa kết nối,
không hỗ trợ ACK hoặc timeout sau 5 giây, client fallback sang:

```http
PUT /locations/live
Authorization: Bearer <jwt>
Content-Type: application/json
```

Payload giống `location:update`.

### Dừng

```http
POST /locations/live/stop
Authorization: Bearer <jwt>
```

Server xóa tọa độ live mới nhất và emit `location:sharing-stopped`. Partner
không được đọc lại tọa độ cũ qua API live.

### Lấy trạng thái

```http
GET /locations/live/me
GET /locations/live/partner
Authorization: Bearer <jwt>
```

`partner` chỉ trả tọa độ khi couple vẫn `ACTIVE`, phiên đang bật và chưa hết
hạn.

### Server events

- `location:sharing-started`
- `location:updated`
- `location:sharing-stopped`
- `location:sharing-expired`
- `locations:ready`
- `locations:error`

## 3. Kiểm tra partner có online không

```http
GET /presence/partner
Authorization: Bearer <jwt>
```

Response:

```json
{
  "userId": "...",
  "isOnline": true,
  "connectedAt": "2026-07-02T03:20:00.000Z",
  "lastSeenAt": null
}
```

Khi offline:

```json
{
  "userId": "...",
  "isOnline": false,
  "connectedAt": null,
  "lastSeenAt": "2026-07-02T03:19:45.000Z"
}
```

`isOnline` phải được tính theo số kết nối Socket.IO đã xác thực của người dùng,
không phải trạng thái socket của người đang xem. Một người vẫn online nếu còn
ít nhất một thiết bị kết nối. Server chỉ đánh dấu offline sau thời gian grace
period ngắn, đề xuất 15–30 giây, để tránh nhấp nháy khi mạng chuyển đổi.

Màn hình chat đã kết nối namespace `/chat`, vì vậy server broadcast thêm event
sau trên namespace này để cập nhật giao diện mà không cần polling:

```text
presence:partner-updated
```

Payload:

```json
{
  "userId": "...",
  "isOnline": true,
  "connectedAt": "2026-07-02T03:20:00.000Z",
  "lastSeenAt": null
}
```

Khi socket `/chat` vừa kết nối, server nên gửi trạng thái hiện tại trong event:

```text
chat:ready
```

```json
{
  "partnerPresence": {
    "userId": "...",
    "isOnline": true,
    "connectedAt": "2026-07-02T03:20:00.000Z",
    "lastSeenAt": null
  }
}
```

API và event presence chỉ trả thông tin của partner trong couple `ACTIVE`.

## Quyền riêng tư

- Chỉ partner trong couple `ACTIVE` được đọc và nhận vị trí live.
- Client dừng hiển thị marker khi đến `sharingExpiresAt`; nếu
  `untilStopped: true` thì chờ event dừng hoặc người dùng chủ động tắt.
- Backend chỉ giữ tọa độ live mới nhất, không lưu hành trình.
- Snapshot trong chat là dữ liệu cố định và vẫn tồn tại trong lịch sử.
- `lastSeenAt` chỉ hiển thị cho partner đang thuộc couple `ACTIVE`.
