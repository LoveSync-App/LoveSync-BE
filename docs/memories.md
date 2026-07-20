# API chia sẻ kỷ niệm

Tất cả API yêu cầu header:

```text
Authorization: Bearer <jwt>
```

## Tạo kỷ niệm

```http
POST /memories
Content-Type: application/json
```

Payload chỉ gồm ba trường bắt buộc:

```json
{
  "description": "Chuyến đi Đà Lạt cùng nhau",
  "file_url": "https://example.com/memory.jpg",
  "time": "2026-07-01T10:30:00.000Z"
}
```

- `description`: mô tả kỷ niệm, không được để trống.
- `file_url`: URL ảnh đã upload, không được để trống.
- `time`: thời gian của kỷ niệm theo định dạng ISO 8601.

Các trường cũ như `title`, `emotion`, `location` và `file_type` không còn được
chấp nhận.

## Danh sách kỷ niệm

```http
GET /memories
```

Kết quả được lấy theo couple đang hoạt động và sắp xếp từ thời gian mới nhất
đến cũ nhất.
