const defaults = require('../../../src/content/consents/defaults.json');
const pulsecheck = require('../../../src/content/consents/pulsecheck-only.json');

// Mirror client selection: authoritative team terms, optional study terms, exact stock replacement.
function resolveClinicalConsentDocuments({ teamDocuments, pilot = null, productBrand }) {
  if (!['pulsecheck', 'athleticmind'].includes(productBrand)) return [];
  const valid = docs => (Array.isArray(docs) ? docs : []).filter(doc => doc && doc.id && doc.title && doc.body && doc.version);
  const stock = [defaults.participation, defaults.health, ...(pilot?.studyMode === 'research' ? [defaults.research] : [])];
  const obsolete = new Set(['pulsecheck-team-participation-v1', 'pulsecheck-data-privacy-v1',
    'pulsecheck-research-study-consent-v1', 'pulsecheck-research-data-authorization-v1',
    'pulsecheck-pilot-participation-notice-v1', 'pulsecheck-pilot-privacy-and-data-use-v1',
    'pulsecheck-operational-participation-notice-v1', 'pulsecheck-operational-privacy-and-sharing-v1']);
  const versionNumber = version => Number(String(version).match(/\d+/)?.[0] || 0);
  const pilotCustom = valid(pilot?.requiredConsents).filter(doc => !obsolete.has(doc.id)
    && !stock.some(original => original.id === doc.id && versionNumber(doc.version) < versionNumber(original.version)));
  const pilotDocs = [...new Map([...stock, ...pilotCustom].map(doc => [doc.id, doc])).values()];
  const team = valid(teamDocuments);
  const selected = team.length ? [...team] : pilotDocs;
  if (team.length && pilot?.studyMode === 'research') {
    for (const doc of pilotDocs.filter(doc => doc.category === 'research' || (!doc.category && doc.id.includes('research')))) {
      if (!selected.some(existing => existing.id === doc.id)) selected.push(doc);
    }
  }
  if (!selected.some(doc => doc.category === 'health_authorization' || doc.id === defaults.health.id)) selected.push(defaults.health);
  return selected.filter(doc => doc.category !== 'staff').map(doc => {
    if (productBrand !== 'pulsecheck') return doc;
    const key = ['participation', 'health'].find(key => ['id', 'title', 'body', 'version', 'category'].every(field => doc[field] === defaults[key][field]));
    return key ? { ...pulsecheck[key] } : doc;
  });
}

// Operational authorization applies independently of event-specific handoff consent.
function clinicalAuthorizationAllowsTransfer({ documents = [], decisions = {}, participationEnded = false, tier = 2 }) {
  // Urgent safety routing uses its separately configured emergency/safety basis.
  if (Number(tier) >= 3) return true;
  const applicable = documents.filter(doc => doc.category === 'health_authorization' || doc.id === 'pulsecheck-health-authorization');
  if (participationEnded || !applicable.length) return false;
  return applicable.every(doc => {
    const entry = decisions[doc.id];
    return entry?.decision === 'accepted' && entry.version === doc.version && entry.document?.body === doc.body && entry.document?.category === 'health_authorization' && Boolean(entry.signedName?.trim())
      && (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
  });
}
module.exports = { clinicalAuthorizationAllowsTransfer, resolveClinicalConsentDocuments };
