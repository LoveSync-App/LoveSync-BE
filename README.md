# LoveSync Backend

Backend API cho LoveSync, được xây dựng bằng NestJS và TypeScript. Dự án cung cấp các dịch vụ cốt lõi cho ứng dụng cặp đôi: xác thực, hồ sơ người dùng, kết nối couple, chat, album kỷ niệm, vị trí thời gian thực, lịch, cuộc gọi, thông báo và mã hóa đầu cuối.

## Tính năng chính

- Xác thực bằng JWT, refresh token, Google/Firebase và quản lý phiên đăng nhập.
- Quản lý người dùng, couple, lời mời và trạng thái mối quan hệ.
- Chat realtime qua Socket.IO, hỗ trợ timeline, phân trang và tin nhắn vị trí.
- Chia sẻ vị trí trực tiếp, thông báo, lịch sự kiện và nhắc hẹn.
- Album/kỷ niệm, upload media qua Cloudinary.
- Cuộc gọi qua LiveKit và hỗ trợ E2EE cho tin nhắn.

## Công nghệ

- NestJS 11, TypeScript
- MongoDB/Mongoose
- Redis/ioredis
- Socket.IO
- Firebase Admin
- Cloudinary, LiveKit, Nodemailer
- Jest, ESLint, Prettier

## Yêu cầu

- Node.js `>= 22.12.0`
- npm
- MongoDB
- Redis
- Tài khoản/dịch vụ cho Firebase, Cloudinary, LiveKit và SMTP mail nếu dùng các chức năng tương ứng

## Cài đặt

```bash
npm install
cp .env.example .env
```

Cập nhật các biến môi trường trong `.env`, tối thiểu gồm:

- `PORT`, `API_PREFIX`
- `MONGO_URI`
- `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`
- `REDIS_HOST`, `REDIS_PORT`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `CLOUDINARY_*`, `LIVEKIT_*`, `MAIL_*` nếu cần

## Chạy dự án

```bash
# development
npm run start

# watch mode
npm run start:dev

# production
npm run build
npm run start:prod
```

Mặc định API chạy theo `PORT` và `API_PREFIX` trong `.env`, ví dụ `http://localhost:8080/api`.

## Scripts

```bash
npm run lint
npm run format
npm run test
npm run test:e2e
npm run test:cov
```

## Tài liệu API

- [Authentication](docs/authentication.md)
- [Calendar events](docs/calendar-events.md)
- [Chat timeline](docs/chat-timeline.md)
- [E2EE messaging](docs/e2ee-messaging.md)
- [LiveKit calls](docs/livekit-calls.md)
- [Location sharing](docs/location-sharing.md)
- [Memories](docs/memories.md)

## Cấu trúc chính

```text
src/
  config/       Cấu hình môi trường, MongoDB, Redis, mail, Firebase, Cloudinary
  modules/      Các domain module của ứng dụng
  main.ts       Bootstrap NestJS app
docs/           Tài liệu API theo từng tính năng
test/           E2E tests
```

## License

Dự án là mã nguồn nội bộ và được khai báo `UNLICENSED`.
