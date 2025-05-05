# Firebase Setup for Press Release Automation

To enable the press release automation, you need to create a KPI document in Firebase that will be used as the data source for generating press releases.

## Create the KPI Document

1. Go to your Firebase Console
2. Navigate to the Firestore Database
3. Create a document at path `app/kpis/current` with the following structure:

```javascript
{
  "date": "2023-05-05",
  "activeUsers": 14578,
  "payingCreators": 1230,
  "ARR": 273000,
  "notable": [
    "Closed partnership with Atlanta Tech Village",
    "Launched Morning Mobility Challenge with 2,650 participants"
  ]
}
```

## Update the KPI Data

This document should be updated regularly (weekly or monthly) with the latest KPIs from your analytics system. You can:

1. Manually update the document
2. Set up a separate automation that pulls data from Mixpanel, Google Analytics, or your internal database and updates this document

## Required Environment Variables

Make sure the following environment variables are set in your Netlify environment:

- `OPEN_AI_SECRET_KEY`: Your OpenAI API key
- `GITHUB_TOKEN`: A GitHub Personal Access Token with `repo` scope
- `GITHUB_REPO_OWNER`: The GitHub username or organization name (e.g., `tremainegrant`)
- `GITHUB_REPO_NAME`: The name of the repository (e.g., `QuickLifts-Web`)

## Testing the Function

You can manually trigger the function by visiting:

```
https://fitwithpulse.ai/.netlify/functions/draftPress
```

This will create a pull request with a new press release based on the current KPI data.

## Usage Notes

- The function is scheduled to run weekly
- Each run will create a new PR that needs manual review and approval
- You'll need to add an image at `public/press/releases/[slug].jpg` before merging
- After merging, the new press release will automatically appear on your website 