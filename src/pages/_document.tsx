// pages/_document.tsx
import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

// Default OG image generator URL - creates branded images dynamically
const DEFAULT_OG_IMAGE = 'https://fitwithpulse.ai/og-image.png?title=Pulse';
const DEFAULT_TITLE = 'Pulse Community Fitness';
const DEFAULT_DESCRIPTION = 'Real workouts, Real people, move together.';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          <title>{DEFAULT_TITLE}</title>
          <meta name="description" content={DEFAULT_DESCRIPTION} />
          
          {/* DNS Prefetch & Preconnect for external resources - reduces connection time */}
          <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com" />
          <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
          <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
          <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://api-js.mixpanel.com" />
          <link rel="preconnect" href="https://api-js.mixpanel.com" crossOrigin="anonymous" />
          
          {/* Preload critical fonts to reduce request waterfall */}
          <link
            rel="preload"
            href="/fonts/Thunder-LC.ttf"
            as="font"
            type="font/ttf"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/fonts/HKGrotesk-Regular.otf"
            as="font"
            type="font/opentype"
            crossOrigin="anonymous"
          />
          
          {/* Font Awesome - Load only the solid icons subset for better performance */}
          {/* Using CSS to load asynchronously to not block rendering */}
          <link 
            rel="preload"
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/fontawesome.min.css"
            as="style"
          />
          <link 
            rel="preload"
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css"
            as="style"
          />
          <link 
            rel="stylesheet" 
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/fontawesome.min.css"
            media="print"
            // @ts-ignore - onLoad is valid for link elements
            onLoad="this.media='all'"
          />
          <link 
            rel="stylesheet" 
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css"
            media="print"
            // @ts-ignore - onLoad is valid for link elements
            onLoad="this.media='all'"
          />
          <noscript>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/fontawesome.min.css" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css" />
          </noscript>
          
          {/* Default OpenGraph Meta Tags - these apply to ALL pages automatically */}
          {/* Individual pages can override these by setting their own og:* meta tags */}
          <meta property="og:site_name" content="Pulse Fitness" />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://fitwithpulse.ai" />
          <meta property="og:image" content={DEFAULT_OG_IMAGE} />
          <meta property="og:image:secure_url" content={DEFAULT_OG_IMAGE} />
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:title" content={DEFAULT_TITLE} />
          <meta property="og:description" content={DEFAULT_DESCRIPTION} />
          
          {/* Default Twitter Card Meta Tags */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
          <meta name="twitter:title" content={DEFAULT_TITLE} />
          <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />
          
          {/* Default theme color */}
          <meta name="theme-color" content="#E0FE10" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
