# Safeguarding Monitoring & Accountability

**Last Updated:** March 2, 2026 | **Status:** Fully Implemented

Because CareBridge Companion does **not** allow staff to message youth, safeguarding focuses on preventing and detecting misuse of sensitive information and ensuring accountability for all access.

## Goals
- Enforce least-privilege access
- Provide strong accountability via comprehensive audit logs
- Detect suspicious access patterns early and alert facility-chosen safeguarding recipients
- Ensure emergency access authority is properly documented and reviewed

## What to Monitor

### Routine Access
- Viewing youth profiles and briefings
- Viewing incident logs
- Search queries and filters applied
- Staff role/permission assignments

### Emergency Access (Break-Glass)
- Full conversation transcript access (authorized staff only)
- Audit log reviews by safeguarding lead
- Access reasons and documented justifications
- Patterns suggesting misuse or bias

### System Misuse
- Export/download attempts
- Role/permission changes
- After-hours access spikes
- Bulk access across many youth records
- Repeated access to same youth without documented care need

## Safeguarding Alert Rules

### Medium-Priority Alerts
- Staff accessing youth outside assigned caseload (without authorization)
- Single unassigned access attempt
- Access during off-hours (facility defines hours)

### High-Priority Alerts
- Repeated unassigned access attempts to same youth
- Bulk access across many youth records (>5 in 1 hour)
- Access spikes during nights/weekends
- Break-glass access without proper role

### Critical Alerts
- Multiple staff accessing same youth concurrently without care reason
- Export/download attempts
- Role escalation attempts
- Apparent pattern of targeting specific demographic group (requires safeguarding review)

## Break-Glass Emergency Access (Now Implemented)

### Authorization
- **Authorized Roles:** Admin staff, Safeguarding staff only
- **Required Documentation:** Reason for access (10-500 characters minimum)
- **Optional Context:** Additional justification (max 1000 characters)
- **Scope:** Single conversation access only (no bulk transcript retrieval)

### How It Works
```
1. Safeguarding staff initiates: POST /api/conversations/:sessionId/break-glass-access
2. System validates:
   - Role is admin or safeguarding ✓
   - Reason field is substantive (10+ chars) ✓
   - Token is valid and not expired ✓
3. System logs access:
   - Staff ID, role, timestamp, IP address
   - Reason provided by staff
   - Datetime of access attempt
4. System returns full transcript:
   - All messages with timestamps, sender, analysis
   - Safety flags and concern indicators
   - Conversation summary and staff notes
   - Metadata indicating break-glass access occurred
   - Confidentiality notice and legal basis statement
5. Safeguarding lead reviews audit log
   - Access appropriateness checked
   - Pattern monitoring for bias
   - Documented in facility incident/investigation record
```

### Audit Trail
**Complete log includes:**
- Staff member ID and name
- Staff role (admin/safeguarding)
- Date/time of access
- IP address of access device
- Stated reason for emergency access
- Investigation/incident reference (optional)

### Audit Log Access
**Who can view:** Safeguarding staff only
**Endpoint:** `GET /api/conversations/break-glass/audit-log`
**Filters:**
- Time range (days parameter, default 30)
- Limit results (max 100)
- Pagination offset for large result sets

### DEI Considerations
Break-glass monitoring includes review for:
- **Bias Patterns:** Are specific demographic groups disproportionately accessed?
- **Targeting:** Do patterns suggest a staff member is targeting specific youth?
- **Discrimination:** Is break-glass being used to collect information on LGBTQ+, religiously diverse, or other marginalized youth?

**Recommended Quarterly Review Questions:**
1. Which staff members have used break-glass access?
2. What were the documented reasons?
3. Do patterns show disproportionate access to specific youth or demographics?
4. Were investigation/incident outcomes documented?
5. Did any access appear inappropriate (denied after review)?

## Alert Routing

### Facility Configuration
Facilities customize to local needs:
- **Primary Safeguarding Lead:** Who receives alerts?
- **Escalation Path:** Who is backup if lead unavailable?
- **Response SLA:** How quickly should alerts be reviewed?
- **Documentation:** How are investigations recorded?

### Recommended Alert Recipients
- Safeguarding lead/supervisor
- Facility director (for high-priority alerts)
- HR/personnel (for staff misconduct investigations)
- External oversight (e.g., licensing authority, if required)

## Audit Logging Requirements

### Mandatory Fields
- **Actor:** Staff ID, name, role, position
- **Target Youth:** Youth ID, name (masked in logs if facility prefers)
- **Action:** Type of access (view briefing, search, break-glass, etc.)
- **Timestamp:** Date/time of access
- **Device/Session:** IP address, session ID, browser/client
- **Reason:** If applicable (especially break-glass access reason)

### Retention
- **Minimum:** 1-2 years (per HIPAA, GDPR, state regulations)
- **Facility Determines:** Check local policy and regulations
- **Archive Strategy:** Move old logs to archive storage, delete per policy

### Log Security
- Audit logs themselves are protected (cannot be modified or deleted)
- Stored encrypted in database
- Accessible only to safeguarding and admin staff
- Cannot be exported to external systems without safeguarding approval

## Implementation Checklist

For facilities using CareBridge Companion:

**Setup (Before Go-Live)**
- [ ] Specify which staff roles have break-glass authorization
- [ ] Assign primary and backup safeguarding lead
- [ ] Define alert routing and escalation procedures
- [ ] Document investigation/incident response workflow
- [ ] Set data retention policies
- [ ] Train staff on proper use and confidentiality

**Ongoing (Quarterly)**
- [ ] Review break-glass access audit log
- [ ] Check for unusual access patterns
- [ ] Review for bias (demographic targeting)
- [ ] Verify all investigations were documented
- [ ] Update staff training if needed

**Annual**
- [ ] Full security and safeguarding audit
- [ ] Review DEI framework effectiveness
- [ ] Update policies based on findings and best practices

## Case Examples

### Appropriate Break-Glass Use
- **Investigation of abuse allegation:** Safeguarding reviewing conversation to understand disclosure details
- **Suicide risk assessment:** Clinician accessing full conversation context for hospitalization decision
- **Incident follow-up:** Team reviewing what happened in leadup to serious incident
- **Staff misconduct investigation:** Reviewing conversation if staff improperly accessed youth information

### Inappropriate Break-Glass Use (Red Flags)
- Accessing conversations of youth not assigned to staff member without reason
- Repeated access to same youth without documented care change
- Accessing transcripts "just to see" or from curiosity
- Pattern of accessing specific demographic group's conversations
- Access during off-hours without documented emergency

## Related Documentation

- [DEI_FRAMEWORK.md](DEI_FRAMEWORK.md) — How to prevent discriminatory access patterns
- [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) — Break-glass technical details and tests
- [WV_BASELINE_POLICY_PROFILE.md](WV_BASELINE_POLICY_PROFILE.md) — Regulatory compliance framework
- [LGBTQ_AFFIRMING_POLICY.md](LGBTQ_AFFIRMING_POLICY.md) — Privacy protections for LGBTQ+ youth

---

**Version:** 2.0 | **Effective:** March 2, 2026  
**Next Review:** September 2026