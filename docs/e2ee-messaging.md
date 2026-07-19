# End-to-end encrypted messaging

## Security model

The mobile app generates and uses all plaintext private keys. The backend never
generates, receives, or decrypts a plaintext private key and never receives the
six-digit recovery code.

The backend stores:

- an RSA public key as JWK;
- the private key encrypted on the device with the recovery code;
- encrypted message payloads and encrypted per-message AES keys.

Algorithms used by this API version:

| Purpose                  | Algorithm                             |
| ------------------------ | ------------------------------------- |
| User key pair            | RSA-OAEP, minimum 2048 bits, SHA-256  |
| Recovery-code KDF        | PBKDF2-HMAC-SHA256                    |
| Private-key backup       | AES-256-GCM                           |
| Message content          | AES-256-GCM                           |
| Message AES-key wrapping | RSA-OAEP-256 for sender and recipient |

The six-digit code has low entropy and an attacker with the encrypted backup can
attempt an offline brute-force attack. PBKDF2 slows that attack but cannot make
a six-digit code strong. This is an accepted limitation of the current version.

## Account and device flow

### New account

1. Register and log in, or log in through Google.
2. Check `user.e2eeSetupRequired` in the login response.
3. Generate an RSA-OAEP key pair on the mobile device. The private key must be
   exportable so it can be encrypted for recovery.
4. Ask the user to create a six-digit code and enter it a second time. Verify
   equality entirely on the device.
5. Generate a random salt of at least 16 bytes.
6. Derive a 256-bit AES key from the UTF-8 recovery code with
   PBKDF2-HMAC-SHA256. The API accepts 100,000–2,000,000 iterations; 600,000 is
   the recommended initial value when device performance permits.
7. Export the private key, generate a random 12-byte IV, and encrypt the private
   key with AES-256-GCM. Keep the 16-byte authentication tag.
8. Upload the public key and encrypted backup with `POST /e2ee/keys`.
9. Remove the plaintext exported private-key bytes and derived AES key from
   memory. Keep the imported private key in secure device storage where
   supported.

Do not send `recoveryCode` in any request. The global validation pipe rejects
unknown fields, including a recovery code accidentally added to the setup body.

### Login on a new device

A login on the new device invalidates the previous device session. When
`e2eeSetupRequired` is `false`:

1. call `GET /e2ee/keys/me`;
2. ask for the six-digit recovery code;
3. run PBKDF2 using the returned salt and iteration count;
4. decrypt and authenticate the private-key backup with AES-GCM;
5. import the recovered private key into the local crypto provider.

An AES-GCM authentication failure means the code is incorrect or the backup is
damaged. Do not upload the code to the backend for verification.

There is currently no recovery-code reset or key rotation API. Losing the code
means the private key and old encrypted messages cannot be recovered.

## Key APIs

All endpoints require:

```http
Authorization: Bearer <accessToken>
```

### Configure keys once

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
    "salt": "<base64, at least 16 bytes>",
    "iv": "<base64, exactly 12 bytes>",
    "authTag": "<base64, exactly 16 bytes>",
    "ciphertext": "<base64 encrypted private key>"
  }
}
```

Response:

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

The endpoint returns `409 Conflict` if keys are already configured. It does not
return the encrypted private key in the setup response.

### Download my recovery bundle

```http
GET /e2ee/keys/me
```

Response includes the public key and:

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

Only the owner can retrieve this encrypted backup.

### Get the active partner public key

```http
GET /e2ee/keys/partner
```

The response contains only the active partner's `userId`, `keyVersion`, and
public key. It returns `404` when there is no active couple or the partner has
not configured E2EE.

## Sending an encrypted message

Before encrypting, load:

- the sender public/private key and `keyVersion`;
- the current partner public key and `keyVersion`.

For every message:

1. generate a new random 256-bit AES message key;
2. generate a new random 12-byte IV;
3. encrypt UTF-8 message content with AES-256-GCM;
4. encrypt the raw AES message key with the sender public key;
5. encrypt the same raw AES message key with the recipient public key;
6. remove the raw AES key and plaintext bytes from memory;
7. send the envelope below.

Encrypting the message key for both people allows the sender to decrypt their
own history after reinstalling the app.

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
    "iv": "<base64, exactly 12 bytes>",
    "authTag": "<base64, exactly 16 bytes>",
    "senderEncryptedKey": "<base64 RSA-encrypted AES key>",
    "recipientEncryptedKey": "<base64 RSA-encrypted AES key>",
    "senderKeyVersion": 1,
    "recipientKeyVersion": 1
  }
}
```

Never send `message` together with `encryption`. Once both members of a couple
have E2EE keys, the API rejects plaintext text messages. During migration,
plaintext remains available only while at least one member has not configured
keys.

The server validates that both key versions are current. A `409 Conflict` means
the app must fetch the public keys again and re-encrypt the unsent plaintext.

## Reading messages

`GET /chat` and Socket.IO message events return the same `encryption` object.
Choose the wrapped key by comparing the current user with `message.sender`:

- sender: decrypt `senderEncryptedKey`;
- recipient: decrypt `recipientEncryptedKey`.

Use the recovered AES message key with `iv`, `authTag`, and `ciphertext`.
Authentication failure must be treated as a corrupted or tampered message.

The backend cannot search, moderate, preview, or restore encrypted text because
it has no plaintext key. Push notifications contain no message plaintext.

## Current scope

This version encrypts text and image captions sent through
`POST /chat/send-message`. Uploaded image files, attachment URLs, location
payloads, call timeline metadata, and other system events are not yet encrypted.
Old messages already stored as plaintext are not migrated automatically.
