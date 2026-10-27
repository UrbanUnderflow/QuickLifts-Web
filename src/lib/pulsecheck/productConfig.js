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
// Clay is the only app appearance. Installed iOS and Android builds still read
// appExperience from the branding endpoint and fall back to their retired
// standard look when it is missing, so every organization reports Clay.
const CLAY_APP_EXPERIENCE = Object.freeze({ ios: 'clay', android: 'clay' });
function resolveAppExperience() {
  return { ...CLAY_APP_EXPERIENCE };
}
module.exports = { resolveAppExperience, PRODUCTS, validateProductBrand, normalizeAppBranding, normalizeProductBrand, resolveProductConfig, resolveAppBranding };
