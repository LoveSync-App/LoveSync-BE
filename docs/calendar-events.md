# API lịch hẹn và ngày quan trọng

Hai loại dữ liệu dùng chung collection `calendar_events` và cùng xuất hiện trên
một calendar tab:

- `APPOINTMENT`: lịch hẹn, không cho phép lặp.
- `IMPORTANT_DATE`: ngày quan trọng, cho phép `NONE` hoặc `YEARLY`.

Không có bước xác nhận, participant status, accept hoặc reject. Cả hai thành
viên trong couple `ACTIVE` đều có thể tạo, sửa và xóa event.

Tất cả API yêu cầu:

```text
Authorization: Bearer <jwt>
```

## Tạo lịch hẹn

```http
POST /calendar/events
Content-Type: application/json
```

```json
{
  "type": "APPOINTMENT",
  "title": "Ăn tối cùng nhau",
  "description": "Đặt bàn gần cửa sổ",
  "startsAt": "2026-07-10T12:00:00.000Z",
  "location": "Quận 1, TP.HCM",
  "recurrence": "NONE",
  "reminderEnabled": true,
  "reminderMinutesBefore": 1440
}
```

`location` không bắt buộc. Appointment chỉ chấp nhận
`recurrence: "NONE"`.

## Tạo ngày quan trọng

```http
POST /calendar/events
Content-Type: application/json
```

```json
{
  "type": "IMPORTANT_DATE",
  "title": "Ngày kỷ niệm",
  "description": "Kỷ niệm ngày bắt đầu",
  "startsAt": "2026-08-20T00:00:00.000Z",
  "recurrence": "YEARLY",
  "reminderEnabled": true,
  "reminderMinutesBefore": 10080
}
```

`IMPORTANT_DATE` nhận `recurrence: "NONE"` hoặc `"YEARLY"`.

## Reminder

- `reminderEnabled` mặc định là `true`.
- `reminderMinutesBefore` mặc định là `1440`, tức trước 24 giờ.
- Có thể chọn số phút bất kỳ từ `0` đến `525600`.
- Nếu event được tạo khi thời điểm reminder đã qua nhưng event vẫn chưa diễn
  ra, reminder được xếp gửi ở lượt worker gần nhất.
- Worker kiểm tra mỗi phút, gửi FCM cho thiết bị của cả hai thành viên và dùng
  cơ chế claim để tránh gửi trùng giữa các lượt chạy.
- Với event `YEARLY`, sau khi gửi xong worker tự xếp reminder cho năm tiếp theo.

Ví dụ:

| Thời gian nhắc | `reminderMinutesBefore` |
| --- | ---: |
| Đúng giờ | `0` |
| Trước 30 phút | `30` |
| Trước 1 giờ | `60` |
| Trước 1 ngày | `1440` |
| Trước 1 tuần | `10080` |

## Lấy dữ liệu cho calendar

```http
GET /calendar/events?from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z
```

Lọc riêng một loại:

```http
GET /calendar/events?from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z&type=APPOINTMENT
```

Response là một mảng đã sắp xếp theo `occurrenceAt`. Event lặp hằng năm được
bung thành occurrence đúng trong khoảng mobile yêu cầu:

```json
[
  {
    "_id": "...",
    "type": "IMPORTANT_DATE",
    "title": "Ngày kỷ niệm",
    "startsAt": "2024-07-10T00:00:00.000Z",
    "occurrenceAt": "2026-07-10T00:00:00.000Z",
    "occurrenceKey": "...:2026-07-10T00:00:00.000Z",
    "location": null,
    "recurrence": "YEARLY",
    "reminderEnabled": true,
    "reminderMinutesBefore": 1440,
    "nextReminderAt": "2026-07-09T00:00:00.000Z"
  }
]
```

Mobile nên dùng `occurrenceAt` để đặt marker lên calendar và
`occurrenceKey` làm key của ô hiển thị. Khoảng truy vấn tối đa là 5 năm.

## Chi tiết

```http
GET /calendar/events/:eventId
```

## Cập nhật

```http
PATCH /calendar/events/:eventId
Content-Type: application/json
```

Chỉ cần gửi các trường muốn thay đổi:

```json
{
  "title": "Ăn tối kỷ niệm",
  "location": "",
  "reminderMinutesBefore": 60
}
```

Gửi `location: ""` để xóa địa điểm. Nếu đổi `type` thành `APPOINTMENT`, event
phải có `recurrence: "NONE"`.

## Xóa

```http
DELETE /calendar/events/:eventId
```

```json
{
  "deleted": true,
  "eventId": "..."
}
```

## Quy ước thời gian

`startsAt`, `from`, `to` dùng ISO 8601. Backend lưu UTC; mobile chịu trách nhiệm
hiển thị theo múi giờ của thiết bị.
