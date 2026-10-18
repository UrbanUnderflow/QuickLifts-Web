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
function resolveAppExperience(value) { return { ios: value?.ios === 'clay' ? 'clay' : 'standard' }; }
function normalizeAppExperience(value) {
  if (value === undefined) return { ios: 'standard' };
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'ios') || !['standard', 'clay'].includes(value.ios)) throw new Error('Invalid iOS app appearance');
  return { ios: value.ios };
}
module.exports = { resolveAppExperience, normalizeAppExperience, PRODUCTS, validateProductBrand, normalizeAppBranding, normalizeProductBrand, resolveProductConfig, resolveAppBranding };
