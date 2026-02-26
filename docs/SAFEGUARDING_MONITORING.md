# Safeguarding Monitoring (Access-Based)

Because CareBridge Companion does **not** allow staff to message youth, safeguarding focuses on preventing and detecting misuse of sensitive information.

## Goals
- Enforce least-privilege access.
- Provide strong accountability via audit logs.
- Detect suspicious access patterns early and alert facility-chosen safeguarding recipients.

## What to monitor
- Viewing youth profiles and briefings
- Viewing incident logs
- Any transcript access (if enabled later)
- Export/download attempts (if enabled)
- Role/permission changes

## Example alert rules
- Unassigned access attempt
- Repeated access to same youth without care need
- After-hours access spikes
- Bulk access across many youth records
- Break-glass usage (if transcripts enabled later)

## Alert routing
Safeguarding alerts are routed to the facility-chosen safeguarding lead/supervisor.

## Audit logging requirements
Log: actor, target youth, action, timestamp, device/session identifiers, and reason (if break-glass).