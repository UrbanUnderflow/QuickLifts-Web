# Automated Press Release System

This directory contains auto-generated press releases for the Pulse fitness app.

## System Overview

The press release generation system works as follows:

1. A KPI snapshot is taken daily and stored in Firebase
2. Weekly, an automated process generates a press release based on the latest KPI data
3. The system creates an MDX file in the `releases/` directory
4. A GitHub PR is created for review before publication
5. After review and approval, the PR is merged and the press release appears on the website

## Directory Structure

- `releases/`: Contains MDX files for each press release, named in format `YYYY-MM-DD-title-slug.mdx`
- `images/`: (Optional) Contains any press release related images

## MDX File Format

Each press release is an MDX file with the following frontmatter:

```mdx
---
title: "Title of the Press Release"
date: "YYYY-MM-DD"
image: "/press/releases/image-name.jpg"
summary: "Brief summary of the press release content..."
tags: ["update", "metrics", "growth"]
---

<PressBody>
Markdown content of the press release...
</PressBody>
```

## Management

Press releases can be managed from the admin dashboard at `/admin/pressReleases`.

From there, you can:
- View the status of the automation
- See when the last press release was generated
- Manually trigger a new press release generation
- View recent press releases and their status

## Technical Implementation

The system is implemented using:
- Netlify Functions for scheduled execution
- Firebase Firestore for data storage
- OpenAI for content generation
- GitHub API for PR creation
- MDX for rendering on the website

The main components are:
- `netlify/functions/generateKpiSnapshot.ts` - Daily KPI data collection
- `netlify/functions/draftPress.ts` - Weekly press release generation
- `netlify/functions/triggerDraftPress.ts` - Manual trigger endpoint
- `src/pages/admin/pressReleases.tsx` - Admin management interface
- `src/pages/press/press-releases.tsx` - Public listing page
- `src/pages/press/[slug].js` - Individual press release display 