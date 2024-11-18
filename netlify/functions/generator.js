const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

exports.handler = async function (event, context) {
    // Path to local Chrome for local testing
    let localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    let executable = fs.existsSync(localChrome) ? localChrome : await chromium.executablePath;

    // Launch Puppeteer with the specified executable path
    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: executable,
        headless: true,
        defaultViewport: { height: 630, width: 1200 } // Standard OG image size
    });

    try {
        const page = await browser.newPage();

        // Read the template HTML from the assets directory
        let content = fs.readFileSync(__dirname + '/assets/image.html').toString();

        // Extract parameters from the query string
        const title = event.queryStringParameters?.title || 'Default Title';
        const subtitle = event.queryStringParameters?.subtitle || 'Default Subtitle';

        // Replace placeholders in the HTML template
        content = content.replace(/{{ title }}/g, title);
        content = content.replace(/{{ subtitle }}/g, subtitle);

        // Set the content of the page with the populated template
        await page.setContent(content, {
            waitUntil: 'domcontentloaded',
        });

        // Take a screenshot and encode it as base64
        const screenshot = await page.screenshot({ encoding: 'base64' });

        // Close the browser
        await browser.close();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 's-maxage=86400' // Cache for one day
            },
            body: screenshot,
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('Error generating image:', error);

        // Close the browser if an error occurs
        if (browser) {
            await browser.close();
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate image' }),
        };
    }
};
