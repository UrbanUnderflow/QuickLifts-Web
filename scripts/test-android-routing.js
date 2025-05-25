#!/usr/bin/env node

/**
 * Test script to verify Android routing fixes
 * Run with: node scripts/test-android-routing.js
 */

const https = require('https');
const http = require('http');

const SITE_URL = process.env.SITE_URL || 'https://fitwithpulse.ai';

// Test routes that should work
const testRoutes = [
  '/',
  '/about',
  '/rounds',
  '/creator',
  '/subscribe',
  '/round/test-round-id',
  '/round-invitation/test-invitation',
  '/profile/testuser',
  '/payment/test-payment',
  '/admin/test-admin',
  '/nonexistent-page', // Should return 404 but not crash
];

// Android User Agents to test with
const androidUserAgents = [
  'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 9; SM-A505FN) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/13.2 Chrome/83.0.4103.106 Mobile Safari/537.36',
];

function makeRequest(url, userAgent) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
    };

    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          url: url,
          userAgent: userAgent.split(')')[0] + ')', // Shortened UA for display
        });
      });
    });

    req.on('error', (error) => {
      reject({
        error: error.message,
        url: url,
        userAgent: userAgent.split(')')[0] + ')', // Shortened UA for display
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        url: url,
        userAgent: userAgent.split(')')[0] + ')', // Shortened UA for display
      });
    });

    req.end();
  });
}

async function testRoute(route, userAgent) {
  const fullUrl = `${SITE_URL}${route}`;
  
  try {
    const result = await makeRequest(fullUrl, userAgent);
    
    const isSuccess = result.statusCode >= 200 && result.statusCode < 400;
    const is404 = result.statusCode === 404;
    const isRedirect = result.statusCode >= 300 && result.statusCode < 400;
    
    console.log(`${isSuccess ? '✅' : is404 ? '⚠️' : '❌'} ${result.statusCode} ${route}`);
    
    if (isRedirect) {
      console.log(`   → Redirects to: ${result.headers.location}`);
    }
    
    if (!isSuccess && !is404) {
      console.log(`   → Error: ${result.statusCode}`);
    }
    
    // Check if response contains expected content
    if (isSuccess && result.body) {
      const hasReactRoot = result.body.includes('id="root"') || result.body.includes('id="__next"');
      const hasTitle = result.body.includes('<title>');
      const hasMetaTags = result.body.includes('<meta');
      
      if (!hasReactRoot && !hasTitle) {
        console.log(`   ⚠️  Response may not be properly rendered`);
      }
    }
    
    return { success: isSuccess || is404, route, statusCode: result.statusCode };
    
  } catch (error) {
    console.log(`❌ ERROR ${route}: ${error.error}`);
    return { success: false, route, error: error.error };
  }
}

async function runTests() {
  console.log(`🧪 Testing Android routing for: ${SITE_URL}\n`);
  
  for (const userAgent of androidUserAgents) {
    console.log(`\n📱 Testing with: ${userAgent.split(')')[0]})`);
    console.log('─'.repeat(60));
    
    const results = [];
    
    for (const route of testRoutes) {
      const result = await testRoute(route, userAgent);
      results.push(result);
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\n📊 Results: ${successCount}/${totalCount} routes working`);
    
    if (successCount < totalCount) {
      console.log('\n❌ Failed routes:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   • ${r.route}: ${r.error || r.statusCode}`);
      });
    }
  }
  
  console.log('\n✅ Testing complete!');
  console.log('\n💡 Tips for Android users experiencing issues:');
  console.log('   • Clear browser cache and cookies');
  console.log('   • Try refreshing the page');
  console.log('   • Use Chrome or Firefox instead of Samsung Browser');
  console.log('   • Check network connection');
}

// Run the tests
runTests().catch(console.error); 