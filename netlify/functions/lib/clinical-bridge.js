const DEFAULT_AUNTEDNA_BASE_URL = 'https://partner-api.manasinsights.me/partner';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nowIso() {
  return new Date().toISOString();
}

function resolveBooleanEnv(...values) {
  return values.some((value) => {
    const normalized = normalizeString(value).toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  });
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
  const explicitMock = resolveBooleanEnv(process.env.CLINICAL_BRIDGE_MOCK, process.env.AUNTEDNA_MOCK);
  const mock = explicitMock || !apiKey;

  return {
    provider,
    baseUrl,
    apiKey,
    mock,
    explicitMock,
    hasApiKey: Boolean(apiKey),
  };
}

function buildPulseCallbackUrl() {
  const explicit = normalizeString(process.env.CLINICAL_BRIDGE_CALLBACK_URL || process.env.PULSE_DEFAULT_CALLBACK_URL);
  if (explicit) return explicit;
  const siteUrl = normalizeBaseUrl(process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai');
  return `${siteUrl}/.netlify/functions/clinical-callback`;
}

function unwrapPartnerResponse(raw, fallbackData = {}) {
  if (!raw || typeof raw !== 'object') {
    return {
      success: false,
      data: fallbackData,
      error: { code: 'EMPTY_RESPONSE', message: 'Clinical provider returned an empty response.' },
      requestId: `clinical-empty-${Date.now()}`,
    };
  }

  if ('success' in raw || 'data' in raw || 'error' in raw) {
    return {
      success: raw.success !== false,
      data: raw.data || fallbackData,
      error: raw.error || null,
      requestId: raw.requestId || raw.request_id || `clinical-${Date.now()}`,
    };
  }

  return {
    success: true,
    data: { ...fallbackData, ...raw },
    error: null,
    requestId: raw.requestId || raw.request_id || `clinical-${Date.now()}`,
  };
}

function buildMockResponse(data, requestIdPrefix = 'clinical-mock') {
  return {
    success: true,
    data,
    error: null,
    requestId: `${requestIdPrefix}-${Date.now()}`,
    mock: true,
  };
}

function normalizeCreateEscalationResult(response, fallbackEscalationId) {
  const data = response.data || {};
  const escalationId =
    data.escalationId
    || data.escalation_id
    || data.id
    || data.caseId
    || data.case_id
    || data.handoffId
    || fallbackEscalationId
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

  async request(method, endpoint, body, options = {}) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Pulse-Integration': 'true',
      ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      ...(options.headers || {}),
    };

    const startedAt = Date.now();
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
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
      httpStatus: response.status,
      ok: response.ok && normalized.success !== false,
      endpoint: path,
      durationMs: Date.now() - startedAt,
    };
  }

  async healthCheck() {
    if (this.config.explicitMock) {
      return buildMockResponse({
        provider: this.providerName,
        status: 'mock',
        baseUrl: this.config.baseUrl,
        checkedAt: nowIso(),
      }, 'clinical-health-mock');
    }

    const apiKey = this.config.apiKey;
    this.config.apiKey = '';
    try {
      return await this.request('GET', '/health', null, { headers: {} });
    } finally {
      this.config.apiKey = apiKey;
    }
  }

  async upsertAthlete(input = {}) {
    const externalId = normalizeString(input.externalId || input.pulseUserId || input.userId);
    if (!externalId) throw new Error('externalId is required for clinical athlete upsert.');
    if (this.config.mock) {
      return buildMockResponse({
        athleteId: `ae-${externalId.slice(0, 12)}`,
        externalId,
        status: 'active',
        createdAt: nowIso(),
      }, 'clinical-athlete-mock');
    }

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

    if (this.config.mock) {
      const isCritical = Number(payload.tier) >= 3 || payload.escalationTier === 'critical';
      return normalizeCreateEscalationResult(buildMockResponse({
        escalationId: `ae-${escalationRecordId.slice(0, 12)}`,
        status: isCritical ? 'assigned' : 'received',
        estimatedContactTime: isCritical ? 'Within 15 minutes' : 'Within 24 hours',
        clinicianAssigned: isCritical ? { id: 'mock-clinician', name: 'Mock Clinical Lane', role: 'Clinical Support' } : null,
      }, 'clinical-escalation-mock'), `ae-${escalationRecordId.slice(0, 12)}`);
    }

    const response = await this.request('POST', '/escalations', {
      ...payload,
      pulseApiCallback: callbackUrl,
    });
    return normalizeCreateEscalationResult(response, null);
  }

  async getAthleteStatus(externalId) {
    const id = normalizeString(externalId);
    if (!id) throw new Error('externalId is required for clinical athlete status.');
    if (this.config.mock) {
      return buildMockResponse({
        athleteId: `ae-${id.slice(0, 12)}`,
        externalId: id,
        escalationStatus: 'none',
        clinicianId: null,
      }, 'clinical-status-mock');
    }
    return this.request('GET', `/athletes/${encodeURIComponent(id)}/status`);
  }

  async getCareState(externalId) {
    const id = normalizeString(externalId);
    if (!id) throw new Error('externalId is required for clinical care state.');
    if (this.config.mock) {
      return buildMockResponse({
        athleteId: `ae-${id.slice(0, 12)}`,
        externalId: id,
        watchList: false,
        appState: 'normal',
        returnToTrainingStatus: 'cleared',
      }, 'clinical-care-state-mock');
    }
    return this.request('GET', `/athletes/${encodeURIComponent(id)}/care-state`);
  }

  async resolveEscalation(escalationId, resolution = {}) {
    const id = normalizeString(escalationId);
    if (!id) throw new Error('escalation id is required for clinical resolution.');
    if (this.config.mock) {
      return buildMockResponse({
        escalationId: id,
        resolved: true,
        status: resolution.status || 'resolved',
      }, 'clinical-resolve-mock');
    }
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
  resolveClinicalBridgeConfig,
};
