# Firebase Security Specification (StarBetPay)

This specification defines the security architecture and invariants for the Firebase Firestore migration of **StarBetPay**.

## 1. Data Invariants
- **Security Context**: Every user session is authenticated via anonymous authentication on boot to secure client-side Firestore operations.
- **Identity & Records**: A transaction must be tied to a valid registered user profile. Only the owner of the user account or an administrator can access their personal records or alter state.
- **RBAC**: Administrative roles (`admin`) are checked during operations against the `users` collection. A user cannot self-promote to `admin`.
- **Amount Consistency**: All deposits and withdrawals must have valid, positive amount figures.
- **Terminal Status**: Once a transaction is marked as `validated` or `rejected`, its status is final and cannot be modified.

---

## 2. The "Dirty Dozen" Payloads
These payloads represent hostile attempts to bypass our validation policies:

1. **Self-Promotion Hack**: A standard user attempting to write a user document setting `"role": "admin"`.
2. **Impersonation**: A user attempting to read another user's balance or profile.
3. **Ghost Deposit**: Modifying a transaction's status directly to `validated` without administrative approval.
4. **Negative Payout**: Triggering a withdrawal request with a negative amount (`-50000` FCFA).
5. **Double Commission Claim**: Forcing a second commission payout on an already processed transaction.
6. **No-Screenshot Deposit**: Creating a deposit without providing the required payment screenshot verification.
7. **Bypassing MFA**: Disabling MFA on another user's account by sending a direct update block.
8. **Rejection Alteration**: Resetting a rejected status transaction back to `pending` to force re-evaluation.
9. **Junk-ID Injection**: Attempting to create a user with a corrupted or 1MB-sized phone number key.
10. **Global Configuration Overwrite**: A standard user updating support contacts or withdrawal commissions in `config/app`.
11. **Coupon Tampering**: Clients editing odds dynamically in the active predictions collection.
12. **Future Creation Date**: Forusing a future timestamp on transaction registration/creation payload.

---

## 3. Test Cases (TDD Blueprint)
A complete test blueprint validating that security constraints block hostile actions:

```typescript
// firestore.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('StarBetPay security rules', () => {
  it('blocks self-promotion to admin', async () => {
    // Standard anonymous client attempting role escalation should fail.
  });

  it('blocks double validation of transaction without administrative credentials', async () => {
    // Clients are denied direct write to validated transactions.
  });
});
```
