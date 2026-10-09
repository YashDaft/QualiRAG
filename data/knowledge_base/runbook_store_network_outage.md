# Store Network Outage Runbook

Document ID: NET-RB-011 | Version: 1.6 | Effective date: 2026-05-12
Owner: Network Engineering | Audience: IT Service Desk, Network Operations
Classification: Internal

## 1. Scope
This runbook covers loss of network connectivity at one or more Brightwick stores. It does not cover a single faulty POS terminal, which is handled through KB-1050.

## 2. How store networks are built
Each store has a primary fibre circuit and a 4G/LTE backup router. If the fibre circuit fails, the store fails over to the LTE backup automatically within 2 minutes. While a store runs on the backup:
- POS terminals keep working normally.
- StoreHub is slower than usual.
- Background traffic such as security camera uploads and software updates is paused.

## 3. Assessing the scope
1. Open the network monitoring dashboard and check the status of the store's router.
2. If several stores are affected at once, treat it as a possible major incident and follow the Major Incident Management Runbook.
3. For a single store, record whether the store is on the LTE backup or completely offline.

## 4. Priority
- Store running on the LTE backup with trading unaffected: P3.
- Store completely offline, with POS terminals in offline mode: P2.
- More than 10 stores affected: major incident.

## 5. Single store completely offline
1. Call the store manager. Confirm the time the outage started and describe the lights on the store router.
2. Only ask the store to restart the router if the dashboard shows it is unresponsive. Stores must not restart the router unless the service desk asks them to.
3. Raise a fault with the carrier, quoting the circuit ID from the store asset register.
4. Remind the store manager that POS offline mode holds card transactions for up to 4 hours. If the outage is expected to last longer, advise the store to prepare cash-only signage and inform Retail Operations.
5. Update the ticket every 60 minutes until the store is back online.

## 6. Carrier faults
The carrier's repair target for a fibre circuit is 8 hours. If the carrier misses the target, escalate to the Network Engineering on-call engineer, who can request a temporary second LTE router for the store.

## 7. Closure
Close the ticket only after the store manager confirms the POS terminals and StoreHub are working, and the dashboard shows the primary circuit back in use. Record the root cause given by the carrier.
