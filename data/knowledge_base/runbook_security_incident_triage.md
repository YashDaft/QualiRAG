# Security Incident Triage Runbook for the Service Desk

Document ID: SEC-RB-002 | Version: 2.0 | Effective date: 2026-04-20
Owner: Security Operations Center (SOC) | Audience: IT Service Desk
Classification: Internal

## 1. Purpose
The IT Service Desk is often the first to hear about a security incident. This runbook explains how to recognise one, take the first safe steps and hand it to the Security Operations Center (SOC), which is staffed 24 hours a day.

## 2. Triage categories

| Situation | Priority | First action |
|---|---|---|
| User entered their password on a phishing site | P2 | Confirm the password was changed, then escalate to the SOC to revoke sessions |
| Suspected malware or ransomware on one device | P2 | Disconnect the device from the network; do not power it off |
| Suspected malware or ransomware on several devices | P1 | Declare a major incident and page the SOC |
| Lost or stolen laptop | P3 | Start a remote lock; P2 if the laptop held Restricted data |
| Email with personal data sent to the wrong recipient | P3 | Ask the sender to request deletion; P2 if the data was Restricted |

## 3. First steps for any suspected incident
- Write down the time the user noticed the problem and what they saw.
- Do not delete suspicious emails or files. They are evidence.
- Do not power off a device suspected of malware. Disconnect it from the network instead, by turning off Wi-Fi or unplugging the cable.
- Do not run your own scans or clean-up tools on the device.

## 4. Lost or stolen laptops
1. Confirm the asset tag and the last known location.
2. Start a remote lock within 1 hour of the report.
3. If the laptop is not recovered within 24 hours, or a theft is confirmed, the SOC orders a remote wipe.
4. If the laptop held Restricted data, raise the priority to P2 and inform the SOC immediately.

## 5. Escalating to the SOC
Page the SOC through the paging tool for P1 and P2 incidents. For P3 incidents, assign the ticket to the SOC queue. Include the user's name, device asset tag, the timeline and everything already done.

## 6. Personal data breaches
If personal data may have been exposed, the SOC informs the Data Protection Officer, who decides whether regulators and affected people must be notified. Some regulations require notification within 72 hours, so do not delay escalation.
