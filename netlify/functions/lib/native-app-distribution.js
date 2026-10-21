// Resolve installed-app routing from saved program identity, never display branding
// or a caller-supplied download/deep link.
async function resolveNativeAppDistribution(db, { pilotId, organizationId } = {}) {
  let resolvedOrganizationId = String(organizationId || '').trim();
  if (pilotId) {
    const pilot = await db.collection('pulsecheck-pilots').doc(String(pilotId)).get();
    if (!pilot.exists) throw new Error('Pilot was not found for app distribution.');
    resolvedOrganizationId = String(pilot.data()?.organizationId || '').trim();
    if (!resolvedOrganizationId) throw new Error('Pilot organization is missing.');
  }
  if (!resolvedOrganizationId) throw new Error('Organization is required for app distribution.');
  const organization = await db.collection('pulsecheck-organizations').doc(resolvedOrganizationId).get();
  if (!organization.exists) throw new Error('Organization was not found for app distribution.');
  const brand = organization.data()?.productBrand;
  if (brand !== 'pulsecheck' && brand !== 'athleticmind') {
    throw new Error('Organization productBrand must be configured before activation outreach.');
  }
  const name = brand === 'athleticmind' ? 'AthleticMind' : 'PulseCheck';
  let iosUrl = 'https://apps.apple.com/app/pulsecheck-mindset-coaching/id6747253393';
  if (brand === 'athleticmind') {
    iosUrl = '';
    try {
      const url = new URL(process.env.NEXT_PUBLIC_ATHLETICMIND_IOS_APP_STORE_URL || '');
      if (url.protocol === 'https:' && url.hostname === 'apps.apple.com' && /\/id\d+$/.test(url.pathname) &&
          !/\/id(6747253393|6451497729)$/.test(url.pathname)) iosUrl = url.toString();
    } catch {}
  }
  return { brand, name, openAppUrl: `${brand}://open`, iosUrl };
}
module.exports = { resolveNativeAppDistribution };
