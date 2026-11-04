---
type: Playbook
title: Safety Incident Response
description: Protocol for responding to safety incidents from reporting to closure.
tags: [safety, incident, response]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
---

# Trigger

A safety event is created with eventType INCIDENT or severity HIGH/CRITICAL/FATALITY.

# Steps

1. **Immediate response**: Ensure injured parties receive medical attention. Secure the site area.
2. **Report**: Create safety event in the system with full description, `occurredAt`, `location`, and `involvedParties`.
3. **Investigate**: Transition to UNDER_INVESTIGATION. Assign investigator. Document root cause in `rootCause`.
4. **Determine corrective actions**: If corrective actions are required, transition to CORRECTIVE_ACTION_REQUIRED.
5. **Implement**: Create and assign corrective actions. Track through CORRECTIVE_ACTION_IN_PROGRESS.
6. **Verify**: Each corrective action must be completed and verified by an authorized person.
7. **Close**: Once all corrective actions are VERIFIED, the event automatically closes.

# Regulatory Notifications

FATALITY events require immediate regulatory notification (external to this system). HIGH and CRITICAL events may also have regulatory reporting requirements depending on jurisdiction.

# Agent Role

The compliance agent can report on open incidents, severity distribution, and events requiring action. It **cannot** investigate, update root cause, or close events.

See [safety-events](/tables/safety-events.md) for schema details.
