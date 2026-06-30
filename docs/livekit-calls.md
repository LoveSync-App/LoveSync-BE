# LiveKit calls

## Configuration

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_TOKEN_TTL_SECONDS=900
CALL_RING_TIMEOUT_SECONDS=60
```

In the LiveKit dashboard, register this webhook URL:

```text
POST https://your-api.example.com/{API_PREFIX}/calls/webhooks/livekit
```

LiveKit signs the webhook. This endpoint intentionally does not use the
application JWT guard; `WebhookReceiver` verifies its `Authorization` header and
raw request body instead.

## REST API

All endpoints except the webhook require `Authorization: Bearer <jwt>`.

| Method | Endpoint                                    | Purpose                                     |
| ------ | ------------------------------------------- | ------------------------------------------- |
| `POST` | `/calls`                                    | Start a call with the user's active partner |
| `POST` | `/calls/video`                              | Start a video call without a request body   |
| `GET`  | `/calls/active`                             | Get the current ringing/ongoing call        |
| `GET`  | `/calls/history?page=1&limit=20&type=video` | Paginated and filtered call history         |
| `GET`  | `/calls/:callId`                            | Get one call                                |
| `GET`  | `/calls/:callId/participants`               | Get connected participants and media tracks |
| `POST` | `/calls/:callId/accept`                     | Callee accepts a ringing call               |
| `POST` | `/calls/:callId/reject`                     | Callee rejects a ringing call               |
| `POST` | `/calls/:callId/cancel`                     | Caller cancels a ringing call               |
| `POST` | `/calls/:callId/end`                        | Either participant ends an ongoing call     |
| `POST` | `/calls/:callId/token`                      | Issue a short-lived token for reconnection  |

Create-call body:

```json
{
  "type": "audio"
}
```

`type` accepts `audio` or `video` and defaults to `audio`. A create, accept, or
token response includes connection credentials:

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

The caller can connect after `POST /calls`. The callee must first call
`POST /calls/:callId/accept`, then connect with the returned credentials. A
callee cannot obtain a room token while the call is only ringing.

For a video call, either send `{ "type": "video" }` to `POST /calls` or use
`POST /calls/video`. The generated token permits microphone, camera, screen
share video, and screen share audio. Audio-call tokens remain microphone-only.

After connecting with a LiveKit client SDK, publish local tracks from the
client:

```js
await room.connect(serverUrl, participantToken);
await room.localParticipant.setMicrophoneEnabled(true);
await room.localParticipant.setCameraEnabled(true);

// Optional screen sharing
await room.localParticipant.setScreenShareEnabled(true);
```

Camera switching, mute/unmute, rendering remote video, and device permission
prompts are client responsibilities. `GET /calls/:callId/participants` can be
used after a reconnect to retrieve the current participants and their
microphone, camera, or screen-share publications.

## Socket.IO signaling

Connect to namespace `/calls` with the application JWT:

```js
io(`${API_URL}/calls`, {
  auth: { token: accessToken },
});
```

Server events:

- `call:incoming`
- `call:ringing`
- `call:accepted`
- `call:rejected`
- `call:canceled`
- `call:missed`
- `call:ended`
- `call:media-updated`
- `calls:ready`
- `calls:error`

The socket is signaling only. Audio and video tracks are transported by
LiveKit. The backend also sends an FCM `incoming_call` data payload to the
callee when a registered device token exists.

`call:media-updated` is emitted when LiveKit reports that a microphone, camera,
or screen-share track was published or unpublished:

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

For immediate mute/unmute UI changes, also listen to the LiveKit client room
events because media events travel directly over the LiveKit connection.

## State flow

```text
ringing -> ongoing -> ended
   |          |
   |          +-> ended by LiveKit webhook
   +-> rejected
   +-> canceled
   +-> missed (ring timeout or unexpected room closure)
```

Only one active call is allowed per couple. Room tokens are scoped to one room,
two participants, and the allowed media sources. Audio calls can publish only a
microphone; video calls can publish a microphone, camera, and screen share.
