# Fest-Register Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched is strictly denied (`allow read, write: if false`).
2. **Verified Identity**: All write operations require an authenticated and verified user (`request.auth != null && request.auth.token.email_verified == true`).
3. **Path ID Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates path IDs against `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. **PII Split Isolation**: Phone numbers and email addresses are isolated in `/users/{userId}/private/{docId}` and readable/writable strictly by `request.auth.uid == userId`.
5. **Relational Integrity (Master Gate)**:
   - Creating an event requires that the creator profile exists at `/users/$(request.auth.uid)`.
   - Creating a registration under `/events/{eventId}/registrations/{registrationId}` requires that the parent `/events/{eventId}` exists and is in `"running"` status (not terminal `"outdated"` or `"cancelled"`).
6. **Terminal State Locking**: Once an event reaches `status == 'cancelled'` or `status == 'outdated'`, no further updates are permitted.
7. **Strict Key & Size Enforcement**: Every entity validation helper enforces `hasAll` and `hasOnly` key allowlists, string `.size()` bounds matching `firebase-blueprint.json`, immutable `uid`/`creatorId`/`createdAt` fields, and server timestamps (`request.time`).
8. **Query Enforcer (No Blanket List)**: Every `allow list` rule evaluates `resource.data` against `request.auth.uid` without `get()`/`exists()` inside `list`.

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Shadow Field Injection)**: `UserPublic` create payload with extra `isAdmin: true` ghost key -> `PERMISSION_DENIED`.
2. **Payload 2 (Unverified Email Spoof)**: Write attempt with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Payload 3 (Cross-User PII Read)**: User B attempting `get` on `/users/userA/private/info` -> `PERMISSION_DENIED`.
4. **Payload 4 (Identity Spoofing on Event Creation)**: User A creating an event with `creatorId: "userB"` -> `PERMISSION_DENIED`.
5. **Payload 5 (Denial-of-Wallet Oversized String)**: Event `title` with 5,000 characters (exceeding `maxLength: 120`) -> `PERMISSION_DENIED`.
6. **Payload 6 (ID Poisoning)**: Document ID containing spaces/slashes or >128 chars -> `PERMISSION_DENIED`.
7. **Payload 7 (Client Timestamp Forgery)**: Creating a document where `createdAt != request.time` -> `PERMISSION_DENIED`.
8. **Payload 8 (Immutable Field Tampering)**: Updating `createdAt` or `creatorId` on an existing event -> `PERMISSION_DENIED`.
9. **Payload 9 (Terminal State Bypass)**: Updating an event whose existing `status` is `'cancelled'` or `'outdated'` -> `PERMISSION_DENIED`.
10. **Payload 10 (Orphaned Subcollection Write)**: Creating a registration under a non-existent `/events/{eventId}` -> `PERMISSION_DENIED`.
11. **Payload 11 (Value Poisoning on Update)**: Updating an allowed field (`title`) with a boolean or number instead of a bounded string -> `PERMISSION_DENIED`.
12. **Payload 12 (Blanket List Scraping)**: Listing `/notifications` or `/favourites` where `resource.data.userId != request.auth.uid` -> `PERMISSION_DENIED`.
