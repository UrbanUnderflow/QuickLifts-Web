// components/TrainingInviteMeta.tsx
//
// OG / Twitter / App-link meta tags for 1-on-1 training-room invite
// pages (`/1on1-invite/[id]`). Mirrors ChallengeMeta so iMessage,
// Slack, Twitter, etc. render a branded preview when a coach shares
// their invite link — no AppsFlyer console config needed; the meta
// tags here are what link-preview crawlers actually read.
//
// We intentionally don't fetch the training doc on the server: the
// invite link's whole purpose is to bounce the user into the iOS
// app, and per-recipient details (host name, club, etc.) are only
// useful inside the app. The static preview keeps the SSR path
// dependency-free and fast.
//
import React from 'react';
import Head from 'next/head';

interface TrainingInviteMetaProps {
  id: string;
  /** Optional hostId from the `?sharedBy=` query so the deep-link
   *  carries it through to the iOS handler. */
  sharedBy?: string;
}

const TrainingInviteMeta: React.FC<TrainingInviteMetaProps> = ({ id, sharedBy }) => {
  const pageTitle = "You've been invited to 1-on-1 coaching | Pulse";
  const description =
    "A coach invited you to a private 1-on-1 training room on Pulse. Tap to accept and start training together.";

  // Matches `FirebaseService.previewImageURL(for: ...)` /
  // `createShareable1on1InviteLink` on iOS — both reference
  // `/preview/<type>.png` so the in-app share copy and this SSR
  // landing share the same canonical asset.
  const previewImageUrl = 'https://fitwithpulse.ai/preview/oneonone.png';
  const pageUrl = `https://fitwithpulse.ai/1on1-invite/${id}`;

  // Mirror the iOS scheme used by `FirebaseService.createShareable1on1InviteLink`
  // so `al:ios:url` deep-links straight into the open-invite flow.
  const deepLinkParts = [`trainingId=${encodeURIComponent(id)}`];
  if (sharedBy) deepLinkParts.push(`sharedBy=${encodeURIComponent(sharedBy)}`);
  const deepLinkUrl = `pulse://oneOnOneInvite?${deepLinkParts.join('&')}`;

  return (
    <Head>
      <title key="title">{pageTitle}</title>
      <meta key="description" name="description" content={description} />

      {/* Open Graph */}
      <meta key="og:title" property="og:title" content={pageTitle} />
      <meta key="og:description" property="og:description" content={description} />
      <meta key="og:type" property="og:type" content="website" />
      <meta key="og:url" property="og:url" content={pageUrl} />
      <meta key="og:site_name" property="og:site_name" content="Pulse Fitness" />
      <meta key="og:image" property="og:image" content={previewImageUrl} />
      <meta key="og:image:secure_url" property="og:image:secure_url" content={previewImageUrl} />
      <meta key="og:image:type" property="og:image:type" content="image/png" />
      <meta key="og:image:width" property="og:image:width" content="1200" />
      <meta key="og:image:height" property="og:image:height" content="630" />
      <meta key="og:image:alt" property="og:image:alt" content="Pulse 1-on-1 coaching invite" />

      {/* Apple App Links — opens the iOS app directly when tapped from
          a supported context. AppsFlyer's OneLink wrapper layers on top
          of this for the share-sheet path. */}
      <meta key="al:ios:app_store_id" property="al:ios:app_store_id" content="6451497729" />
      <meta key="al:ios:app_name" property="al:ios:app_name" content="Pulse: Community Workouts" />
      <meta key="al:ios:url" property="al:ios:url" content={deepLinkUrl} />

      {/* Twitter */}
      <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
      <meta key="twitter:site" name="twitter:site" content="@fitwithpulse" />
      <meta key="twitter:creator" name="twitter:creator" content="@fitwithpulse" />
      <meta key="twitter:title" name="twitter:title" content={pageTitle} />
      <meta key="twitter:description" name="twitter:description" content={description} />
      <meta key="twitter:image" name="twitter:image" content={previewImageUrl} />
      <meta key="twitter:image:alt" name="twitter:image:alt" content="Pulse 1-on-1 coaching invite" />

      <link key="canonical" rel="canonical" href={pageUrl} />
      <meta key="theme-color" name="theme-color" content="#E0FE10" />
      <meta key="mobile-web-app-capable" name="mobile-web-app-capable" content="yes" />
      <meta key="apple-mobile-web-app-capable" name="apple-mobile-web-app-capable" content="yes" />
      <meta key="apple-mobile-web-app-status-bar-style" name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    </Head>
  );
};

export default TrainingInviteMeta;
