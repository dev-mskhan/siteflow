---
type: Playbook
title: Permit Expiry Management
description: Workflow for managing permits approaching their expiry date.
tags: [compliance, permit, expiry]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
---

# Trigger

A permit is in status ACTIVE or ISSUED and its `expiryDate` is within 30 days.

# Steps

1. **Identify expiring permits**: Use the expiring items endpoint to list permits expiring within 30 days.
2. **Review renewal requirements**: Determine if renewal, re-application, or new permit is required.
3. **Contact issuing authority**: Initiate renewal with the authority listed in `issuingAuthority`.
4. **Update permit record**: Once renewed, update the permit with the new `expiryDate` and `referenceNumber`.
5. **Verify status**: Transition permit back to APPLIED or ISSUED as appropriate.

# Agent Role

The compliance agent can identify expiring permits and report on which require attention. It **cannot** transition permit status — that requires an authorized human action.

See [permits](/tables/permits.md) for state machine details.
