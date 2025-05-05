# Pulse Press Release Automation System

This document outlines the automated press release generation system implemented for Pulse's website. The system generates press releases using OpenAI, based on KPI data stored in Firebase, and submits them as GitHub Pull Requests for human review before publishing.

## System Components

1. **Netlify Scheduled Function (`draftPress.ts`)**
   - Runs weekly to generate press releases
   - Fetches KPI data from Firebase
   - Generates content via OpenAI
   - Creates GitHub PR with the new press release

2. **Firebase KPI Document**
   - Located at `app/kpis/current`
   - Contains latest metrics and notable events
   - Updated manually or via separate automation

3. **Content Storage**
   - Press releases stored as MDX files in `content/press/releases/`
   - Follows format: `YYYY-MM-DD-slug.mdx`
   - Images stored in `public/press/releases/`

4. **Web Components**
   - Dynamic page for individual releases: `src/pages/press/[slug].js`
   - Press releases listing page: `src/pages/press/press-releases.tsx`
   - `PressBody` component for rendering release content

## How It Works

### 1. Data Collection
The system relies on a Firebase document that contains updated KPI metrics:
```json
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

### 2. Automated Generation
The `draftPress.ts` Netlify function:
- Fetches the latest KPI data from Firebase
- Determines the most newsworthy angle based on metrics and notable events
- Generates an appropriate title
- Calls OpenAI to create the press release content
- Formats the content as an MDX file with proper frontmatter

### 3. GitHub Integration
The function then:
- Creates a new branch (e.g., `press/auto-20230505-1430`)
- Commits the MDX file to the branch
- Opens a Pull Request to the main branch
- Includes a descriptive PR body with summary and next steps

### 4. Human Review
A team member reviews the PR:
- Checks the content for accuracy
- Makes any necessary edits
- Adds an appropriate header image at `public/press/releases/[slug].jpg`
- Merges the PR when ready to publish

### 5. Automatic Publication
Once merged:
- Netlify rebuilds the site
- The press release appears on the press-releases page
- The release is available at its dedicated URL

## Technical Implementation

### Key Files

- **`netlify/functions/draftPress.ts`**: The scheduled function
- **`src/pages/press/[slug].js`**: Dynamic page template for individual releases
- **`src/pages/press/press-releases.tsx`**: Listing page
- **`src/components/Press/PressBody.js`**: Component for rendering MDX content
- **`netlify.toml`**: Configuration for scheduled function

### Dependencies

- **OpenAI API**: For content generation
- **GitHub API (Octokit)**: For repository operations
- **Firebase Admin**: For accessing KPI data
- **MDX**: For content rendering
- **Next.js**: For page rendering and static generation

## Setup Requirements

### Environment Variables

The following environment variables need to be set in Netlify:

- `OPEN_AI_SECRET_KEY`: Your OpenAI API key
- `GITHUB_TOKEN`: A GitHub Personal Access Token with `repo` scope
- `GITHUB_REPO_OWNER`: The GitHub username or organization name
- `GITHUB_REPO_NAME`: The name of the repository

### Firebase Configuration

- Ensure the Firebase Admin SDK is configured properly
- Create the KPI document at the correct path (`app/kpis/current`)
- Keep the document updated with current metrics

## Maintenance and Operation

### Adding a Manual Press Release

You can manually add press releases by:
1. Creating an MDX file in `content/press/releases/` following the naming convention
2. Adding the proper frontmatter (title, date, image, summary, tags)
3. Writing the content using markdown with the `<PressBody>` wrapper

### Testing the Automation

To manually trigger the function for testing:
```bash
curl -X POST https://fitwithpulse.ai/.netlify/functions/draftPress
```

### Troubleshooting

Common issues to check:
- GitHub token permissions and expiration
- Firebase connection and document structure
- OpenAI API key and rate limits
- Content directory existence and permissions

## Future Enhancements

Potential improvements to the system:

1. **Media Coverage Tracking**: Automatically discover and index media mentions
2. **Social Media Integration**: Auto-post new releases to social platforms
3. **Analytics Integration**: Pull more detailed metrics from analytics platforms
4. **Image Generation**: Use AI to generate header images for releases
5. **Notification System**: Send Slack/email alerts when new PRs are created 