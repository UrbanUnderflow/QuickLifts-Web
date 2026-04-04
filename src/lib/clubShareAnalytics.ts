import { safeTrackMixpanel } from './mixpanel';

type ClubShareAnalyticsContext = {
  clubId: string;
  sharedBy?: string | null;
  eventId?: string | null;
  source: string;
  platform?: 'ios' | 'android' | 'desktop' | 'unknown';
};

const withContext = (context: ClubShareAnalyticsContext, extra?: Record<string, any>) => ({
  clubId: context.clubId,
  sharedBy: context.sharedBy || null,
  eventId: context.eventId || null,
  source: context.source,
  platform: context.platform || 'unknown',
  ...extra,
});

export const trackClubShareLinkCopied = (
  context: ClubShareAnalyticsContext,
  extra?: Record<string, any>
) => safeTrackMixpanel('ClubShareLinkCopied', withContext(context, extra));

export const trackClubInstallPageViewed = (
  context: ClubShareAnalyticsContext,
  extra?: Record<string, any>
) => safeTrackMixpanel('ClubInstallPageViewed', withContext(context, extra));

export const trackClubInstallStoreTapped = (
  context: ClubShareAnalyticsContext,
  store: 'ios' | 'android',
  extra?: Record<string, any>
) => safeTrackMixpanel(
  'ClubInstallStoreTapped',
  withContext(context, {
    store,
    ...extra,
  })
);

export const trackClubOpenInAppTapped = (
  context: ClubShareAnalyticsContext,
  extra?: Record<string, any>
) => safeTrackMixpanel('ClubOpenInAppTapped', withContext(context, extra));
