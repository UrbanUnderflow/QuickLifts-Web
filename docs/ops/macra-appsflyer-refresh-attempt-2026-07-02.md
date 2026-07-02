# Macra AppsFlyer Refresh Attempt - 2026-07-02

## Scope

Step 1 objective: pull or export the latest AppsFlyer Macra metrics artifact, then refresh the Macra Scoreboard through the same import path used by `/admin/emailSequences`.

## Attempted Refresh Path

### Backend Path Checked

- Admin surface: `/admin/emailSequences`
- UI source: `src/pages/admin/emailSequences.tsx`
- Refresh function: `/.netlify/functions/sync-macra-appsflyer-raw-data`
- Backend source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- Scheduled source: `netlify/functions/scheduled-sync-macra-appsflyer.ts`

The admin Scoreboard uses the Netlify function for both the raw Pull API path and the CSV upload path.

### Raw Pull API Attempt

Read-only / import attempt runtime:

- Invoked `runMacraAppsFlyerPullImport` directly from `netlify/functions/sync-macra-appsflyer-raw-data.ts`.
- Actor label: `codex_step1_scoreboard_refresh`
- Request body: `daysBack = 7`, `includeRetargeting = true`, `timezone = +00:00`, `maximumRows = 100000`.
- Token source resolved: `secret_manager:APPSFLYER_RAW_DATA_API_TOKEN`.

Result:

- Status: `502`
- Error code: `APPSFLYER_RAW_API_ACCESS_UNAVAILABLE`
- Error: `Every AppsFlyer Pull API report request failed. Check the token and plan access for raw-data reports.`
- Fallback from importer: `Upload AppsFlyer CSV exports to keep aggregate event validation current until raw-data Pull API access is enabled.`

Report-level errors:

| Report | Result |
| --- | --- |
| `non_organic_installs` | AppsFlyer returned `400`: current subscription package does not include raw data reports. |
| `organic_installs` | AppsFlyer returned `400`: current subscription package does not include raw data reports. |
| `non_organic_in_app_events` | AppsFlyer returned `400`: current subscription package does not include raw data reports. |
| `organic_in_app_events` | AppsFlyer returned `400`: current subscription package does not include raw data reports. |
| `retargeting_conversions` | AppsFlyer returned `400`: current subscription package does not include raw data reports. |
| `retargeting_in_app_events` | AppsFlyer returned `400`: current subscription package does not include raw data reports. |

## CSV Artifact Search

Local artifact checks:

- Project search found only AppsFlyer ingestion code and deployed Netlify bundles, not a new aggregate CSV.
- `Downloads` listing did not contain an AppsFlyer or aggregate performance CSV.
- Bounded `Downloads` CSV / zip search returned no AppsFlyer CSV files.
- Bounded repo / GitHub-directory CSV search found no AppsFlyer aggregate performance CSV artifact.

Latest persisted import run in Firestore:

| Field | Value |
| --- | --- |
| Collection/doc | `appsflyer-import-runs/macra-appsflyer-csv-period-1782550099524-6ebef9b5` |
| Source | `csv_upload` |
| Import source | `aggregate_csv_upload` |
| Created at | `2026-06-27T08:48:20.136Z` |
| Coverage | `2026-06-21` through `2026-06-27` |
| Rows | `199` |
| Events | `30819` |

## Outcome

The Macra Scoreboard was not refreshed in this step.

Reason:

1. AppsFlyer raw Pull API access is blocked by the AppsFlyer subscription package.
2. No newer local AppsFlyer aggregate CSV artifact was available to upload through the Scoreboard import path.

## Required Human / Operator Action

To complete the Scoreboard refresh, provide one of these:

1. Export an AppsFlyer aggregate performance CSV covering the latest Macra window and upload it through `/admin/emailSequences` -> Macra Scoreboard -> Upload CSV.
2. Enable AppsFlyer raw data report access for the Macra app so `sync-macra-appsflyer-raw-data` can pull the reports directly.

Until one of those is available, the latest persisted AppsFlyer coverage remains the Firestore CSV import through `2026-06-27`, and the source-level read for `2026-06-29` through `2026-07-02` remains unverified.
