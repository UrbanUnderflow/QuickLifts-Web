/** Product identity is independent of staff permissions and installed app identity. */
const PRODUCTS = Object.freeze({
  athleticmind: Object.freeze({ brand: 'athleticmind', displayName: 'AthleticMind', escalationModel: 'aunt-edna' }),
  pulsecheck: Object.freeze({ brand: 'pulsecheck', displayName: 'PulseCheck', escalationModel: '988' }),
});
function normalizeProductBrand(value) {
  // Presentation fallback only. Server routing requires validated persisted configuration.
  return value === 'athleticmind' ? 'athleticmind' : 'pulsecheck';
}
function resolveProductConfig(organization) {
  return PRODUCTS[normalizeProductBrand(organization?.productBrand)];
}
function resolveAppBranding(organization, appIdentity) {
  if (!Object.prototype.hasOwnProperty.call(PRODUCTS, appIdentity)) throw new Error('Unknown app identity');
  const override = organization?.appBranding?.[appIdentity];
  const product = PRODUCTS[Object.prototype.hasOwnProperty.call(PRODUCTS, override) ? override : appIdentity];
  return { brand: product.brand, displayName: product.displayName };
}
function validateProductBrand(value) {
  if (value !== 'athleticmind' && value !== 'pulsecheck') throw new Error('Invalid product brand');
  return value;
}
function normalizeAppBranding(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid app branding');
  const result = {};
  for (const [identity, brand] of Object.entries(value)) {
    validateProductBrand(identity);
    if (brand != null) result[identity] = validateProductBrand(brand);
  }
  return result;
}
// Presentation only: this setting never selects program processing or care routes.
function resolveAppExperience(value) {
  return { ios: value?.ios === 'clay' ? 'clay' : 'standard', android: value?.android === 'clay' ? 'clay' : 'standard' };
}
function normalizeAppExperience(value, existing) {
  const result = resolveAppExperience(existing);
  if (value === undefined) return result;
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length ||
      Object.entries(value).some(([key, appearance]) => !['ios', 'android'].includes(key) || !['standard', 'clay'].includes(appearance))) {
    throw new Error('Invalid app appearance');
  }
  return { ...result, ...value };
}
module.exports = { resolveAppExperience, normalizeAppExperience, PRODUCTS, validateProductBrand, normalizeAppBranding, normalizeProductBrand, resolveProductConfig, resolveAppBranding };
