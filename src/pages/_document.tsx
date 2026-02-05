// pages/_document.tsx
import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html lang="en">
        <Head>
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

          {/*
            OG / Twitter meta tags are NOT set here.
            They are set per-page via <PageHead /> so crawlers see exactly one
            set of og:image / og:title tags.  Putting defaults in _document
            causes DUPLICATE tags that break link previews on iMessage, Slack, etc.
          */}
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
