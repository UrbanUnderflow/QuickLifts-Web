import * as Brevo from '@getbrevo/brevo';

interface SubscribeOptions {
  email: string;
  listKey?: 'generic' | 'mobility' | 'pulse-check-waitlist' | string;
  utmCampaign?: string;
  attributes?: Record<string, any>;
}

/**
 * Centralised helper that creates or updates a Brevo contact and adds to the correct list.
 * Throws on configuration errors so API routes can handle response codes.
 */
export async function handleBrevoSubscribe({ email, listKey, utmCampaign = 'generic', attributes = {} }: SubscribeOptions) {
  if (!process.env.BREVO_MARKETING_KEY) throw new Error('BREVO_MARKETING_KEY missing');

  const client = new Brevo.ContactsApi();
  client.setApiKey(Brevo.ContactsApiApiKeys.apiKey, process.env.BREVO_MARKETING_KEY);

  const LIST_MAP: Record<string, number | undefined> = {
    generic: 5,
    mobility: 6,
    'pulse-check-waitlist': 7, // You'll need to create this list in Brevo and update the ID
  };

  const chosenListId = listKey ? LIST_MAP[listKey] : LIST_MAP.generic;
  if (!chosenListId) throw new Error('List ID not configured for the given listKey');

  try {
    await client.createContact({
      email,
      listIds: [chosenListId],
      updateEnabled: true,
      attributes: { SOURCE: utmCampaign, ...attributes }
    });
  } catch (err: any) {
    // Brevo's SDK throws HttpError with response + body
    const detailed = err?.body || err?.response?.body || err?.message;
    console.error('Brevo createContact error:', detailed);
    throw new Error(typeof detailed === 'string' ? detailed : JSON.stringify(detailed));
  }
} 