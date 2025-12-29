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
          {/* Add Font Awesome for admin icons */}
          <link 
            rel="stylesheet" 
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
            integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" 
            crossOrigin="anonymous" 
            referrerPolicy="no-referrer" 
          />
          
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
