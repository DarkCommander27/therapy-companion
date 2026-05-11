# Governance

## Current Project Stage

CareBridge Companion is currently a pilot-stage open source project in active testing and documentation hardening. Governance is intentionally lightweight, but decision-making still needs to be explicit because the project affects sensitive safeguarding and privacy workflows.

## Governance Goals

This governance model is designed to:

- Keep the project maintainable and open to contribution
- Preserve clear accountability for sensitive decisions
- Protect youth safety, privacy, and dignity
- Support continuity if a current maintainer becomes unavailable

## Roles

### Maintainers

Maintainers are responsible for the overall direction and integrity of the project.

Maintainers may:

- Triage issues and pull requests
- Review and merge code and documentation changes
- Create releases
- Update policies and governance documents
- Make final decisions when consensus is not reached

Maintainers are also responsible for protecting the project's scope boundaries, including its safeguarding and privacy commitments.

### Reviewers

Reviewers are trusted contributors who regularly help evaluate changes. They may not have full administrative authority, but their review is part of the decision process for changes in areas they know well.

### Contributors

Contributors may propose changes through issues, pull requests, and documentation updates. Contributions are welcome, but merge authority remains with maintainers.

## Decision-Making

The default decision process is:

1. Discuss the proposed change in an issue or pull request.
2. Seek a technically sound approach that fits project scope and documented safety boundaries.
3. Prefer rough consensus when practical.
4. If consensus is unclear, a maintainer decides.

Maintainers may decline a proposal even when it is technically feasible if it creates unacceptable risk for privacy, safeguarding, bias, or misuse.

## Changes Requiring Elevated Review

The following changes require explicit maintainer review and should not be merged casually:

- Authentication and authorization changes
- Break-glass access behavior
- Audit logging and monitoring behavior
- Data retention, deletion, masking, or export behavior
- Safety alert logic or escalation behavior
- Youth-facing conversation policies or response constraints
- Changes likely to affect marginalized youth differently, including LGBTQ+ youth
- Legal, compliance, or operator policy documentation

For these changes, maintainers should look for:

- Clear problem statement
- Risk analysis
- Test coverage or validation evidence
- Documentation updates where applicable

## Releases

Maintainers are responsible for deciding when the project is ready for tagged releases. Until the project matures further, releases may remain infrequent and tied to meaningful documentation, security, or feature milestones rather than a fixed cadence.

## Maintainer Changes And Continuity

The project should aim to have at least two maintainers with enough repository access to keep work moving, review security or governance issues, and manage community operations.

When adding a maintainer, the existing maintainers should consider:

- Sustained constructive contribution history
- Sound judgment on safety, privacy, and scope boundaries
- Ability to review changes carefully and communicate clearly
- Willingness to uphold the code of conduct and governance model

If a maintainer becomes unavailable, the remaining maintainers should continue routine project operations and document any role changes publicly in the repository.

## Operational And Deployment Boundaries

This repository governs the open source software project itself. Individual facilities remain responsible for their own deployment choices, staffing policies, incident response, and local legal compliance.

The project may provide defaults and documentation, but deployment operators are responsible for deciding how to configure and use the software in their own environment.

## Transparency

Project decisions should be made in public GitHub issues and pull requests whenever practical. Private discussion may be necessary for security reports, sensitive abuse scenarios, or other situations where public discussion would create risk.

## Amendments

Maintainers may update this governance document as the project matures. Significant governance changes should be made in a pull request with a short rationale.