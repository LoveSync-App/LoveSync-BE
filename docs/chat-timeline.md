# Chat timeline API

Chat được biểu diễn dưới dạng timeline chung. Mỗi item có `type` và `payload`,
nhờ đó tin nhắn, cuộc gọi và vị trí có thể hiển thị trong cùng một danh sách.

## Tải trang tin nhắn

Tải trang đầu tiên:

```http
GET /chat?limit=20
Authorization: Bearer <jwt>
```

Khi người dùng kéo lên đầu danh sách, truyền `nextCursor` của response trước:

```http
GET /chat?limit=20&cursor=6863...
Authorization: Bearer <jwt>
```

Response:

```json
{
  "items": [
    {
      "_id": "...",
      "sender": "...",
      "type": "TEXT",
      "content": "Xin chào",
      "payload": {},
      "attachments": [],
      "createdAt": "2026-07-01T10:30:00.000Z"
    }
  ],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "..."
  }
}
```

`items` được trả từ mới đến cũ. Client có thể đảo trang vừa nhận rồi chèn vào
đầu danh sách đang hiển thị. Dừng tải thêm khi `hasMore` là `false`.

## Item cuộc gọi

Cuộc gọi được tạo một lần với `type: "CALL"`. Cùng item đó được cập nhật khi
trạng thái cuộc gọi thay đổi:

```json
{
  "_id": "...",
  "type": "CALL",
  "entityId": "<callId>",
  "sender": "<callerId>",
  "content": "",
  "payload": {
    "callId": "...",
    "callType": "audio",
    "status": "ended",
    "result": "completed",
    "callerId": "...",
    "calleeId": "...",
    "durationSeconds": 125,
    "answeredAt": "2026-07-01T10:30:10.000Z",
    "endedAt": "2026-07-01T10:32:15.000Z"
  },
  "attachments": []
}
```

Giá trị `result`:

- `ringing` hoặc `ongoing`: cuộc gọi chưa kết thúc.
- `completed`: cuộc gọi đã được nhận và kết thúc.
- `missed`: cuộc gọi nhỡ.
- `rejected`: người nhận từ chối.
- `canceled`: người gọi hủy trước khi được nhận.

## Realtime

Kết nối Socket.IO namespace `/chat`. Client cần xử lý:

- `message:new`: chèn item mới vào cuối timeline.
- `message:updated`: thay item có cùng `_id`; dùng khi trạng thái cuộc gọi thay
  đổi.

## Mở rộng chia sẻ vị trí

Schema đã hỗ trợ `type: "LOCATION"` và `payload` linh hoạt. Khi triển khai API
gửi vị trí, item có thể sử dụng cấu trúc:

```json
{
  "type": "LOCATION",
  "payload": {
    "latitude": 10.7769,
    "longitude": 106.7009,
    "address": "Quận 1, TP.HCM",
    "expiresAt": null
  }
}
```

Cursor pagination và Socket.IO không cần thay đổi khi thêm loại item mới.
