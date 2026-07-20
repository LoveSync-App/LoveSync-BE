# Xác thực và cơ chế một phiên đăng nhập duy nhất

## Tổng quan

Một tài khoản có thể được liên kết với nhiều phương thức đăng nhập:

- Email và mật khẩu.
- Google thông qua Firebase Authentication.

Backend sẽ nhóm các phương thức đăng nhập dựa trên địa chỉ email đã được xác minh và chuẩn hóa. Mỗi tài khoản chỉ được phép tồn tại **một phiên đăng nhập (session) đang hoạt động**. Khi người dùng đăng nhập thành công bằng mật khẩu hoặc Google, phiên đăng nhập trước đó sẽ ngay lập tức bị vô hiệu hóa.

Tất cả các API yêu cầu xác thực đều sử dụng:

```http
Authorization: Bearer <accessToken>
```

---

## Đăng ký và đăng nhập bằng mật khẩu

### Đăng ký

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "name": "Love Sync",
  "email": "user@example.com",
  "password": "secret123",
  "passwordConfirm": "secret123"
}
```

Hệ thống sẽ từ chối đăng ký nếu địa chỉ email đã thuộc về bất kỳ tài khoản nào.

### Thêm phương thức đăng nhập bằng mật khẩu cho tài khoản chỉ dùng Google

Thao tác này yêu cầu JWT hiện tại của ứng dụng để chứng minh người dùng là chủ sở hữu của tài khoản.

```http
POST /auth/password
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "password": "secret123",
  "passwordConfirm": "secret123"
}
```

API sẽ trả về thông tin người dùng sau khi cập nhật.

Nếu tài khoản đã bật đăng nhập bằng mật khẩu trước đó thì yêu cầu sẽ bị từ chối.

### Đăng nhập

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

---

## Đăng nhập Google bằng Firebase

Ứng dụng di động phải đăng nhập Google thông qua Firebase Authentication trước.

Sau đó ứng dụng gửi **Firebase ID Token** đến backend.

> **Lưu ý:** Không gửi Google Access Token và không tin tưởng địa chỉ email do client tự cung cấp.

```http
POST /auth/google
Content-Type: application/json
```

```json
{
  "firebaseIdToken": "<Firebase ID token>",
  "name": "Love Sync",
  "avatar": "https://example.com/avatar.jpg"
}
```

Các trường `name` và `avatar` được dùng làm thông tin dự phòng. Nếu Firebase ID Token đã chứa các giá trị hợp lệ thì backend sẽ ưu tiên sử dụng các giá trị trong token.

Backend sẽ:

1. Xác thực chữ ký, thời hạn, trạng thái thu hồi và Firebase Project của token.
2. Kiểm tra `firebase.sign_in_provider` phải là `google.com`.
3. Yêu cầu email trong token phải được xác minh.
4. Tìm người dùng trong hệ thống theo email đã chuẩn hóa và liên kết tài khoản Google với người dùng đó.
5. Tạo tài khoản mới nếu email chưa tồn tại.

Một Firebase UID chỉ có thể liên kết với duy nhất một email trong hệ thống.

### Ví dụ trong Flutter

Sau khi hoàn tất đăng nhập Google và Firebase:

```dart
final firebaseUser = FirebaseAuth.instance.currentUser!;
final firebaseIdToken = await firebaseUser.getIdToken(true);

await api.post('/auth/google', data: {
  'firebaseIdToken': firebaseIdToken,
  'name': firebaseUser.displayName ?? googleDisplayName,
  'avatar': firebaseUser.photoURL ?? googlePhotoUrl,
});
```

Giá trị trả về từ `getIdToken()` chính là **Firebase ID Token** mà API yêu cầu.

---

## Phản hồi khi đăng nhập

Cả hai API đăng nhập đều trả về **Access Token** và **Refresh Token**:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "id": "6863...",
      "email": "user@example.com",
      "name": "Love Sync",
      "avatar": "https://example.com/avatar.jpg",
      "authProviders": ["password", "google.com"],
      "e2eeSetupRequired": true
    },
    "loginProvider": "google.com",
    "tokenType": "Bearer",
    "accessToken": "<short-lived application JWT>",
    "refreshToken": "<long-lived refresh JWT>"
  }
}
```

Lưu trữ `data.accessToken` và sử dụng token này để xác thực các REST API và Socket.IO.

Lưu trữ `data.refreshToken` một cách an toàn và chỉ sử dụng với API `/auth/refresh`.

Nếu `e2eeSetupRequired` bằng `true`, ứng dụng cần tiếp tục quy trình thiết lập khóa mã hóa được mô tả trong tài liệu **End-to-end encrypted messaging**.

---

## Refresh Token

Khi một REST API trả về `401 Unauthorized` do Access Token hết hạn, ứng dụng có thể yêu cầu cặp token mới:

```http
POST /auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<current refresh token>"
}
```

Phản hồi:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "tokenType": "Bearer",
    "accessToken": "<new access token>",
    "refreshToken": "<new refresh token>"
  }
}
```

Refresh Token là **token chỉ được sử dụng một lần (Rotating Refresh Token)**.

Sau khi refresh thành công:

- Refresh Token cũ sẽ không còn hiệu lực.
- Ứng dụng phải thay thế ngay Access Token và Refresh Token đang lưu bằng các giá trị mới.

Nếu Refresh Token:

- đã hết hạn;
- đã được sử dụng;
- đã đăng xuất;
- hoặc thuộc về một phiên đã bị thay thế bởi thiết bị khác;

API sẽ trả về:

```
401 Unauthorized
```

Khi đó ứng dụng cần:

- xóa toàn bộ trạng thái đăng nhập cục bộ;
- chuyển người dùng về màn hình đăng nhập.

Socket.IO **không sử dụng Refresh Token**.

Sau khi refresh thành công, cần kết nối lại Socket.IO bằng Access Token mới.

---

## Quên mật khẩu bằng OTP qua Email

Quy trình này là API công khai và **không yêu cầu Authorization**.

### Yêu cầu gửi OTP đặt lại mật khẩu

```http
POST /auth/password/forgot
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

Phản hồi:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "sent": true,
    "expiresInSeconds": 300
  }
}
```

Để bảo vệ quyền riêng tư, API luôn trả về phản hồi thành công ngay cả khi email chưa được đăng ký.

Nếu tài khoản tồn tại và đang hoạt động, hệ thống sẽ gửi mã OTP gồm **6 chữ số** bằng mẫu email `otp.hbs`.

Máy chủ chỉ lưu **OTP đã được băm (hash)** trong Redis.

OTP:

- hết hạn sau `PASSWORD_RESET_OTP_TTL_SECONDS`;
- việc gửi lại bị giới hạn bởi `PASSWORD_RESET_OTP_COOLDOWN_SECONDS`.

### Đặt lại mật khẩu bằng OTP

```http
POST /auth/password/reset
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "password": "newSecret123",
  "passwordConfirm": "newSecret123"
}
```

Phản hồi:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "passwordReset": true
  }
}
```

Khi thành công:

- OTP sẽ bị xóa.
- Đăng nhập bằng mật khẩu được kích hoạt cho tài khoản.
- Phiên đăng nhập hiện tại sẽ bị thu hồi.

Các Access Token và Refresh Token cũ sẽ trả về:

```
401 Unauthorized
```

Các Socket đang kết nối sẽ nhận sự kiện:

```text
auth:session-revoked
```

```json
{
  "code": "PASSWORD_RESET",
  "message": "Password was reset for this account"
}
```

Nếu OTP:

- không hợp lệ;
- đã hết hạn;
- vượt quá số lần thử;

API sẽ trả về:

```
401 Unauthorized
```

Nếu mật khẩu và xác nhận mật khẩu không khớp sẽ trả về:

```
400 Bad Request
```

---

## Cơ chế một phiên đăng nhập duy nhất

Mỗi lần đăng nhập thành công, hệ thống sẽ tạo một **Session ID** mới và nhúng giá trị này vào Application JWT và Refresh Token.

Access Token và Refresh Token của phiên trước sẽ không còn hợp lệ và trả về:

```
401 Unauthorized
```

Các token được tạo trước khi triển khai tính năng Session ID cũng sẽ bị từ chối, vì vậy người dùng cần đăng nhập lại sau khi cập nhật hệ thống.

Các namespace Socket.IO:

- `/chat`
- `/calls`
- `/locations`

đều xác thực cùng một Session ID.

Nếu tài khoản đăng nhập trên thiết bị khác, các Socket của phiên cũ sẽ nhận được:

```text
auth:session-revoked
```

```json
{
  "code": "SIGNED_IN_ON_ANOTHER_DEVICE",
  "message": "This account was signed in on another device"
}
```

Máy chủ sẽ ngay lập tức ngắt các Socket này.

Ứng dụng cần:

- xóa token đang lưu;
- dừng tự động kết nối lại Socket;
- chuyển người dùng về màn hình đăng nhập khi nhận được sự kiện này hoặc lỗi `401` liên quan đến session.

Kết nối Socket vẫn giữ nguyên:

```js
io(`${API_URL}/chat`, {
  auth: { token: accessToken },
});
```

Sử dụng cùng một Application JWT cho các namespace Socket.IO còn lại.

---

## Đăng xuất

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

Phản hồi:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "loggedOut": true
  }
}
```

Khi đăng xuất:

- JWT hiện tại sẽ bị vô hiệu hóa.
- Các Socket đang hoạt động sẽ bị ngắt kết nối.
- Refresh Token hiện tại cũng sẽ bị vô hiệu hóa.

---

## Biến môi trường

```env
JWT_SECRET_KEY=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET_KEY=...
JWT_REFRESH_EXPIRES_IN=30d
PASSWORD_RESET_OTP_SECRET=...
PASSWORD_RESET_OTP_TTL_SECONDS=300
PASSWORD_RESET_OTP_COOLDOWN_SECONDS=60
PASSWORD_RESET_OTP_MAX_ATTEMPTS=5
REDIS_HOST=...
REDIS_PORT=6379
REDIS_PASSWORD=...
```

Nên sử dụng một khóa bí mật mạnh riêng cho `JWT_REFRESH_SECRET_KEY`, không tái sử dụng `JWT_SECRET_KEY`.

Tương tự, `PASSWORD_RESET_OTP_SECRET` cũng nên sử dụng một khóa bí mật mạnh khác.

---

## Cấu hình Firebase phía máy chủ

Bật phương thức đăng nhập Google trong **Firebase Console → Authentication → Sign-in providers**.

Backend sử dụng tài khoản dịch vụ Firebase Admin từ tệp:

```text
firebase-service-account.json
```

Tệp này phải được:

- đưa vào `.gitignore`;
- triển khai an toàn trên mọi môi trường.

Dự án Firebase của ứng dụng di động và tài khoản dịch vụ Firebase Admin của backend phải thuộc **cùng một Firebase Project**.

---

## Triển khai nhiều Backend Instance

Việc xác thực Session vẫn hoạt động chính xác vì Session ID đang hoạt động được lưu trong MongoDB.

Tuy nhiên, việc ngắt kết nối Socket ngay lập tức chỉ có hiệu lực trong cùng một tiến trình (process).

Khi triển khai nhiều backend instance, nên sử dụng một **Socket.IO adapter hoặc registry dùng chung** (ví dụ Redis) để sự kiện thu hồi phiên (`session revoke`) có thể được gửi đến các Socket đang kết nối ở những instance khác.