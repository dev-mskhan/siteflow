---
type: Reference
title: Construction Glossary
description: Key construction and SiteFlow platform terminology used in agent responses.
tags: [glossary, terminology]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Financial Terms

- **BOQ (Bill of Quantities)**: A document listing all work items with quantities and rates used for pricing.
- **Committed cost**: Total of actual costs plus open purchase orders and active subcontracts.
- **Cost code**: A project-specific code used to categorize costs (e.g. "03.21.10 — Rebar").
- **Retainage**: A percentage withheld from progress payments until milestones are met.
- **Variation / Change order**: A formal change to the contract scope, price, or time.
- **Payment application**: A formal request for payment submitted by a contractor.

# Scheduling Terms

- **CPM (Critical Path Method)**: A scheduling technique identifying the longest path of dependent tasks.
- **Critical path**: The sequence of tasks that determines the minimum project duration.
- **Float (slack)**: The amount of time a task can be delayed without delaying the project.
- **Baseline schedule**: The original approved schedule used as a reference for progress tracking.
- **Earned value**: The budgeted cost of work performed, used to measure schedule and cost performance.

# Quality and Compliance Terms

- **Deficiency**: A non-conformance found during a quality inspection.
- **Corrective action**: A specific action taken to resolve a deficiency.
- **RFI (Request for Information)**: A formal question from contractor to designer seeking clarification.
- **Submittal**: A document (shop drawing, product data) submitted for designer review.
- **NCR (Non-Conformance Report)**: Formal record of a deficiency; equivalent to a deficiency in SiteFlow.

# Safety Terms

- **Near miss**: An event that did not cause injury or damage but had the potential to do so.
- **LTIFR (Lost Time Injury Frequency Rate)**: Number of lost-time injuries per million hours worked.
- **Toolbox talk**: A brief informal safety meeting held on-site before work begins.
- **SWMS (Safe Work Method Statement)**: A document describing hazards and controls for high-risk work.

# SiteFlow Platform Terms

- **Project cost codes**: Free-text codes defined per project to categorize costs. See [project-cost-codes](/tables/project-cost-codes.md).
- **Takeoff**: Quantity measurement taken from drawings, linked to document pages.
- **Agent run**: A single execution of an AI agent processing one user question.
- **Trace ID**: The unique identifier for a Langfuse trace, equal to the agent run ID.
