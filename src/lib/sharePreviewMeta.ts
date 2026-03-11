interface SharePreviewMetaConfig {
  title?: string;
  description?: string;
  protectedTitle?: string;
  protectedDescription?: string;
  image?: string;
}

interface ResolveSystemOverviewSharePreviewInput {
  token: string;
  sectionId?: string;
  sectionLabel?: string;
  sectionDescription?: string;
  siteOrigin: string;
  isLocked: boolean;
}

export interface ResolvedSharePreviewMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

const SYSTEM_OVERVIEW_SECTION_PREVIEW_CONFIG: Record<string, SharePreviewMetaConfig> = {};

const DEFAULT_TITLE = 'Pulse System Overview';
const DEFAULT_DESCRIPTION = 'Shared system artifact from Pulse.';
const PROTECTED_TITLE = 'Protected Pulse Artifact';
const PROTECTED_DESCRIPTION = 'Protected shared artifact from Pulse.';
const DEFAULT_IMAGE_PATH = '/pulse-share-default.png';

function toAbsoluteUrl(siteOrigin: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = siteOrigin.replace(/\/+$/, '');
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${path}`;
}

export function resolveSystemOverviewSharePreviewMeta({
  token,
  sectionId,
  sectionLabel,
  sectionDescription,
  siteOrigin,
  isLocked,
}: ResolveSystemOverviewSharePreviewInput): ResolvedSharePreviewMeta {
  const override = (sectionId && SYSTEM_OVERVIEW_SECTION_PREVIEW_CONFIG[sectionId]) || {};

  const title = isLocked
    ? override.protectedTitle || PROTECTED_TITLE
    : override.title || sectionLabel?.trim() || DEFAULT_TITLE;

  const description = isLocked
    ? override.protectedDescription || PROTECTED_DESCRIPTION
    : override.description || sectionDescription?.trim() || DEFAULT_DESCRIPTION;

  const image = toAbsoluteUrl(siteOrigin, override.image || DEFAULT_IMAGE_PATH);
  const url = toAbsoluteUrl(siteOrigin, `/shared/system-overview/${token}`);

  return {
    title,
    description,
    image,
    url,
  };
}
