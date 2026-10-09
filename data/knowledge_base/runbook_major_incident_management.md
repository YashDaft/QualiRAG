# Major Incident Management Runbook

Document ID: ITSM-RB-004 | Version: 2.3 | Effective date: 2026-02-01
Owner: IT Service Management | Audience: IT Service Desk and IT operations teams
Classification: Internal

## 1. Purpose
This runbook describes how the IT Service Desk and the IT operations teams identify, declare, coordinate and close a major incident. Its goal is to restore service quickly and keep the business informed while the incident is worked.

## 2. What counts as a major incident
An incident is treated as a major incident when any of the following apply:
- It is a P1, as defined in the Ticket Priority section of the IT Service Desk Runbook.
- It is a P2 that affects more than 10 stores at the same time.
- It is a P2 that is expected to exceed its resolution target in the IT Service Level Policy.
- The Security Operations Center rates a security incident as critical.

A useful early warning sign is three or more similar tickets within 15 minutes. When that happens, the service desk analyst checks the service status dashboard and contacts the on-call Major Incident Manager.

## 3. Roles
- Major Incident Manager (MIM): coordinates the response, owns communications and decides when the incident is resolved. The MIM is on call 24 hours a day on a weekly rota.
- Technical Lead: leads the technical investigation and the fix.
- Communications Lead: writes updates for affected users. For company-wide incidents, Internal Communications takes this role.
- Service Desk Lead: links incoming tickets to the incident and keeps the service desk informed.

## 4. Declaring a major incident
1. The service desk analyst raises or identifies the incident and pages the on-call MIM through the paging tool.
2. The MIM acknowledges the page within 10 minutes.
3. The MIM opens a bridge call and an incident chat channel and invites the Technical Lead.
4. The status page is updated within 15 minutes of the incident being declared.
5. The Service Desk Lead updates the phone greeting so that callers hear about the known issue.

## 5. Communication cadence
- P1 incidents: updates every 30 minutes to stakeholders and on the status page.
- Major P2 incidents: updates every 60 minutes.
- Every update states what is affected, what is being done and when the next update will be sent, even if there is no news.

## 6. Working the incident
- Link every related ticket to the master incident. Do not troubleshoot individual users while a major incident is open, and do not ask users to reinstall software.
- Emergency changes needed to restore service are approved verbally by the MIM and the Technical Lead, and recorded in the change system afterwards.
- Keep a timeline in the incident channel of every action, who took it and when.

## 7. Escalation
If there has been no technical progress for 60 minutes, the MIM escalates to the Head of IT Operations. If a P1 incident lasts longer than 2 hours, the Chief Information Officer is informed.

## 8. Resolution and closure
After the fix, the service is monitored for 30 minutes before the incident is marked resolved. The MIM sends a final update, and the linked tickets are closed with a note. A post-incident review is held within 5 business days to find the root cause and agree follow-up actions, which are tracked to completion.
