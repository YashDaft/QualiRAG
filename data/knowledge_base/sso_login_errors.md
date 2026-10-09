# KB-1036: Single Sign-On Errors

Applies to: All employees and contractors
Owner: Identity and Access Management | Last reviewed: 2026-06-24

## Summary
Most cloud applications at Brightwick use single sign-on (SSO) through MyAccess at myaccess.brightwick.example. When SSO fails, the error message usually tells you which of the cases below applies.

## "You are not assigned to this application"
Your account does not have access to the application. Request access through ServicePoint using the "Application access" form. The application owner must approve the request. This is not a fault, so do not raise it as an incident.

## Sign-in loops back to the login page
1. Check that the date and time on your device are correct. A difference of more than 5 minutes from the real time causes SSO to fail.
2. Clear cookies for myaccess.brightwick.example, or try a private browser window.
3. Close all browser windows and sign in again.

## "Your sign-in was blocked"
The sign-in came from a location or device that the access rules do not allow. On a company laptop, connect to the BrightSecure VPN and try again. Some applications cannot be used from personal devices at all.

## Account locked
See KB-1063 for account lockouts.

## What to include in a ticket
If none of the steps help, raise a P3 ticket with the application name, the time of the error, a screenshot, and the correlation ID shown at the bottom of the error page.
