# Security Specification - Reels King

## Data Invariants
1. **User Identity Binding**: A user document must have a `uid` that strictly matches the Firebase Auth `request.auth.uid`.
2. **Video Ownership**: A video can only be created with a `userId` that matches the authenticated user's UID.
3. **Comment Integrity**: Comments must be linked to a valid video and the author must be the authenticated user.
4. **Follow Constraints**: A user cannot follow themselves, and the `followerId` must match the authenticated user.
5. **Admin Lockdown**: Sensitive fields like `walletBalance`, `role`, and `policyViolations` can only be modified by admins or via specific trusted system transitions (if implemented).
6. **Immutable Fields**: `createdAt`, `uid`, and `mobile` should remain unchanged after creation.

## The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing (User)**: Create a user document with a different `userId` than the authenticated one.
2. **Privilege Escalation**: Update own user document to set `role: 'admin'`.
3. **Wallet Injection**: Update own user document to increase `walletBalance`.
4. **Phantom Video**: Create a video with someone else's `userId`.
5. **Shadow Update (Video)**: Update a video to change its `userId` to a different user.
6. **Orphan Comment**: Create a comment for a video that doesn't exist (relational check).
7. **Malicious ID Poisoning**: Attempt to create a document with a 1MB string as the ID.
8. **PII Leak**: An unauthenticated user attempts to read private user fields (if any).
9. **Spam Follow**: Create a follow relationship where `followerId` is not the current user.
10. **State Shortcut**: Transition a `withdrawal_request` from `pending` to `completed` as a regular user.
11. **SuperChat Hijack**: Create a SuperChat where `senderId` is not the current user.
12. **Notification Spam**: Create a notification for another user without being an authenticated participant in a related action.

## Test Runner Plan
We will use `firestore.rules.test.ts` to verify these invariants using the Firebase Emulator (simulated in tests).
