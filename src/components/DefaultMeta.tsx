import Head from 'next/head';
import { useRouter } from 'next/router';

// Base defaults
const previewImageUrl = '/PulseWeb.png';
const siteUrl = 'https://fitwithpulse.ai';
const title = 'Pulse | Community Workouts & Fitness Challenges';
const description = 'Beat your best, share your victory. Join the Pulse fitness community for AI-powered workouts, challenges, and more!';

// Simple route‑level meta overrides or skips
//  - If `disableDefault` is true, DefaultMeta will render nothing for that route.
//  - Otherwise, provided fields (title, description, image) override the base defaults.
interface RouteMetaConfig {
  title?: string;
  description?: string;
  image?: string;
  disableDefault?: boolean;
}

const routeMetaMap: Record<string, RouteMetaConfig> = {
  // Skip defaults for round invitation pages which have their own meta component
  '/round-invitation/[id]': { disableDefault: true },

  // Example: override defaults for landing page
  // '/': {
  //   title: 'Pulse – Your AI fitness community',
  //   description: 'AI‑powered workouts, real‑time challenges, and more.'
  // }
};

const DefaultMeta: React.FC = () => {
  const router = useRouter();

  // Determine overrides / behaviour for current route
  const routeConfig = routeMetaMap[router.pathname] || {};

  if (routeConfig.disableDefault) {
    // Skip rendering any default meta for routes that manage their own tags
    return null;
  }

  const finalTitle = routeConfig.title ?? title;
  const finalDescription = routeConfig.description ?? description;
  const finalImage = routeConfig.image ?? previewImageUrl;

  const urlForMeta = `${siteUrl}${router.asPath}`;

  return (
    <Head>
      <title key="title">{finalTitle}</title>
      <meta key="description" name="description" content={finalDescription} />

      {/* Open Graph Meta Tags */}
      <meta key="og:title" property="og:title" content={finalTitle} />
      <meta key="og:description" property="og:description" content={finalDescription} />
      <meta key="og:type" property="og:type" content="website" />
      <meta key="og:url" property="og:url" content={urlForMeta} />
      <meta key="og:site_name" property="og:site_name" content="Pulse Fitness" />
      <meta key="og:image" property="og:image" content={`${siteUrl}${finalImage}`} />
      <meta key="og:image:width" property="og:image:width" content="1200" />
      <meta key="og:image:height" property="og:image:height" content="630" />
      <meta key="og:image:alt" property="og:image:alt" content="Pulse Fitness Web Preview" />

      {/* Twitter Meta Tags */}
      <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
      <meta key="twitter:site" name="twitter:site" content="@fitwithpulse" />
      <meta key="twitter:creator" name="twitter:creator" content="@fitwithpulse" />
      <meta key="twitter:title" name="twitter:title" content={finalTitle} />
      <meta key="twitter:description" name="twitter:description" content={finalDescription} />
      <meta key="twitter:image" name="twitter:image" content={`${siteUrl}${finalImage}`} />
      <meta key="twitter:image:alt" name="twitter:image:alt" content="Pulse Fitness Web Preview" />

      {/* Canonical */}
      <link key="canonical" rel="canonical" href={urlForMeta} />
      <meta key="theme-color" name="theme-color" content="#E0FE10" />
    </Head>
  );
};

export default DefaultMeta; 