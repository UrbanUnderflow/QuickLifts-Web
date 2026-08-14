# NoraNotetaker Worker

This is the owned Nora meeting worker. QuickLifts queues meetings in SimpBudget Firestore at:

`simpbudget-users/{uid}/noraNotetakerMeetings/{meetingId}`

The worker claims queued records, joins the meeting as Nora, captures captions/transcript text, and writes the transcript/status back to the same document.

## MVP Scope

- Google Meet first.
- Browser-based caption capture first.
- No Recall.ai or paid meeting-bot provider.
- Zoom and Teams can be added as separate platform adapters.

## Local Run

```bash
cd nora-worker
npm install
cp .env.example .env
npm run dev
```

For Google Meet, the Chromium profile must be signed into the dedicated Nora Google account before unattended joins will work. Use `NORA_BROWSER_HEADLESS=false` locally for setup.

## Deploy Shape

Deploy this folder as a Cloud Run service or Cloud Run Job. Netlify remains the QuickLifts web app; it should not run 30-90 minute meeting sessions.

The worker needs Firestore access to the SimpBudget Firebase project. Use one of:

- Cloud Run application-default credentials in `simpbudget-e213e`.
- `SIMPBUDGET_SERVICE_ACCOUNT_JSON` containing a SimpBudget service-account JSON.
- `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account file.
