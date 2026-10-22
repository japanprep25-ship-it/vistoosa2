# Security Specification: Orders Collection

## 1. Data Invariants
- An order must have a unique ID, customer name, phone number, status, and total amount.
- Order status must be one of: 'Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled', 'Return', 'Paid Return'.
- Users accessing orders must be authenticated and verified.

## 2. The "Dirty Dozen" Payloads (Examples to break security)
1. { id: 'VIS-001', customerName: 'Test', phone: '017', status: 'Pending', totalAmount: 100 } // Invalid phone
2. { id: 'VIS-001', customerName: 'Test', phone: '01700000000', status: 'InvalidStatus', totalAmount: 100 } // Invalid status
3. { id: 'VIS-001', customerName: 'Test', phone: '01700000000', status: 'Pending' } // Missing totalAmount
4. { id: 'VIS-001', customerName: 'Test', phone: '01700000000', status: 'Pending', totalAmount: '100' } // Invalid totalAmount type
5. { id: 'VIS-001', customerName: 'Test', phone: '01700000000', status: 'Pending', totalAmount: 100, ghostField: true } // Shadow field

## 3. Conflict Report
- Identity Spoofing: Prevented by validating that crucial fields are not set by users if restricted.
- State Shortcutting: Prevented by status transition logic.
- Resource Poisoning: Prevented by size limits on strings.
- Value Poisoning: Prevented by schema validation helpers.
