# CareBridge Companion — WV Baseline Policy Profile
**Purpose:** Establish consistent privacy, safety, and safeguarding defaults for CareBridge Companion in West Virginia youth group living facilities.

**Last Updated:** March 2, 2026 | **Status:** Current

---

## 1) System Scope & Boundaries (Non-Negotiables)
- **Youth ↔ Companion only.** No staff member can message any youth through the system.
- CareBridge Companion **supports care**; it does not replace clinical judgment or crisis services.
- Facility defines alert recipients and response expectations.
- System design centers on Diversity, Equity, and Inclusion (see [DEI_FRAMEWORK.md](DEI_FRAMEWORK.md))

---

## 2) Access Model (Minimum Necessary by Default)
**Default view for staff/therapists: BRIEFINGS ONLY.**
- Staff and therapists view time-bounded **briefings** (e.g., last 24h / last 7d)
- Briefings are designed to provide **minimum necessary** information for care coordination
- Briefings respect identity privacy (identity information only included if relevant to safety)

**Full Chat Transcripts (Break-Glass Access)**
- Available only for emergency investigations by authorized safeguarding staff
- **Authorization:** Admin and safeguarding roles only
- **Requirements:**
  - Documented reason (10-500 characters)
  - Optional additional justification
  - Automatic audit logging with timestamp, IP, staff ID
- **Process:** Safeguarding lead reviews access appropriateness quarterly
- **Monitoring:** Pattern review to prevent bias or targeting of specific youth/demographics

---

## 3) Safety Alerts (Youth Safety)
Safety alerts are triggered by youth messages that indicate potential harm (e.g., self-harm risk, abuse indicators, imminent danger language).

**Facility must configure:**
- Primary recipients (e.g., on-call clinician, shift supervisor)
- Backup recipients and escalation ladder
- Acknowledgement and response time expectations (SLA)
- Documentation requirements ("action taken" note)
- Alert thresholds appropriate to facility culture (facility-defined, not system-imposed)

---

## 4) Safeguarding Alerts (Insider Risk / Misuse Prevention)
Because staff cannot message youth inside the system, safeguarding focuses on **access accountability**.

**Safeguarding alerts are sent to the facility-chosen safeguarding lead/supervisor** when suspicious access behavior is detected, such as:
- Access attempts outside assigned roles/caseload
- Repeated viewing of the same youth without documented care need
- After-hours access patterns (facility-defined)
- Break-glass transcript access (all accesses logged and monitored)
- Role/permission changes
- Patterns suggesting bias or targeting of specific demographics

**Quarterly Safeguarding Review** should include:
- Break-glass access log review (appropriateness, documentation)
- Alert pattern review (are specific youth/demographics disproportionately flagged?)
- Facility responds to any concerns identified

---

## 5) Auditability & Accountability (Required Controls)
CareBridge Companion maintains an audit trail that can answer:
- Who accessed what (staff ID, name, role)
- When access occurred (timestamp, IP address)
- Whether access was appropriate (assigned role verification)
- Whether elevated access was used (break-glass transcript access)
- What actions were taken after alerts (documented in incident/investigation record)

**Audit Retention:** Minimum 1-2 years (per HIPAA, GDPR, local regulations)

---

## 6) Privacy & Identity-Sensitive Information

### LGBTQ+ Youth Privacy
- Briefings should minimize unnecessary personal details
- LGBTQ+ identity disclosures included only when relevant to safety/care
- Facility can configure to exclude identity info from briefings (for youth in unsupportive environments)
- Staff trained to use chosen names and pronouns consistently

### All Youth Identity Privacy
- Briefings respect religious, cultural, family structure, disability, and socioeconomic identity
- System uses "minimum necessary" principle for all identity-sensitive information
- Facility leadership and safeguarding team verify that identity information shared is actually necessary

### Data Protection
- All stored data encrypted (AES-256)
- PII masked in logs and system messages
- Access logs protect youth privacy while ensuring staff accountability

---

## 7) DEI Framework (Diversity, Equity, and Inclusion)
CareBridge Companion is designed with commitment to creating safe, affirming space for **all** youth:

**Diversity** — System supports youth of all identities (LGBTQ+, cultural/religious backgrounds, disabilities, socioeconomic situations)

**Equity** — 
- Equal access (no cost barriers, available 24/7)
- Responsive care (briefings summarize patterns consistently, reducing inequity from under-staffing)
- Bias monitoring (facility reviews alert patterns quarterly for discrimination)

**Inclusion** — 
- Identity-affirming language in companion responses
- Privacy protections prevent outing or exposing sensitive identity information
- Safeguarding processes prevent staff targeting or harassment of specific youth

**See [DEI_FRAMEWORK.md](DEI_FRAMEWORK.md) for complete framework and implementation guidance.**

---

## 8) Implementation Checklist (WV Baseline)
### Before Go-Live
- [ ] Briefings-only access enabled for staff/therapists (default)
- [ ] Break-glass authorized roles configured (admin/safeguarding staff)
- [ ] Safety alert recipients configured
- [ ] Safeguarding alert recipients configured (safeguarding lead/supervisor)
- [ ] Response SLAs defined and trained
- [ ] Staff trained on: alert response, documentation, and privacy boundaries
- [ ] LGBTQ+ affirming practices training completed
- [ ] Data retention policy documented

### Ongoing (Quarterly)
- [ ] Break-glass access audit log reviewed
- [ ] Alert patterns reviewed for bias/targeting
- [ ] Safeguarding team assesses appropriateness of accesses
- [ ] Staff training reinforcement on affirming language and confidentiality

### Annual
- [ ] Full security and safeguarding audit
- [ ] DEI framework effectiveness assessed
- [ ] Policy updates based on findings and best practices
- [ ] Facility considers feedback from youth/families

---

## Related Documents

- [DEI_FRAMEWORK.md](DEI_FRAMEWORK.md) — Complete diversity, equity, inclusion framework
- [LGBTQ_AFFIRMING_POLICY.md](LGBTQ_AFFIRMING_POLICY.md) — Specific commitments to LGBTQ+ youth
- [SAFEGUARDING_MONITORING.md](SAFEGUARDING_MONITORING.md) — Complete safeguarding procedures and break-glass monitoring
- [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) — Technical security features (encryption, audit logging, break-glass)
- [WV_ALERT_RESPONSE_SOP.md](WV_ALERT_RESPONSE_SOP.md) — Step-by-step alert response procedures

---

**Version:** 2.0 | **Effective:** March 2, 2026  
**Next Review:** March 2, 2027

*This policy profile supports facility governance and consistent operations. Legal/compliance review is recommended for final adoption.*