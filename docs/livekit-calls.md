# Cuộc gọi LiveKit

## Cấu hình

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_TOKEN_TTL_SECONDS=900
CALL_RING_TIMEOUT_SECONDS=60
```

Trong bảng điều khiển LiveKit, đăng ký URL Webhook sau:

```text
POST https://your-api.example.com/{API_PREFIX}/calls/webhooks/livekit
```

LiveKit sẽ ký xác thực cho Webhook này. Endpoint trên được thiết kế để **không sử dụng Application JWT Guard**. Thay vào đó, `WebhookReceiver` sẽ xác minh trường `Authorization` trong Header và nội dung thô của request.

## REST API

Tất cả endpoint, ngoại trừ Webhook, đều yêu cầu:

```http
Authorization: Bearer <jwt>
```

| Phương thức | Endpoint                                    | Mục đích                                                     |
| ----------- | ------------------------------------------- | ------------------------------------------------------------ |
| `POST`      | `/calls`                                    | Bắt đầu cuộc gọi với người yêu hiện tại của người dùng       |
| `POST`      | `/calls/video`                              | Bắt đầu cuộc gọi video mà không cần request body             |
| `GET`       | `/calls/active`                             | Lấy cuộc gọi hiện đang đổ chuông hoặc đang diễn ra           |
| `GET`       | `/calls/history?page=1&limit=20&type=video` | Lấy lịch sử cuộc gọi có phân trang và bộ lọc                 |
| `GET`       | `/calls/:callId`                            | Lấy thông tin một cuộc gọi                                   |
| `GET`       | `/calls/:callId/participants`               | Lấy danh sách người tham gia đang kết nối và các Media Track |
| `POST`      | `/calls/:callId/accept`                     | Người nhận chấp nhận cuộc gọi đang đổ chuông                 |
| `POST`      | `/calls/:callId/reject`                     | Người nhận từ chối cuộc gọi đang đổ chuông                   |
| `POST`      | `/calls/:callId/cancel`                     | Người gọi hủy cuộc gọi đang đổ chuông                        |
| `POST`      | `/calls/:callId/end`                        | Một trong hai người kết thúc cuộc gọi đang diễn ra           |
| `POST`      | `/calls/:callId/token`                      | Cấp token ngắn hạn để kết nối lại                            |

Request body khi tạo cuộc gọi:

```json
{
  "type": "audio"
}
```

Trường `type` chấp nhận hai giá trị:

* `audio`
* `video`

Giá trị mặc định là `audio`.

Phản hồi của API tạo cuộc gọi, chấp nhận cuộc gọi hoặc cấp token sẽ bao gồm thông tin kết nối:

```json
{
  "call": {
    "_id": "...",
    "caller": "...",
    "callee": "...",
    "roomName": "call_...",
    "type": "audio",
    "status": "ringing"
  },
  "livekit": {
    "serverUrl": "wss://your-project.livekit.cloud",
    "participantToken": "...",
    "media": {
      "audio": true,
      "video": true,
      "screenShare": true
    }
  }
}
```

Người gọi có thể kết nối vào phòng ngay sau khi gọi:

```http
POST /calls
```

Người nhận phải gọi API sau để chấp nhận cuộc gọi:

```http
POST /calls/:callId/accept
```

Sau đó, người nhận kết nối vào phòng bằng thông tin xác thực được trả về.

Người nhận không thể lấy Room Token khi cuộc gọi vẫn đang ở trạng thái `ringing` và chưa được chấp nhận.

Để tạo cuộc gọi video, có thể sử dụng một trong hai cách:

Gửi request sau đến `POST /calls`:

```json
{
  "type": "video"
}
```

Hoặc gọi trực tiếp:

```http
POST /calls/video
```

Token được tạo cho cuộc gọi video cho phép sử dụng:

* Microphone.
* Camera.
* Chia sẻ màn hình dạng video.
* Chia sẻ âm thanh từ màn hình.

Token của cuộc gọi âm thanh chỉ cho phép sử dụng Microphone.

Sau khi kết nối bằng LiveKit Client SDK, ứng dụng phía client cần tự publish các Local Track:

```js
await room.connect(serverUrl, participantToken);
await room.localParticipant.setMicrophoneEnabled(true);
await room.localParticipant.setCameraEnabled(true);

// Chia sẻ màn hình nếu cần
await room.localParticipant.setScreenShareEnabled(true);
```

Các chức năng sau thuộc trách nhiệm của ứng dụng phía client:

* Chuyển đổi camera trước và sau.
* Bật hoặc tắt Microphone.
* Hiển thị video của người tham gia từ xa.
* Yêu cầu quyền truy cập Microphone và Camera trên thiết bị.

Sau khi kết nối lại, có thể sử dụng endpoint sau để lấy danh sách người tham gia hiện tại cùng các Track Microphone, Camera hoặc chia sẻ màn hình của họ:

```http
GET /calls/:callId/participants
```

## Báo hiệu bằng Socket.IO

Kết nối đến namespace `/calls` bằng Application JWT:

```js
io(`${API_URL}/calls`, {
  auth: { token: accessToken },
});
```

Các sự kiện do máy chủ gửi:

* `call:incoming`
* `call:ringing`
* `call:accepted`
* `call:rejected`
* `call:canceled`
* `call:missed`
* `call:ended`
* `call:media-updated`
* `calls:ready`
* `calls:error`

Socket.IO chỉ được sử dụng để **báo hiệu trạng thái cuộc gọi**.

Các luồng âm thanh và video được truyền trực tiếp thông qua LiveKit, không truyền qua Socket.IO của backend.

Backend cũng gửi một FCM Data Payload có loại `incoming_call` đến người nhận khi người nhận đã đăng ký Device Token.

Sự kiện `call:media-updated` được phát khi LiveKit báo cáo rằng một Track Microphone, Camera hoặc chia sẻ màn hình đã được publish hoặc unpublish:

```json
{
  "callId": "...",
  "participantId": "...",
  "action": "published",
  "track": {
    "sid": "TR_...",
    "kind": "video",
    "source": "camera",
    "muted": false,
    "width": 1280,
    "height": 720
  }
}
```

Để cập nhật giao diện bật hoặc tắt tiếng ngay lập tức, ứng dụng cũng cần lắng nghe các sự kiện phòng từ LiveKit Client SDK.

Nguyên nhân là các sự kiện Media được truyền trực tiếp qua kết nối LiveKit và có thể đến nhanh hơn sự kiện tương ứng từ backend.

## Luồng trạng thái cuộc gọi

```text
ringing -> ongoing -> ended
   |          |
   |          +-> ended by LiveKit webhook
   +-> rejected
   +-> canceled
   +-> missed (ring timeout or unexpected room closure)
```

Ý nghĩa các trạng thái:

* `ringing`: Cuộc gọi đang đổ chuông và chờ người nhận phản hồi.
* `ongoing`: Cuộc gọi đã được chấp nhận và đang diễn ra.
* `ended`: Cuộc gọi đã kết thúc.
* `rejected`: Người nhận đã từ chối cuộc gọi.
* `canceled`: Người gọi đã hủy cuộc gọi trước khi người nhận chấp nhận.
* `missed`: Cuộc gọi bị nhỡ do hết thời gian đổ chuông hoặc phòng LiveKit đóng ngoài dự kiến.

Một cuộc gọi đang đổ chuông có thể chuyển sang:

```text
ringing -> ongoing
ringing -> rejected
ringing -> canceled
ringing -> missed
```

Một cuộc gọi đang diễn ra có thể chuyển sang:

```text
ongoing -> ended
```

Trạng thái `ended` cũng có thể được cập nhật từ LiveKit Webhook khi LiveKit phát hiện phòng đã kết thúc.

Mỗi cặp đôi chỉ được phép có **một cuộc gọi đang hoạt động tại cùng một thời điểm**.

Room Token được giới hạn theo:

* Một phòng cụ thể.
* Hai người tham gia của cuộc gọi.
* Các nguồn Media được phép sử dụng.

Đối với cuộc gọi âm thanh, người tham gia chỉ được phép publish Microphone.

Đối với cuộc gọi video, người tham gia được phép publish:

* Microphone.
* Camera.
* Chia sẻ màn hình.
