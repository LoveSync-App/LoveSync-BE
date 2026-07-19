# Authentication and single active session

## Overview

An account may be linked to multiple login methods:

- email and password;
- Google through Firebase Authentication.

The backend groups login methods by the verified, normalized email address. Only
one session may be active for an account. A successful password or Google login
immediately invalidates the previous session.

All protected endpoints use:

```http
Authorization: Bearer <accessToken>
```

## Password registration and login

### Register

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

Registration rejects an email that already belongs to any account.

### Add password login to a Google-only account

This operation requires the current application JWT, which proves ownership of
the existing account.

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

The endpoint returns the updated user. It rejects accounts that already have
password login enabled.

### Login

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

## Google login with Firebase

The mobile app must first authenticate with Google through Firebase. It then
sends the **Firebase ID token** to the backend. Do not send the Google access
token or trust an email supplied by the client.

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

`name` and `avatar` are required profile fallbacks. When valid values are
present in the verified Firebase token, the backend prefers those token claims.

The backend:

1. verifies the token signature, expiry, revocation status and Firebase project;
2. requires `firebase.sign_in_provider` to be `google.com`;
3. requires a verified email;
4. finds the local user by normalized email and links Google to that user;
5. creates a new user when the email does not exist.

The same Firebase UID cannot be linked to a different local email.

### Flutter outline

After completing Google sign-in and signing in to Firebase:

```dart
final firebaseUser = FirebaseAuth.instance.currentUser!;
final firebaseIdToken = await firebaseUser.getIdToken(true);

await api.post('/auth/google', data: {
  'firebaseIdToken': firebaseIdToken,
  'name': firebaseUser.displayName ?? googleDisplayName,
  'avatar': firebaseUser.photoURL ?? googlePhotoUrl,
});
```

The value returned by `getIdToken()` is the Firebase ID token expected by the
API.

## Login response

Both login endpoints return an access token and a refresh token:

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

Store `data.accessToken` and use it for REST and Socket.IO authentication. Store
`data.refreshToken` securely and use it only with `/auth/refresh`.
When `e2eeSetupRequired` is `true`, continue with the key setup flow documented
in [End-to-end encrypted messaging](e2ee-messaging.md).

## Refresh token

When a protected REST API returns `401 Unauthorized` because the access token is
expired, the app can request a new token pair:

```http
POST /auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<current refresh token>"
}
```

Response:

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

Refresh tokens are rotating one-time tokens. After a successful refresh, the old
refresh token is invalid and the app must replace both stored tokens with the
new values immediately. If the refresh token is expired, already used, logged
out, or belongs to a session replaced by another device, the endpoint returns
`401 Unauthorized`; the app should clear local auth state and navigate to login.

Socket.IO connections cannot use a refresh token. Reconnect sockets with the new
`accessToken` after refresh.

## Forgot password with email OTP

This flow is public and does not require `Authorization`.

### Request password reset OTP

```http
POST /auth/password/forgot
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

Response:

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

For privacy, the API returns the same successful response even when the email is
not registered. If the account exists and is active, the server sends a 6-digit
OTP using the `otp.hbs` email template.

The server stores only a hashed OTP in Redis. The OTP expires after
`PASSWORD_RESET_OTP_TTL_SECONDS`, and resend requests are throttled by
`PASSWORD_RESET_OTP_COOLDOWN_SECONDS`.

### Reset password with OTP

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

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "passwordReset": true
  }
}
```

On success, the OTP is deleted, password login is enabled for the account, and
the current active session is revoked. Existing REST access/refresh tokens then
return `401 Unauthorized`, and connected sockets receive:

```text
auth:session-revoked
```

```json
{
  "code": "PASSWORD_RESET",
  "message": "Password was reset for this account"
}
```

Invalid, expired, or over-attempted OTPs return `401 Unauthorized`. Password and
password confirmation mismatch returns `400 Bad Request`.

## One active session

Every successful login creates a new session ID and embeds it in the application
JWT and refresh token. The previous access token and refresh token then receive
`401 Unauthorized`. Tokens created before this feature do not contain a session
ID and are also rejected, so existing users must sign in again after deployment.

The `/chat`, `/calls`, and `/locations` Socket.IO namespaces validate the same
session. When an account signs in again, connected sockets from the old session
receive:

```text
auth:session-revoked
```

```json
{
  "code": "SIGNED_IN_ON_ANOTHER_DEVICE",
  "message": "This account was signed in on another device"
}
```

The server disconnects those sockets immediately. The app should clear its
stored token, stop reconnect attempts, and navigate to the login screen when it
receives this event or a session-related `401`.

Socket connection remains:

```js
io(`${API_URL}/chat`, {
  auth: { token: accessToken },
});
```

Use the same application JWT for the other namespaces.

## Logout

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "loggedOut": true
  }
}
```

Logout invalidates the current JWT and disconnects its active sockets.
It also invalidates the current refresh token.

## Environment

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

Use a different strong secret for `JWT_REFRESH_SECRET_KEY`; do not reuse
`JWT_SECRET_KEY`. Use another strong secret for `PASSWORD_RESET_OTP_SECRET`.

## Firebase server configuration

Enable Google in Firebase Console under Authentication providers. The backend
uses the Firebase Admin service account from:

```text
firebase-service-account.json
```

This file is ignored by Git and must be provisioned securely in every deployed
environment. The mobile Firebase project and backend service account must belong
to the same Firebase project.

## Multiple backend instances

Session validation remains correct because the active session ID is stored in
MongoDB. Immediate socket disconnection is process-local. When deploying more
than one backend instance, use a shared Socket.IO adapter/registry (for example,
Redis) so the revoke event can reach sockets connected to another instance.
