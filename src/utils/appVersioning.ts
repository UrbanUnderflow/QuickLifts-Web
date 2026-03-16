export type AppVersionMediaType = 'video' | 'image';

export type AppVersionProduct = 'fitWithPulse' | 'pulseCheck';

export interface AppVersionProductConfig {
  id: AppVersionProduct;
  label: string;
  shortLabel: string;
  versionCollections: string[];
  updateModalConfigPath: readonly [string, string];
  storageRoot: string;
}

export const APP_VERSION_PRODUCT_CONFIGS: Record<AppVersionProduct, AppVersionProductConfig> = {
  fitWithPulse: {
    id: 'fitWithPulse',
    label: 'Fit With Pulse',
    shortLabel: 'Fit With Pulse',
    versionCollections: ['version', 'versions'],
    updateModalConfigPath: ['company-config', 'app-update-modal'],
    storageRoot: 'press_assets/app_updates',
  },
  pulseCheck: {
    id: 'pulseCheck',
    label: 'PulseCheck',
    shortLabel: 'PulseCheck',
    versionCollections: ['pulsecheck-version', 'pulsecheck-versions'],
    updateModalConfigPath: ['company-config', 'pulsecheck-app-update-modal'],
    storageRoot: 'press_assets/pulsecheck_app_updates',
  },
};

export interface AppVersionMediaItem {
  id: string;
  type: AppVersionMediaType;
  url: string;
  storagePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface AppVersionDocument {
  version: string;
  buildNumber?: string | null;
  changeNotes: string[];
  isCriticalUpdate: boolean;
  media: AppVersionMediaItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

type FirestoreLikeData = Record<string, any>;

const getNumericParts = (version: string): number[] =>
  version.split('.').map((part) => {
    const match = part.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  });

export const compareSemanticVersions = (lhs: string, rhs: string): number => {
  const lhsParts = getNumericParts(lhs);
  const rhsParts = getNumericParts(rhs);
  const maxLength = Math.max(lhsParts.length, rhsParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const left = lhsParts[index] ?? 0;
    const right = rhsParts[index] ?? 0;

    if (left !== right) {
      return left - right;
    }
  }

  return lhs.localeCompare(rhs, undefined, { numeric: true, sensitivity: 'base' });
};

export const compareBuildNumbers = (lhs?: string | null, rhs?: string | null): number => {
  const normalizedLeft = (lhs ?? '').trim();
  const normalizedRight = (rhs ?? '').trim();
  const leftValue = Number.parseInt(normalizedLeft, 10);
  const rightValue = Number.parseInt(normalizedRight, 10);

  if (!Number.isNaN(leftValue) && !Number.isNaN(rightValue) && leftValue !== rightValue) {
    return leftValue - rightValue;
  }

  if (!Number.isNaN(leftValue) && Number.isNaN(rightValue)) {
    return 1;
  }

  if (Number.isNaN(leftValue) && !Number.isNaN(rightValue)) {
    return -1;
  }

  return normalizedLeft.localeCompare(normalizedRight, undefined, { numeric: true, sensitivity: 'base' });
};

export const incrementBuildNumber = (value?: string | null): string => {
  const normalized = (value ?? '').trim();
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed)) {
    return '1';
  }
  return String(parsed + 1);
};

const normalizeMediaEntry = (
  entry: unknown,
  fallbackType?: AppVersionMediaType,
  fallbackId?: string
): AppVersionMediaItem | null => {
  if (typeof entry === 'string') {
    const type = fallbackType ?? 'image';
    return {
      id: fallbackId ?? `${type}-${entry}`,
      type,
      url: entry,
    };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const rawType = record.type === 'video' ? 'video' : record.type === 'image' ? 'image' : fallbackType;
  const url = typeof record.url === 'string' ? record.url : null;

  if (!rawType || !url) {
    return null;
  }

  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : fallbackId ?? `${rawType}-${typeof record.fileName === 'string' ? record.fileName : url}`,
    type: rawType,
    url,
    storagePath: typeof record.storagePath === 'string' ? record.storagePath : null,
    fileName: typeof record.fileName === 'string' ? record.fileName : null,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
  };
};

export const normalizeAppVersionMedia = (data: FirestoreLikeData): AppVersionMediaItem[] => {
  const items: AppVersionMediaItem[] = [];

  if (Array.isArray(data.media)) {
    data.media.forEach((entry, index) => {
      const normalized = normalizeMediaEntry(entry, undefined, `media-${index}`);
      if (normalized) {
        items.push(normalized);
      }
    });
  }

  if (items.length === 0) {
    const video = normalizeMediaEntry(data.video, 'video', 'video-0');
    if (video) {
      items.push(video);
    }

    if (Array.isArray(data.images)) {
      data.images.forEach((entry, index) => {
        const image = normalizeMediaEntry(entry, 'image', `image-${index}`);
        if (image) {
          items.push(image);
        }
      });
    }
  }

  return items.sort((lhs, rhs) => {
    if (lhs.type === rhs.type) return 0;
    return lhs.type === 'video' ? -1 : 1;
  });
};

export const normalizeAppVersionDocument = (
  version: string,
  data: FirestoreLikeData
): AppVersionDocument => {
  const changeNotes =
    Array.isArray(data.changeNotes) && data.changeNotes.length > 0
      ? data.changeNotes.filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
      : Object.keys(data)
          .filter((key) => /^\d+$/.test(key) && typeof data[key] === 'string' && data[key].trim().length > 0)
          .sort((lhs, rhs) => Number(lhs) - Number(rhs))
          .map((key) => data[key] as string);

  return {
    version,
    buildNumber:
      typeof data.buildNumber === 'string'
        ? data.buildNumber
        : typeof data.buildNumber === 'number'
          ? String(data.buildNumber)
          : typeof data.build === 'string'
            ? data.build
            : typeof data.build === 'number'
              ? String(data.build)
              : null,
    changeNotes,
    isCriticalUpdate: Boolean(data.isCriticalUpdate ?? data.isCritical),
    media: normalizeAppVersionMedia(data),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

export const buildAppVersionWritePayload = (
  changeNotes: string[],
  isCriticalUpdate: boolean,
  media: AppVersionMediaItem[],
  buildNumber?: string
) => {
  const notesObject: { [key: string]: string } = {};

  changeNotes.forEach((note, index) => {
    notesObject[(index + 1).toString()] = note;
  });

  const normalizedMedia = media
    .filter((item) => item.url.trim().length > 0)
    .sort((lhs, rhs) => {
      if (lhs.type === rhs.type) return 0;
      return lhs.type === 'video' ? -1 : 1;
    });

  const video = normalizedMedia.find((item) => item.type === 'video') ?? null;
  const images = normalizedMedia.filter((item) => item.type === 'image');

  return {
    ...notesObject,
    buildNumber: buildNumber?.trim() || null,
    build: buildNumber?.trim() || null,
    changeNotes,
    isCriticalUpdate,
    media: normalizedMedia,
    video,
    images,
  };
};
