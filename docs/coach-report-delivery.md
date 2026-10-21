# Coach report delivery

In Admin → Provisioning, expand an organization and team, then **Coach report delivery**. Choose daily participation, Monday weekly reports, eligible team staff, local send hour, IANA time zone, and start date. Save the settings. New teams remain disabled until recipients and cadence are explicitly configured.

Daily reports summarize the previous completed UTC date. Weekly reports cover the completed Monday–Sunday UTC week. Send time follows the selected local time zone, including daylight saving. Participation uses dashboard definitions; practices are attributed to assignment dates, not the timestamp at which an older assignment was completed. Display names are used without inferring legal names.

Netlify's `scheduled-coach-participation-reports` runs every five minutes. It checks due configurations and sends through the existing transactional email provider, independently of Codex. On Monday, daily and weekly reports are distinct deliveries. These explicitly configured reports bypass the generic one-email-per-day quota, while retaining suppression checks and per-report deduplication. Deferred/failed runs are retried during the due local day. Entirely missed days are not backfilled automatically.

Configuration and delivery records live in server-only subcollections beneath `coach-team-insight-reports/delivery`. Existing deployed rules exclude this entire root from generic client access. Provisioning APIs require same-environment administrator authentication. Each recipient must retain active team participation access; roster visibility is checked during preparation and again before sending. Link access is recipient-specific and rechecks current permissions. Removed athletes cause older named snapshots to be withheld in favor of the current dashboard.

Recent delivery records distinguish sent, failed, suppressed, preparing, and sending; errors appear in Provisioning. Provider acceptance is recorded as sent, not proof of inbox receipt. Retrying after provider acceptance but before local acknowledgement can remain ambiguous; do not manually erase deduplication records to resend.

No mood answers, recovery values, journal text, or Nora conversations appear in these participation reports. Email content and the protected report link use the same saved report.

Administrators can configure CC addresses separately for each selected primary recipient in Provisioning. `recipientCc` maps the primary UID to up to 20 email/name entries and applies to both daily and weekly reports. CC recipients receive the report email content; being copied does not grant dashboard or secure report-link access. All destinations are checked for suppression; a suppression blocks that entire email copy and is recorded in delivery history. CC changes apply to future unsent reports, without resending accepted reports.
