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

Both login endpoints return:

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
    "accessToken": "<application JWT>"
  }
}
```

Store `data.accessToken` and use it for REST and Socket.IO authentication.
When `e2eeSetupRequired` is `true`, continue with the key setup flow documented
in [End-to-end encrypted messaging](e2ee-messaging.md).

## One active session

Every successful login creates a new session ID and embeds it in the application
JWT. The previous JWT then receives `401 Unauthorized` on protected REST APIs.
Tokens created before this feature do not contain a session ID and are also
rejected, so existing users must sign in again after deployment.

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
