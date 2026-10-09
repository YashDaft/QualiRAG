# Backup and Restore Standard Operating Procedure

Document ID: OPS-SOP-007 | Version: 3.1 | Effective date: 2026-03-15
Owner: Infrastructure Operations | Audience: IT staff and data owners
Classification: Internal

## 1. Purpose
This procedure defines what Brightwick backs up, how long backups are kept and how users request a restore.

## 2. Backup schedule and retention

| System | Backup schedule | Retention |
|---|---|---|
| Departmental file shares | Nightly incremental at 22:00, full backup every Saturday | 35 days |
| Servers | Nightly snapshot | 14 days; monthly snapshots kept 12 months |
| Email | Platform retention | Deleted items recoverable for 30 days |
| Brightwick Drive | Recycle bin and version history | 93 days in the recycle bin; last 100 versions of each file |
| Laptops | Not backed up | Not applicable |

Laptops are not backed up. Users must keep work files in Brightwick Drive or on a departmental file share.

## 3. Requesting a restore
Submit a "Restore request" in ServicePoint with:
- the full path of the file or folder,
- the date and time of the last known good version,
- whether the restore should overwrite the current file or be saved alongside it.

To restore data that belongs to someone else, the request needs approval from the data owner. Restores of Restricted data also need approval from the Security team.

## 4. Restore targets
- A single file or folder: within 1 business day.
- A complete file share: within 2 business days.

Files older than the retention period cannot be restored. For example, a file deleted from a departmental share 40 days ago is no longer in the backups.

## 5. Self-service restores
Users can restore their own Brightwick Drive files from the recycle bin or the version history without raising a ticket.

## 6. Testing
Infrastructure Operations tests restores every quarter, restoring a sample of files and one full server, and records the results.
