# OSC Readiness Checklist for CareBridge Companion

This checklist is tailored to CareBridge Companion against Open Source Collective (OSC) acceptance criteria for open source software projects.

Use it as a pre-application gate. If any item marked "Required before applying" is incomplete, expect manual review at best and likely rejection until it is addressed.

Last reviewed: 2026-05-11

---

## Current Snapshot

### Likely status today

| Area | Status | Notes |
|---|---|---|
| Open source license | Yes | MIT is present in the root license file and package metadata. |
| Recent development activity | Yes | Recent commits exist and the repository is active. |
| Clear open source repository | Yes | Public GitHub repository with source, tests, and docs. |
| Organizational ownership | No | Repository is hosted under a personal GitHub account, not an organization. |
| Multi-maintainer governance | No | Public history shows one visible maintainer. |
| Public contributor health files | Yes | Top-level contributing, conduct, governance, and security files are now present. |
| Consistent project maturity messaging | Yes | README now uses consistent pilot-stage language. |

### Required before applying

- [ ] Move the repository from the personal account to a GitHub organization.
- [ ] Identify at least two maintainers/admins for project continuity.
- [x] Add top-level `CONTRIBUTING.md`.
- [x] Add top-level `CODE_OF_CONDUCT.md`.
- [x] Add top-level `GOVERNANCE.md` or `MAINTAINERS.md` with decision-making and succession details.
- [x] Reconcile contradictory README status statements so reviewers see one accurate maturity description.

---

## 1. Legitimacy

OSC looks for an original project with active development, real use or meaningful impact, and an applicant who is clearly authorized to represent it.

### Required checks

- [ ] Confirm CareBridge Companion is original software or clearly document how it is a substantial fork.
- [ ] Keep public development activity visible: commits, issues, pull requests, releases, and roadmap updates.
- [ ] Show that the applicant is a maintainer or project lead with authority to represent the project.
- [ ] Prepare a short impact statement that explains who uses the project, what problem it solves, and why fiscal hosting is needed.

### Project-specific evidence to strengthen

- [ ] Add GitHub Releases so project progress is legible to external reviewers.
- [ ] Open and maintain a small set of public issues for roadmap, bugs, and documentation work.
- [ ] Document any pilot deployments, demos, evaluator feedback, or adopter interest.
- [ ] Publish a lightweight public roadmap with near-term milestones.
- [ ] If possible, bring in at least one additional regular maintainer or reviewer.

### Suggested evidence packet for this repo

- [ ] One paragraph describing the mission: youth-support companion for residential care settings with privacy-first local deployment.
- [ ] One paragraph describing why the software is open source and how other facilities or contributors could benefit.
- [ ] One paragraph describing current maturity honestly: pilot-stage, active testing, not yet production-certified.
- [ ] Links to core technical docs already in this repository, especially architecture, security, safeguarding, and development setup.

---

## 2. License

OSC requires an open source license that clearly permits use, modification, and redistribution.

### Current status

- [x] Root `LICENSE` file exists and uses MIT.
- [x] `package.json` license field is set to MIT.

### Final checks before applying

- [ ] Confirm no part of the repository introduces a conflicting non-open license.
- [ ] Verify third-party assets, documentation content, and bundled files are compatible with the project license.
- [x] Add a brief note in the README clarifying that contributions are accepted under the repository license, if desired.

### Nice-to-have

- [ ] Add a dependency license audit to CI or release review process.

---

## 3. Governance and Autonomy

This is the area most likely to block OSC approval for this project in its current state.

### Required before applying

- [ ] Host the project under a GitHub organization, not a personal account.
- [ ] Define who the maintainers are and what authority they hold.
- [ ] Ensure at least two people can administer the Open Collective if the application is approved.
- [ ] Publish a decision-making process for technical, policy, and operational changes.
- [ ] Publish a basic succession or continuity plan in case the current lead becomes unavailable.

### Repository health files to add

- [x] `CONTRIBUTING.md`
- [x] `CODE_OF_CONDUCT.md`
- [x] `GOVERNANCE.md` or `MAINTAINERS.md`
- [x] `SECURITY.md`
- [x] Issue templates and pull request template in `.github/` (recommended)

### Tailored notes for CareBridge Companion

- [x] Promote the existing contribution guidance out of `docs/DEVELOPMENT.md` into a top-level `CONTRIBUTING.md`.
- [x] Write governance in plain terms: who can merge, who can cut releases, who can approve policy-sensitive changes, and how disputes are resolved.
- [x] Because this project touches youth safety and safeguarding workflows, document how high-risk changes are reviewed.
- [x] Clarify what decisions are community/project decisions versus deployment decisions left to each facility.

---

## 4. Public Project Presentation

Even if OSC's formal criteria are met, weak or inconsistent presentation can slow review.

### Required cleanup

- [x] Remove contradictory maturity claims from the README.
- [ ] Choose one consistent project status statement and repeat it across docs.
- [ ] Make the README clearly point to architecture, security, safeguarding, and contributor docs.
- [ ] Ensure installation and demo instructions work exactly as written.

### Recommended improvements

- [ ] Add a "Project Status" section that distinguishes pilot readiness from production readiness.
- [ ] Add a "Who Maintains This" section with maintainers and contact path.
- [ ] Add a short "Why Open Source" section.
- [ ] Add badges for license, test status, and latest release once those signals exist.

---

## 5. Application Packet Preparation

Prepare these materials before submitting to OSC.

- [ ] Short project summary in 2 to 4 sentences.
- [ ] Link to the public source repository.
- [ ] Link to the license.
- [ ] Link to contributing guidelines.
- [ ] Link to code of conduct.
- [ ] Link to governance or maintainers document.
- [ ] Names of at least two admins for Open Collective management.
- [ ] Evidence of active development.
- [ ] Evidence of impact, pilots, users, or community interest.
- [ ] Clear explanation of why fiscal hosting is needed now.

### Suggested project summary draft

CareBridge Companion is an open source, privacy-first check-in companion designed for youth in residential care settings. It helps facilities support youth with empathetic conversations, safeguarding alerts, and staff briefings while keeping deployment and data control local to the facility. The project is currently a pilot-stage working prototype in active testing and documentation hardening.

---

## 6. Recommended Order of Work

Use this sequence to improve the odds of a clean OSC review.

1. Create a GitHub organization and transfer the repository.
2. Name at least two maintainers/admins and document roles.
3. Add top-level governance, contributing, code of conduct, and security files.
4. Fix README status inconsistencies and tighten project messaging.
5. Add releases, roadmap issues, and a small amount of public maintenance workflow.
6. Assemble the application packet with links and evidence.
7. Apply through GitHub verification if the repository clearly meets the criteria.

---

## 7. Go / No-Go Gate

Do not apply yet if any of these are still true:

- [ ] The repository is still under a personal GitHub account.
- [ ] Only one maintainer can credibly operate the project.
- [ ] There is no public code of conduct or governance document.
- [ ] The README still contradicts itself about project maturity.
- [ ] You cannot point to any public evidence of project activity or external interest.

You are likely ready for application when all of these are true:

- [ ] Repository ownership is organizational.
- [ ] Governance and contributor health files are public and clear.
- [ ] License and project status are consistent.
- [ ] Two or more admins can manage the collective.
- [ ] Public activity and project purpose are easy for a reviewer to verify in under five minutes.