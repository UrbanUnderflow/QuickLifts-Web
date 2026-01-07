# Mixpanel Review Tracking Implementation

## Overview
Mixpanel tracking has been integrated into all review pages to track when **external viewers** (investors, stakeholders, partners) view your company updates. This allows you to see who is reading your reviews and which reviews are getting the most attention.

## Quick Start: Create Your Review Analytics Board

### Step 1: Create a New Board
1. Log into your Mixpanel dashboard
2. Click **Boards** in the left sidebar
3. Click **+ Create Board** (top right)
4. Name it: **"Review Analytics Dashboard"**
5. Click **Create**

### Step 2: Add Key Insights

Now add these 8 essential insights to your board:

---

#### Insight 1: Total Review Views (Overview Card)
**What it shows**: Total number of review page views

1. Click **+ Add Insight**
2. Select **Insights**
3. Choose **Review Page Viewed** event
4. Metric: **Total Events**
5. Date range: **Last 30 days**
6. Visualization: **Number** (big number card)
7. Click **Save** → Name it **"Total Review Views"**

---

#### Insight 2: Views by Review Period
**What it shows**: Which reviews are most popular

1. **+ Add Insight** → **Insights**
2. Event: **Review Page Viewed**
3. Click **Breakdown** → Select **review_period**
4. Metric: **Total Events**
5. Visualization: **Bar Chart**
6. Sort: **Descending**
7. **Save** as **"Most Viewed Reviews"**

---

#### Insight 3: Geographic Distribution (Map)
**What it shows**: Where viewers are located

1. **+ Add Insight** → **Insights**
2. Event: **Review Page Viewed**
3. Click **Breakdown** → Select **$country_code**
4. Metric: **Unique Users**
5. Visualization: **Map**
6. Date range: **Last 30 days**
7. **Save** as **"Review Views by Country"**

---

#### Insight 4: Top Cities
**What it shows**: Which cities have the most viewers

1. **+ Add Insight** → **Insights**
2. Event: **Review Page Viewed**
3. Click **Breakdown** → Select **$city**
4. Metric: **Total Events**
5. Visualization: **Table** or **Bar Chart**
6. Limit: **Top 10**
7. **Save** as **"Top Cities Viewing Reviews"**

---

#### Insight 5: Views Over Time
**What it shows**: Daily/weekly view trends

1. **+ Add Insight** → **Insights**
2. Event: **Review Page Viewed**
3. Metric: **Total Events**
4. Visualization: **Line Chart**
5. Date range: **Last 90 days**
6. Granularity: **Day** or **Week**
7. **Save** as **"Review Views Over Time"**

---

#### Insight 6: Review Type Distribution
**What it shows**: Year vs. Quarter vs. Month review popularity

1. **+ Add Insight** → **Insights**
2. Event: **Review Page Viewed**
3. Click **Breakdown** → Select **review_type**
4. Metric: **Total Events**
5. Visualization: **Pie Chart**
6. **Save** as **"Review Types Breakdown"**

---

#### Insight 7: Recent Viewers Table
**What it shows**: Most recent viewers with details

1. **+ Add Insight** → **User Activity**
2. Event: **Review Page Viewed**
3. Show columns:
   - **User** (email or ID)
   - **review_period**
   - **$city**
   - **$country_code**
   - **Timestamp**
4. Sort by: **Most Recent**
5. Limit: **Last 50 events**
6. **Save** as **"Recent Review Views"**

---

#### Insight 8: Unique Viewers Per Review
**What it shows**: How many different people viewed each review

1. **+ Add Insight** → **Insights**
2. Event: **Review Page Viewed**
3. Click **Breakdown** → Select **review_period**
4. Metric: **Unique Users**
5. Visualization: **Table**
6. Sort: **Descending**
7. **Save** as **"Unique Viewers by Review"**

---

### Step 3: Organize Your Board

1. **Drag and drop** insights to arrange them
2. Suggested layout:
   ```
   [Total Views - Big Number]    [Views Over Time - Line Chart]
   
   [Most Viewed Reviews - Bar]   [Review Types - Pie Chart]
   
   [Country Map - Full Width]
   
   [Top Cities - Table]          [Unique Viewers - Table]
   
   [Recent Viewers - Full Width Table]
   ```

3. Click **Save** at the top

---

### Step 4: Share Your Board

**Option 1: Share with Team**
1. Click **Share** (top right)
2. Enter email addresses
3. Set permissions: **Can View** or **Can Edit**
4. Click **Share**

**Option 2: Create Public Link**
1. Click **Share** → **Get Public Link**
2. Copy the link
3. Share with investors/stakeholders

**Option 3: Schedule Email Reports**
1. Click **•••** (more options) → **Schedule Email**
2. Choose frequency: **Daily**, **Weekly**, or **Monthly**
3. Add recipients
4. Click **Schedule**

---

### Pro Tips

**Filter for Specific Time Periods**
- Use date picker at top of board
- Common choices: Last 7 days, Last 30 days, Last quarter

**Create Investor-Specific View**
1. Add filter to entire board
2. Filter by: **$email contains "investor-email.com"**
3. See only that investor's activity

**Set Up Alerts**
1. Click on any insight
2. Click **•••** → **Create Alert**
3. Example: "Alert me when Total Review Views > 20 in a day"
4. Get notifications when thresholds are hit

**Create Multiple Boards**
- **Executive Summary** (high-level metrics)
- **Investor Engagement** (specific investor tracking)
- **Geographic Analysis** (location focus)

---

## What Gets Tracked

When someone views a review page (whether logged in or anonymous), Mixpanel logs:
- **Which review** they viewed
- **When** they viewed it
- **Who** viewed it (if they're logged in)
- **What type** of review it was (year, quarter, month, draft)

## Files Updated

### Review Pages with Tracking
All review pages now track page views with the event: **`Review Page Viewed`**

1. **`src/pages/review/year2025.tsx`** - 2025 Year in Review
2. **`src/pages/review/q1-25.tsx`** - Q1 2025 Review
3. **`src/pages/review/q2-25.tsx`** - Q2 2025 Review
4. **`src/pages/review/q3-25.tsx`** - Q3 2025 Review
5. **`src/pages/review/nov24.tsx`** - November 2024 Review
6. **`src/pages/review/dec24.tsx`** - December 2024 Review
7. **`src/pages/review/draft/[id].tsx`** - Draft Reviews (admin only)

## Event Properties

Each page view event includes:

**Custom Properties:**
```javascript
{
  review_type: 'year' | 'quarter' | 'month' | 'draft',
  review_period: 'January 2025' | 'Q1 2025' | '2025 Year in Review' | etc.,
  review_title: 'Full page title',
  page_url: window.location.href,
  is_admin: true // (only for draft reviews)
}
```

**Review Period Format:**
- **Monthly reviews** (generated via Review Tracker): `January 2025`, `February 2025`, etc.
- **Quarterly reviews**: `Q1 2025`, `Q2 2025`, etc.
- **Year in review**: `2025 Year in Review`
- **Draft reviews**: Uses the month name format (e.g., `January 2025`)

This format makes it easy to see which specific month/quarter/year was viewed in your Mixpanel dashboard.

**Automatic Properties (tracked by Mixpanel):**
```javascript
{
  $city: 'San Francisco',           // City based on IP
  $region: 'California',             // State/Province based on IP
  $country_code: 'US',               // Country code
  $browser: 'Chrome',                // Browser name
  $browser_version: '120.0.0',       // Browser version
  $device: 'Mac',                    // Device type
  $os: 'Mac OS X',                   // Operating system
  $screen_height: 1080,              // Screen resolution
  $screen_width: 1920,
  $referrer: 'https://linkedin.com', // Where they came from
  $current_url: 'https://fitwithpulse.ai/review/year2025'
}
```

> **Location Tracking**: Mixpanel automatically determines location (city, region, country) from the viewer's IP address. This works for all visitors, including anonymous viewers.

## How It Works

1. **Mixpanel Initialization**: Already configured in `src/pages/_app.tsx`
2. **User Identification**: Automatically identifies logged-in users via their user ID and email
3. **Anonymous Tracking**: For non-logged-in viewers, Mixpanel creates an anonymous ID
4. **Page View Tracking**: Fires once when the review page component mounts
5. **Platform Tag**: All events include `platform: 'web'` super property

## How It Works

1. **Mixpanel Initialization**: Already configured in `src/pages/_app.tsx`
2. **User Identification**: Automatically identifies logged-in users via their user ID and email
3. **Page View Tracking**: Fires once when the review page component mounts
4. **Platform Tag**: All events include `platform: 'web'` super property

## Example Events

### Year Review
```javascript
mixpanel.track('Review Page Viewed', {
  review_type: 'year',
  review_period: '2025',
  review_title: 'Q4 2025 + Year in Review',
  page_url: 'https://fitwithpulse.ai/review/year2025',
});
```

### Quarter Review
```javascript
mixpanel.track('Review Page Viewed', {
  review_type: 'quarter',
  review_period: 'Q1 2025',
  review_title: 'Q1 2025: Launch, Learn, Iterate',
  page_url: 'https://fitwithpulse.ai/review/q1-25',
});
```

### Draft Review (Admin Only)
```javascript
mixpanel.track('Review Page Viewed', {
  review_type: 'draft',
  review_period: 'draft-id',
  review_title: 'Draft Review - draft-id',
  page_url: 'https://fitwithpulse.ai/review/draft/draft-id',
  is_admin: true,
});
```

## Viewing Data in Mixpanel

1. Go to your Mixpanel dashboard
2. Navigate to **Events** → **Review Page Viewed**
3. Filter/Group by properties:
   - `review_type` to see year/quarter/month/draft breakdowns
   - `review_period` to see specific time periods
   - `$email` or `distinct_id` to see which users viewed which reviews
   - `page_url` to track specific review URLs
   - **`$city`** to see which cities viewers are from
   - **`$region`** to see state/province breakdown
   - **`$country_code`** to see country-level engagement

## Use Cases

### Track Investor Engagement
When you send a review link to an investor, you can see:
- Did they view it?
- When did they view it?
- **Where they viewed it from** (city/country)
- What device/browser they used
- How many times did they view it?

### Geographic Distribution
- See which cities/regions your reviews are being viewed from
- Identify international vs. domestic interest
- Track expansion into new markets
- Verify investor locations match expected regions

### Measure Review Impact
- Which reviews get the most views?
- Are year-end reviews more popular than quarterly?
- Do certain periods get re-viewed multiple times?
- **Which regions show the most interest?**

### Anonymous Tracking
- Even if someone isn't logged in, Mixpanel tracks their session
- You can see total unique visitors per review
- Track engagement from email campaigns or social shares
- **Location data works for anonymous viewers too**

## Practical Location Tracking Examples

### Example 1: Tracking a Specific Investor
**Scenario**: You sent your 2025 Year in Review to an investor in New York

**In Mixpanel:**
1. Go to **Events** → **Review Page Viewed**
2. Filter by `review_period = '2025'`
3. Filter by `$city = 'New York'` or `$region = 'New York'`
4. Check if event appears with timestamp
5. See additional properties like device, browser, referrer

**What you learn:**
- ✅ Confirmed they viewed it
- 📍 They viewed from New York (as expected)
- ⏰ They viewed it 2 hours after you sent the email
- 💻 They used Chrome on Mac (professional setup)
- 🔗 They came directly from email link

---

### Example 2: Unexpected International Interest
**Scenario**: You notice views from unexpected countries

**In Mixpanel:**
1. Go to **Events** → **Review Page Viewed**
2. Create a **Breakdown** by `$country_code`
3. Enable **Map Visualization**
4. See which countries have viewed your reviews

**What you learn:**
- 🌍 Investors from UK, Germany, and Singapore viewed
- 🎯 Potential international expansion opportunities
- 📊 Can tailor future updates for international audience

---

### Example 3: Investor Travel Patterns
**Scenario**: Track if an investor viewed your review multiple times from different locations

**In Mixpanel:**
1. Go to **Events** → **Review Page Viewed**
2. Filter by specific `$email` or `distinct_id`
3. Show properties: `$city`, `timestamp`
4. Sort by date

**What you learn:**
- 📍 First view: San Francisco (office)
- 📍 Second view: New York (business trip)
- 📍 Third view: San Francisco (back at office)
- 💡 Insight: They're reviewing multiple times = high interest

---

### Example 4: Draft Review Geographic Distribution
**Scenario**: You shared a draft review with your board members

**In Mixpanel:**
1. Go to **Events** → **Review Page Viewed**
2. Filter by `is_admin = true` (draft reviews)
3. Group by `$city`
4. Last 7 days

**What you learn:**
- 📍 4 views from San Francisco
- 📍 2 views from New York
- 📍 1 view from Austin
- ✅ All board members have reviewed it

### Total Review Views
- **Event**: `Review Page Viewed`
- **Metric**: Total Count
- See overall engagement across all reviews

### Most Viewed Reviews
- **Event**: `Review Page Viewed`
- **Group by**: `review_period`
- **Sort by**: Count (descending)
- Identifies which reviews get the most attention

### Views by Location (City)
- **Event**: `Review Page Viewed`
- **Group by**: `$city`
- **Sort by**: Count (descending)
- See which cities your reviews are being viewed from

### Views by Country
- **Event**: `Review Page Viewed`
- **Group by**: `$country_code`
- Create a world map visualization
- Track international investor interest

### Unique Viewers Per Review
- **Event**: `Review Page Viewed`
- **Metric**: Unique Users
- **Group by**: `review_period`
- See how many different people viewed each review

### Year-End Review Performance by Location
- **Event**: `Review Page Viewed`
- **Filter**: `review_type = 'year'`
- **Group by**: `$region` or `$city`
- Track engagement on your most important reviews by geography

### Review Views Over Time
- **Event**: `Review Page Viewed`
- **Group by**: Date
- See when people are viewing your reviews (day of week, time of day)

### Investor Location Tracking (if logged in)
- **Event**: `Review Page Viewed`
- **Filter by**: `$email` or `distinct_id`
- **Show properties**: `$city`, `$region`, `$country_code`
- See where specific investors viewed from (office vs. home, travel, etc.)

### Anonymous vs. Authenticated Views
- **Event**: `Review Page Viewed`
- **Segment by**: Has `$email` property
- Compare logged-in vs. anonymous traffic

### Device & Browser Breakdown
- **Event**: `Review Page Viewed`
- **Group by**: `$browser` or `$device`
- See if viewers prefer mobile or desktop

### Referrer Analysis
- **Event**: `Review Page Viewed`
- **Group by**: `$referrer`
- See where your traffic is coming from (email, LinkedIn, direct, etc.)

## Notes

- Tracking fires on page load via `useEffect` hook
- All tracking includes console logs for debugging (can be removed in production)
- Mixpanel token must be set in environment variable: `NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN`
- **User identification happens automatically** in `_app.tsx` when users are logged in
- **Anonymous tracking works** for users who aren't logged in (great for investor/stakeholder views)
- **Works with any review URL** you share publicly or privately

## Future Enhancements

Consider adding:
- **Scroll depth tracking** - How far down the page viewers read
- **Time on page** - How long viewers spend reading
- **Video engagement** - Track plays/pauses on CEO address videos
- **PDF downloads** - When someone downloads a review PDF
- **Link clicks** - Track clicks on investor fund links or CTAs
- **Section visibility** - Which sections of reviews get viewed
- **Email campaign attribution** - Track which email drove the view
- **Referrer tracking** - Where viewers came from (email, LinkedIn, etc.)
