# Firestore Security Specification

## Data Invariants
1. A **User** profile can only be read or written by the owner (UID match).
2. A **ChatSession** can only be accessed (read/write/delete) by the owner (`userId` field matches `request.auth.uid`).
3. **Messages** can only be accessed if the user owns the parent **ChatSession**.
4. `userId` in ChatSession must be immutable after creation.
5. `createdAt` must be immutable and set to `request.time`.
6. `updatedAt` must be updated to `request.time` on every write.

## The "Dirty Dozen" Payloads (Denial Expected)

1. **Identity Spoofing**: Creating a ChatSession with someone else's `userId`.
2. **PII Leak**: Authenticated User A trying to read User B's profile.
3. **Session Hijack**: User A trying to read User B's ChatSession.
4. **Message Injection**: User A trying to add a message to User B's session.
5. **Unauthorized Title Edit**: Non-owner trying to rename a session.
6. **Immutable Field Attack**: Trying to change `userId` of an existing session.
7. **Timestamp Fraud**: Setting `createdAt` to a past or future date.
8. **Resource Poisoning**: Sending a 1MB string as a session title.
9. **Role Escalation**: Trying to set a non-existent `isAdmin` flag on a user profile.
10. **Orphaned Message**: Trying to create a message in a non-existent session (or one the user doesn't own).
11. **Mass Deletion**: Trying to delete someone else's sessions collection.
12. **Junk Data**: Sending an object with unexpected fields to the `users` collection.

## Rules Draft
I will now generate the `firestore.rules` based on these invariants.
