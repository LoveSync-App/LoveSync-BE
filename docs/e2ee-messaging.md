# Nhắn tin mã hóa đầu cuối (End-to-End Encryption - E2EE)

## Mô hình bảo mật

Ứng dụng di động chịu trách nhiệm tạo và sử dụng toàn bộ khóa riêng (Private Key) ở dạng bản rõ (plaintext).

Backend **không bao giờ**:

- tạo khóa riêng;
- nhận khóa riêng ở dạng bản rõ;
- giải mã khóa riêng;
- nhận mã khôi phục gồm 6 chữ số.

Backend chỉ lưu trữ:

- khóa công khai (RSA Public Key) dưới định dạng JWK;
- khóa riêng đã được mã hóa trên thiết bị bằng mã khôi phục;
- nội dung tin nhắn đã mã hóa và khóa AES của từng tin nhắn đã được mã hóa.

Các thuật toán sử dụng trong phiên bản API hiện tại:

| Mục đích | Thuật toán |
|----------|------------|
| Cặp khóa người dùng | RSA-OAEP, tối thiểu 2048 bit, SHA-256 |
| KDF cho mã khôi phục | PBKDF2-HMAC-SHA256 |
| Sao lưu khóa riêng | AES-256-GCM |
| Nội dung tin nhắn | AES-256-GCM |
| Mã hóa khóa AES của tin nhắn | RSA-OAEP-256 cho cả người gửi và người nhận |

Do mã khôi phục chỉ gồm **6 chữ số** nên mức độ ngẫu nhiên (entropy) thấp. Nếu kẻ tấn công lấy được bản sao lưu khóa riêng đã mã hóa, họ vẫn có thể thực hiện tấn công brute-force ngoại tuyến.

PBKDF2 giúp làm chậm quá trình này nhưng không thể biến mã 6 chữ số thành một mật khẩu mạnh. Đây là một hạn chế đã được chấp nhận trong phiên bản hiện tại.

---

# Quy trình tài khoản và thiết bị

## Tài khoản mới

1. Đăng ký và đăng nhập hoặc đăng nhập bằng Google.
2. Kiểm tra `user.e2eeSetupRequired` trong phản hồi đăng nhập.
3. Sinh một cặp khóa RSA-OAEP trên thiết bị di động. Khóa riêng phải có thể export để phục vụ việc sao lưu.
4. Yêu cầu người dùng tạo mã khôi phục gồm 6 chữ số và nhập lại lần thứ hai. Việc so sánh phải được thực hiện hoàn toàn trên thiết bị.
5. Sinh một giá trị **salt ngẫu nhiên** có độ dài tối thiểu **16 byte**.
6. Từ mã khôi phục (UTF-8), sinh khóa AES 256 bit bằng PBKDF2-HMAC-SHA256. API chấp nhận từ **100.000 đến 2.000.000** vòng lặp; **600.000** là giá trị khuyến nghị nếu hiệu năng thiết bị cho phép.
7. Export khóa riêng, sinh IV ngẫu nhiên dài **12 byte**, sau đó mã hóa khóa riêng bằng AES-256-GCM và lưu lại Authentication Tag dài **16 byte**.
8. Gửi khóa công khai và bản sao lưu đã mã hóa lên backend thông qua `POST /e2ee/keys`.
9. Xóa khóa riêng ở dạng bản rõ và khóa AES vừa sinh khỏi bộ nhớ. Chỉ giữ khóa riêng đã import trong vùng lưu trữ bảo mật của thiết bị (nếu nền tảng hỗ trợ).

> **Không bao giờ gửi `recoveryCode` đến backend.**

Global Validation Pipe sẽ từ chối mọi trường không xác định, bao gồm cả `recoveryCode` nếu vô tình được gửi trong request.

---

## Đăng nhập trên thiết bị mới

Khi đăng nhập trên thiết bị mới, phiên đăng nhập của thiết bị cũ sẽ bị vô hiệu hóa.

Nếu `e2eeSetupRequired = false`:

1. Gọi `GET /e2ee/keys/me`.
2. Yêu cầu người dùng nhập mã khôi phục gồm 6 chữ số.
3. Thực hiện PBKDF2 với Salt và số vòng lặp nhận được.
4. Giải mã và xác thực bản sao lưu khóa riêng bằng AES-GCM.
5. Import khóa riêng vừa khôi phục vào bộ cung cấp mã hóa (Crypto Provider) của thiết bị.

Nếu xác thực AES-GCM thất bại thì:

- mã khôi phục không đúng;
- hoặc bản sao lưu đã bị hỏng.

**Không gửi mã khôi phục lên backend để kiểm tra.**

Hiện tại chưa có API:

- đặt lại mã khôi phục;
- xoay vòng (Rotate) khóa.

Nếu mất mã khôi phục thì khóa riêng và toàn bộ các tin nhắn cũ đã mã hóa sẽ không thể khôi phục được.

---

# API quản lý khóa

Tất cả API đều yêu cầu:

```http
Authorization: Bearer <accessToken>
```

---

## Thiết lập khóa (chỉ thực hiện một lần)

```http
POST /e2ee/keys
Content-Type: application/json
```

```json
{
  "publicKey": {
    "kty": "RSA",
    "alg": "RSA-OAEP-256",
    "n": "<base64url RSA modulus>",
    "e": "AQAB",
    "use": "enc"
  },
  "encryptedPrivateKey": {
    "algorithm": "AES-256-GCM",
    "kdf": "PBKDF2-HMAC-SHA256",
    "iterations": 600000,
    "salt": "<base64, tối thiểu 16 byte>",
    "iv": "<base64, chính xác 12 byte>",
    "authTag": "<base64, chính xác 16 byte>",
    "ciphertext": "<base64 khóa riêng đã mã hóa>"
  }
}
```

Phản hồi:

```json
{
  "userId": "6863...",
  "keyVersion": 1,
  "publicKey": {
    "kty": "RSA",
    "alg": "RSA-OAEP-256",
    "n": "...",
    "e": "AQAB",
    "use": "enc"
  },
  "createdAt": "2026-07-02T08:00:00.000Z",
  "updatedAt": "2026-07-02T08:00:00.000Z"
}
```

Nếu khóa đã được cấu hình trước đó, API sẽ trả về:

```
409 Conflict
```

API **không trả lại khóa riêng đã mã hóa** trong phản hồi.

---

## Tải bản sao lưu khóa của chính mình

```http
GET /e2ee/keys/me
```

Phản hồi bao gồm khóa công khai và:

```json
{
  "encryptedPrivateKey": {
    "algorithm": "AES-256-GCM",
    "kdf": "PBKDF2-HMAC-SHA256",
    "iterations": 600000,
    "salt": "...",
    "iv": "...",
    "authTag": "...",
    "ciphertext": "..."
  }
}
```

Chỉ chủ sở hữu tài khoản mới có quyền lấy bản sao lưu này.

---

## Lấy khóa công khai của người yêu

```http
GET /e2ee/keys/partner
```

API chỉ trả về:

- `userId`
- `keyVersion`
- Public Key

của người yêu hiện tại.

Nếu:

- chưa ghép đôi;
- hoặc người yêu chưa cấu hình E2EE;

API sẽ trả về:

```
404 Not Found
```

---

# Gửi tin nhắn được mã hóa

Trước khi mã hóa tin nhắn cần tải:

- Public Key, Private Key và `keyVersion` của người gửi.
- Public Key và `keyVersion` hiện tại của người nhận.

Đối với **mỗi tin nhắn**:

1. Sinh khóa AES 256 bit ngẫu nhiên.
2. Sinh IV ngẫu nhiên dài 12 byte.
3. Mã hóa nội dung UTF-8 bằng AES-256-GCM.
4. Mã hóa khóa AES bằng Public Key của người gửi.
5. Mã hóa cùng khóa AES đó bằng Public Key của người nhận.
6. Xóa khóa AES và dữ liệu bản rõ khỏi bộ nhớ.
7. Gửi gói dữ liệu sau.

Việc mã hóa khóa AES cho **cả người gửi và người nhận** cho phép người gửi vẫn có thể đọc lại lịch sử trò chuyện sau khi cài lại ứng dụng.

```http
POST /chat/send-message
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "encryption": {
    "algorithm": "RSA-OAEP-256+A256GCM",
    "ciphertext": "<base64 AES-GCM ciphertext>",
    "iv": "<base64, đúng 12 byte>",
    "authTag": "<base64, đúng 16 byte>",
    "senderEncryptedKey": "<base64 RSA-encrypted AES key>",
    "recipientEncryptedKey": "<base64 RSA-encrypted AES key>",
    "senderKeyVersion": 1,
    "recipientKeyVersion": 1
  }
}
```

> Không bao giờ gửi đồng thời trường `message` và `encryption`.

Khi cả hai thành viên đã thiết lập E2EE, API sẽ từ chối mọi tin nhắn dạng bản rõ (Plaintext).

Trong giai đoạn chuyển đổi, tin nhắn bản rõ chỉ được phép gửi nếu **ít nhất một trong hai người chưa cấu hình E2EE**.

Backend sẽ kiểm tra `keyVersion` của cả hai bên.

Nếu trả về:

```
409 Conflict
```

ứng dụng cần:

1. tải lại Public Key mới;
2. mã hóa lại nội dung chưa gửi;
3. gửi lại tin nhắn.

---

# Đọc tin nhắn

`GET /chat` và các sự kiện Socket.IO đều trả về cùng một đối tượng `encryption`.

Ứng dụng xác định khóa cần dùng dựa trên `message.sender`:

- Nếu là người gửi → giải mã `senderEncryptedKey`.
- Nếu là người nhận → giải mã `recipientEncryptedKey`.

Sau khi thu được khóa AES của tin nhắn, sử dụng:

- `iv`
- `authTag`
- `ciphertext`

để giải mã nội dung.

Nếu xác thực AES-GCM thất bại thì tin nhắn phải được xem là:

- bị hỏng;
- hoặc đã bị chỉnh sửa.

Backend **không thể**:

- tìm kiếm nội dung tin nhắn;
- kiểm duyệt;
- tạo bản xem trước;
- khôi phục nội dung;

vì backend không sở hữu khóa giải mã.

Thông báo đẩy (Push Notification) cũng **không chứa nội dung tin nhắn**.

---

# Phạm vi hỗ trợ hiện tại

Phiên bản hiện tại chỉ mã hóa:

- nội dung văn bản;
- chú thích (caption) của ảnh;

được gửi thông qua:

```
POST /chat/send-message
```

Các dữ liệu sau **chưa được mã hóa**:

- file ảnh đã tải lên;
- URL tệp đính kèm;
- dữ liệu vị trí;
- metadata của cuộc gọi;
- các sự kiện hệ thống khác.

Các tin nhắn cũ đã được lưu ở dạng bản rõ sẽ **không được tự động chuyển đổi sang E2EE**.