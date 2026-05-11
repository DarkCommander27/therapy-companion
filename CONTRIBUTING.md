# Contributing to CareBridge Companion

Thank you for contributing to CareBridge Companion.

This project is an open source, privacy-first check-in companion for youth in residential care settings. Contributions should improve safety, clarity, maintainability, privacy, and operational usefulness for care teams without expanding the product beyond its stated boundaries.

## Project Boundaries

Contributions should respect these core boundaries:

- CareBridge Companion is not therapy, diagnosis, or a crisis hotline.
- Staff do not message youth inside the system.
- Safeguarding, privacy, and accountability requirements take priority over convenience.
- Facility-specific deployment choices should remain configurable rather than hard-coded when practical.
- Changes that affect youth safety, alerting, access control, or auditability require extra care.

## Before You Start

Please review the project context before opening a pull request:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/SAFEGUARDING_MONITORING.md`
- `docs/SECURITY_IMPLEMENTATION.md`
- `CODE_OF_CONDUCT.md`
- `GOVERNANCE.md`

If your change affects affirming language, access patterns, or safeguarding workflows, also review the policy documents in `docs/` that cover those areas.

## What To Contribute

Helpful contributions include:

- Bug fixes
- Tests for existing behavior
- Documentation improvements
- Security hardening
- Accessibility improvements
- Deployment and operations guidance
- Improvements to privacy-preserving local inference workflows

Changes are less likely to be accepted if they:

- Expand the system into clinical diagnosis or therapy claims
- Add staff-to-youth messaging
- Reduce auditability, logging integrity, or access controls
- Introduce unnecessary collection, retention, or exposure of sensitive data
- Add major scope without a documented rationale

## Development Setup

1. Fork the repository.
2. Create a branch for your work.
3. Install dependencies with `npm install`.
4. Create a local environment file from `.env.example`.
5. Run the app in development mode with `npm run dev` or the scripted demo with `npm run demo`.

For a fuller walkthrough, see `docs/DEVELOPMENT.md`.

## Making Changes

Keep changes focused and explain the reason for the change clearly.

When practical:

- Add or update tests for behavior changes.
- Update documentation when user-facing behavior, setup steps, or operational expectations change.
- Prefer small pull requests with a single clear goal.
- Preserve existing project terminology and safety boundaries.
- Avoid unrelated refactors in the same pull request.

## Safety-Sensitive Changes

The following areas are considered safety-sensitive and may receive slower, stricter review:

- Risk detection and safety alerts
- Authentication, authorization, or break-glass access
- Audit logging and monitoring
- Data retention, deletion, or export behavior
- Conversation handling that affects youth-facing language or escalation guidance
- LGBTQ+ affirming behavior and other protected-characteristic-sensitive content

For these changes, include a short note in the pull request describing:

- What risk the change addresses or introduces
- How the behavior was validated
- Whether docs, policies, or operator guidance were updated

## Pull Request Checklist

Before opening a pull request, please confirm:

- [ ] The change is scoped to one main purpose.
- [ ] Tests pass locally with `npm test`.
- [ ] Linting passes locally with `npm run lint`, if your change touches linted files.
- [ ] Documentation was updated if needed.
- [ ] New behavior is covered by tests when practical.
- [ ] Safety-sensitive impacts are explained in the pull request description.
- [ ] No secrets, credentials, or real youth data were added to the repository.

## Commit and Pull Request Guidance

- Use clear commit messages.
- Describe the problem being solved, not just the code change.
- Link related issues when they exist.
- Include screenshots only when they help explain UI changes and contain no sensitive information.

## Reporting Security Issues

Do not open a public issue for vulnerabilities that could expose sensitive youth, staff, or facility data.

For security reporting instructions, see `SECURITY.md`.

## Contributor Conduct

By participating in this project, you agree to follow `CODE_OF_CONDUCT.md`.

## Questions

If you are unsure whether a change fits the project scope, open an issue before investing in a large implementation.