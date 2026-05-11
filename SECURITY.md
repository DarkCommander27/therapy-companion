# Security Policy

## Scope

CareBridge Companion handles sensitive workflows related to youth support, staff access, and safeguarding. Security issues should be reported responsibly and should not be disclosed publicly before maintainers have had a reasonable chance to assess and address them.

## Supported Project State

This repository is currently a pilot-stage project in active testing. Security fixes are handled on a best-effort basis for the default branch.

At this stage:

- The default branch is the primary supported code line.
- There is no promise of patch releases for older snapshots.
- High-severity issues affecting confidentiality, integrity, or access control are the highest priority.

## What To Report Privately

Please report privately if you discover issues involving:

- Authentication or authorization bypass
- Break-glass access misuse or privilege escalation
- Sensitive data exposure
- Audit log tampering or deletion risk
- Injection vulnerabilities, including XSS or NoSQL injection
- Secrets exposure
- Insecure defaults that could materially affect real deployments

Do not post exploit details, proof-of-concept payloads, or sensitive screenshots in a public issue when they could expose data or make exploitation easier.

## How To Report

Use GitHub private vulnerability reporting for this repository if it is enabled.

If private vulnerability reporting is not available, contact the repository owner through GitHub and clearly label the report as a security issue.

Please include:

- A short summary of the issue
- Affected files, endpoints, or features
- Steps to reproduce
- Expected impact
- Any suggested remediation, if you have one

If the issue involves possible exposure of youth, staff, or facility data, say that explicitly in the report.

## Response Expectations

Maintainers will try to:

- Acknowledge receipt of a report in a reasonable timeframe
- Reproduce and assess the issue
- Decide whether the issue requires immediate mitigation, a code fix, documentation changes, or deployment guidance
- Coordinate a responsible disclosure path when appropriate

Because the project is still pilot-stage, response timing may vary based on severity and maintainer availability.

## Public Disclosure

Please wait for maintainer guidance before publicly disclosing a vulnerability.

For lower-risk issues that do not expose sensitive information or enable meaningful exploitation, maintainers may decide that a normal public issue is sufficient. When in doubt, report privately first.

## Security Practices In This Repository

This project already includes work and documentation related to:

- Input sanitization
- Security headers
- Encryption utilities
- Authentication controls
- Break-glass access controls and audit logging
- Security-focused tests and integration coverage

For additional background, see:

- `docs/SECURITY_IMPLEMENTATION.md`
- `docs/SAFEGUARDING_MONITORING.md`

## Safe Testing Expectations

When testing security issues:

- Do not use real youth, staff, or facility data.
- Do not target systems you do not own or have permission to test.
- Avoid disruptive testing against shared or live environments.
- Keep proof-of-concept examples minimal and responsible.

## Non-Security Bugs

For ordinary defects, feature requests, or documentation problems that do not create a security risk, use the normal public issue tracker.