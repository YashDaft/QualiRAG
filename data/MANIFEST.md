# Brightwick IT Knowledge Base: Manifest

**Synthetic data.** Brightwick Retail Group is a fictional company, and every document, person, system and policy in this corpus was written for testing a RAG pipeline. Do not present results on this corpus as results on real customer data. Any resemblance to a real company is coincidental.

Keep this file outside data/knowledge_base/ so it is not ingested.

## Contents: 35 files
| File | Format | Type | Title | Effective / reviewed | Status |
|---|---|---|---|---|---|
| account_lockout.md | md | KB article | KB-1063: Account Locked After Failed Sign-Ins | 2026-07-30 | Current |
| barcode_scanner_pairing.txt | txt | KB article | KB-1052: Handheld Barcode Scanner Problems | 2026-09-01 | Current |
| brightwick_drive_sync.md | md | KB article | KB-1058: Brightwick Drive Sync Problems | 2026-06-10 | Current |
| byod_mobile_email.md | md | KB article | KB-1031: Company Email on Personal Phones | 2026-08-04 | Current |
| contractor_remote_access.md | md | KB article | KB-1015: Remote Access for Contractors | 2026-06-02 | Current |
| distribution_lists.txt | txt | KB article | KB-1041: Distribution Lists | 2026-02-17 | Current |
| follow_me_printing.txt | txt | KB article | KB-1024: Follow-Me Printing at Headquarters | 2026-04-08 | Current |
| lost_hardware_key.txt | txt | KB article | KB-1033: Lost or Damaged Hardware Security Key | 2026-03-11 | Current |
| mfa_new_phone.md | md | KB article | KB-1030: Moving MFA to a New Phone | 2026-07-30 | Current |
| new_starter_first_day.txt | txt | KB article | KB-1060: Your First Day: IT Setup | 2026-08-12 | Current |
| pos_terminal_offline.md | md | KB article | KB-1050: POS Terminal Shows "Offline" | 2026-09-01 | Current |
| report_phishing.md | md | KB article | KB-1027: How to Report a Phishing Email | 2026-08-19 | Current |
| screen_lock_clean_desk.txt | txt | KB article | KB-1070: Screen Lock and Clean Desk | 2026-01-20 | Current |
| shared_mailbox_access.md | md | KB article | KB-1040: Requesting Access to a Shared Mailbox | 2026-02-17 | Current |
| software_request_process.md | md | KB article | KB-1066: Requesting New Software | 2026-04-29 | Current |
| sso_login_errors.md | md | KB article | KB-1036: Single Sign-On Errors | 2026-06-24 | Current |
| store_network_access.md | md | KB article | KB-1012: Network Access for Store Staff | 2026-07-14 | Current |
| store_receipt_printer.md | md | KB article | KB-1053: Receipt Printer Not Printing | 2026-09-01 | Current |
| usb_removable_media.md | md | KB article | KB-1045: USB Drives and Removable Media | 2026-05-05 | Current |
| wifi_networks.md | md | KB article | KB-1020: Wi-Fi Networks at Brightwick Locations | 2026-05-21 | Current |
| company_it_handbook.md | md | Original (renamed) | Brightwick Internal IT Support Handbook | - | Current |
| service_desk_runbook.md | md | Original (renamed) | IT Service Desk Runbook | - | Current |
| policy_acceptable_use.pdf | pdf | Policy | Acceptable Use Policy | 2026-01-15 | Current |
| policy_access_control.docx | docx | Policy | Access Control Policy | 2026-03-01 | Current |
| policy_information_security.pdf | pdf | Policy | Information Security Policy | 2026-01-15 | Current |
| policy_it_service_levels.pdf | pdf | Policy | IT Service Level Policy | 2026-04-01 | Current |
| runbook_major_incident_management.md | md | Runbook / SOP | Major Incident Management Runbook | 2026-02-01 | Current |
| runbook_security_incident_triage.md | md | Runbook / SOP | Security Incident Triage Runbook for the Service Desk | 2026-04-20 | Current |
| runbook_store_network_outage.md | md | Runbook / SOP | Store Network Outage Runbook | 2026-05-12 | Current |
| sop_backup_and_restore.md | md | Runbook / SOP | Backup and Restore Standard Operating Procedure | 2026-03-15 | Current |
| sop_employee_offboarding.docx | docx | Runbook / SOP | Employee Offboarding Standard Operating Procedure: IT | 2026-02-23 | Current |
| sop_employee_onboarding.docx | docx | Runbook / SOP | Employee Onboarding Standard Operating Procedure: IT | 2026-02-23 | Current |
| sop_patch_management.docx | docx | Runbook / SOP | Patch Management Standard Operating Procedure | 2026-01-10 | Current |
| password_standard_v2.1.md | md | Superseded policy | Password Standard | 2023-01-15 | SUPERSEDED 2026-03-01 |
| remote_work_guidelines_2024.txt | txt | Superseded policy | Remote Work Guidelines 2024 | 2024-02-01 | SUPERSEDED 2026-01-15 |

## Built-in difficulty
- Near-duplicate topics: remote access differs for employees (VPN), store staff (store network) and contractors (Remote Workspace); HQ printing differs from store receipt printers.
- Policy conflicts: password_standard_v2.1.md and remote_work_guidelines_2024.txt are superseded and contradict the current Access Control Policy and Acceptable Use Policy. A correct answer uses the current document.
- Facts repeated across documents: lockout rules, Temporary Access Pass validity, POS offline limits, request turnaround times.
- Mixed formats with real parsing quirks: Word tables, PDF tables, PDF page footers that can split a paragraph, and plain-text files with underlined headings.
- Topics deliberately absent, for "the documents don't say" questions: payroll, expenses and reimbursement, parking, annual or sick leave, pensions, Mac or Linux support, printer toner, hotel or travel booking.
