import { test, expect } from '@playwright/test';

test.describe('OpenAI Bridge Proxy', () => {
  const bridgeUrl = 'http://localhost:8888/api/openai/v1/chat/completions';
  
  test('rejects unauthenticated requests with 401', async ({ request }) => {
    // Attempt to invoke the Netlify function proxy without a Bearer token
    const response = await request.post(bridgeUrl, {
      data: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }]
      }
    });

    // Should be unauthorized
    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  test('rejects requests with invalid authorization headers', async ({ request }) => {
    const response = await request.post(bridgeUrl, {
      headers: {
        'Authorization': 'Bearer invalid_fake_token_123'
      },
      data: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }]
      }
    });

    expect(response.status()).toBe(401);
  });
});
