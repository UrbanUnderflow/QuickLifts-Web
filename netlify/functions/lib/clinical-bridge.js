const DEFAULT_AUNTEDNA_BASE_URL = 'https://partner-api.manasinsights.me/partner';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveIntegerEnv(value, fallback, min, max) {
  const parsed = Number.parseInt(normalizeString(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function resolveCredentialMode(apiKey) {
  const normalized = normalizeString(apiKey).toLowerCase();
  if (!normalized) return 'missing';
  if (normalized.startsWith('ae_pk_test_')) return 'test';
  if (normalized.startsWith('ae_pk_live_')) return 'live';
  return 'unknown';
}

function normalizeBaseUrl(value) {
  return normalizeString(value).replace(/\/+$/, '');
}

function resolveClinicalBridgeConfig() {
  const provider = normalizeString(process.env.CLINICAL_BRIDGE_PROVIDER || process.env.CLINICAL_PROVIDER || 'auntedna')
    .toLowerCase();
  const baseUrl = normalizeBaseUrl(
    process.env.CLINICAL_BRIDGE_BASE_URL
    || process.env.AUNTEDNA_PARTNER_API_URL
    || process.env.AUNTEDNA_API_URL
    || DEFAULT_AUNTEDNA_BASE_URL
  );
  const apiKey = normalizeString(process.env.CLINICAL_BRIDGE_API_KEY || process.env.AUNTEDNA_API_KEY);

  return {
    provider,
    baseUrl,
    apiKey,
    hasApiKey: Boolean(apiKey),
    credentialMode: resolveCredentialMode(apiKey),
    timeoutMs: resolveIntegerEnv(process.env.CLINICAL_BRIDGE_TIMEOUT_MS, 10000, 1000, 30000),
  };
}

function buildPulseCallbackUrl() {
  const explicit = normalizeString(process.env.CLINICAL_BRIDGE_CALLBACK_URL || process.env.PULSE_DEFAULT_CALLBACK_URL);
  if (explicit) return explicit;
  const siteUrl = normalizeBaseUrl(process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://pulsecheckmind.ai');
  return `${siteUrl}/.netlify/functions/clinical-callback`;
}

function unwrapPartnerResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      success: false,
      data: {},
      error: { code: 'EMPTY_RESPONSE', message: 'Clinical provider returned an empty response.' },
      requestId: `clinical-empty-${Date.now()}`,
    };
  }

  if ('success' in raw || 'data' in raw || 'error' in raw) {
    const hasError = raw.error !== null && raw.error !== undefined && raw.error !== false;
    if (typeof raw.success !== 'boolean' && !hasError) {
      return {
        success: false,
        data: {},
        error: {
          code: 'INVALID_RESPONSE_ENVELOPE',
          message: 'Clinical provider response omitted the documented success field.',
        },
        requestId: raw.requestId || raw.request_id || `clinical-invalid-${Date.now()}`,
      };
    }
    return {
      success: typeof raw.success === 'boolean' ? raw.success : !hasError,
      data: raw.data || {},
      error: raw.error || null,
      requestId: raw.requestId || raw.request_id || `clinical-${Date.now()}`,
    };
  }

  return {
    success: false,
    data: {},
    error: {
      code: 'INVALID_RESPONSE_ENVELOPE',
      message: 'Clinical provider response did not use the documented response envelope.',
    },
    requestId: raw.requestId || raw.request_id || `clinical-invalid-${Date.now()}`,
  };
}

function normalizeCreateEscalationResult(response) {
  const data = response.data || {};
  const escalationId =
    data.escalationId
    || data.escalation_id
    || data.id
    || data.caseId
    || data.case_id
    || data.handoffId
    || null;

  return {
    ...response,
    escalationId,
    status: data.status || data.escalationStatus || data.state || (response.success ? 'received' : 'failed'),
    clinicianAssigned:
      data.clinicianAssigned
      || data.clinician
      || (data.clinicianAssigned === null ? null : undefined),
    estimatedContactTime: data.estimatedContactTime || data.estimated_contact_time || null,
  };
}

class AuntEdnaClinicalBridge {
  constructor(config = resolveClinicalBridgeConfig()) {
    this.config = config;
  }

  get providerName() {
    return 'auntedna';
  }

  requireCredential(operation) {
    if (this.config.apiKey) return;
    const error = new Error(`Clinical bridge API key is required for ${operation}.`);
    error.code = 'CLINICAL_BRIDGE_API_KEY_MISSING';
    throw error;
  }

  async request(method, endpoint, body, options = {}) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Pulse-Integration': 'true',
      ...(options.includeAuth !== false && this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      ...(options.headers || {}),
    };

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutMs = Number(this.config.timeoutMs) || 10000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Clinical provider request timed out after ${timeoutMs} ms.`);
        timeoutError.code = 'CLINICAL_BRIDGE_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const text = await response.text();
    let raw = null;
    try {
      raw = text ? JSON.parse(text) : {};
    } catch (_error) {
      raw = { success: false, error: { code: 'NON_JSON_RESPONSE', message: text.slice(0, 300) } };
    }

    const normalized = unwrapPartnerResponse(raw);
    return {
      ...normalized,
      success: response.ok && normalized.success !== false,
      httpStatus: response.status,
      ok: response.ok && normalized.success !== false,
      endpoint: path,
      durationMs: Date.now() - startedAt,
    };
  }

  async healthCheck() {
    return this.request('GET', '/health', null, { includeAuth: false });
  }

  async upsertAthlete(input = {}) {
    const externalId = normalizeString(input.externalId || input.pulseUserId || input.userId);
    if (!externalId) throw new Error('externalId is required for clinical athlete upsert.');
    this.requireCredential('athlete upsert');

    return this.request('POST', '/athletes', {
      externalId,
      email: input.email,
      displayName: input.displayName || input.name,
      firstName: input.firstName,
      lastName: input.lastName,
      organizationId: input.organizationId,
      teamId: input.teamId,
      source: 'pulsecheck',
      metadata: input.metadata || undefined,
    });
  }

  async createEscalation(payload = {}) {
    const escalationRecordId = normalizeString(payload.escalationRecordId);
    if (!escalationRecordId) throw new Error('escalationRecordId is required for clinical escalation idempotency.');
    const callbackUrl = normalizeString(payload.pulseApiCallback) || buildPulseCallbackUrl();

    this.requireCredential('escalation creation');

    const response = await this.request('POST', '/escalations', {
      ...payload,
      pulseApiCallback: callbackUrl,
    });
    return normalizeCreateEscalationResult(response);
  }

  async getAthleteStatus(externalId) {
    const id = normalizeString(externalId);
    if (!id) throw new Error('externalId is required for clinical athlete status.');
    this.requireCredential('athlete status lookup');
    return this.request('GET', `/athletes/${encodeURIComponent(id)}/status`);
  }

  async getCareState(externalId) {
    const id = normalizeString(externalId);
    if (!id) throw new Error('externalId is required for clinical care state.');
    this.requireCredential('care-state lookup');
    return this.request('GET', `/athletes/${encodeURIComponent(id)}/care-state`);
  }

  async resolveEscalation(escalationId, resolution = {}) {
    const id = normalizeString(escalationId);
    if (!id) throw new Error('escalation id is required for clinical resolution.');
    this.requireCredential('escalation resolution');
    return this.request('POST', `/escalations/${encodeURIComponent(id)}/resolve`, {
      status: resolution.status || 'resolved',
      coachNote: resolution.coachNote,
    });
  }
}

function createClinicalBridge(config = resolveClinicalBridgeConfig()) {
  if (config.provider !== 'auntedna') {
    throw new Error(`Unsupported clinical bridge provider "${config.provider}".`);
  }
  return new AuntEdnaClinicalBridge(config);
}

module.exports = {
  AuntEdnaClinicalBridge,
  DEFAULT_AUNTEDNA_BASE_URL,
  buildPulseCallbackUrl,
  createClinicalBridge,
  normalizeCreateEscalationResult,
  resolveCredentialMode,
  resolveClinicalBridgeConfig,
};
