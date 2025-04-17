import Head from 'next/head';

const previewImageUrl = '/PulseWeb.png';
const siteUrl = 'https://fitwithpulse.ai';
const title = 'Pulse | Community Workouts & Fitness Challenges';
const description = 'Beat your best, share your victory. Join the Pulse fitness community for AI-powered workouts, challenges, and more!';

const DefaultMeta = () => (
  <Head>
    <title key="title">{title}</title>
    <meta key="description" name="description" content={description} />
    {/* Open Graph Meta Tags */}
    <meta key="og:title" property="og:title" content={title} />
    <meta key="og:description" property="og:description" content={description} />
    <meta key="og:type" property="og:type" content="website" />
    <meta key="og:url" property="og:url" content={siteUrl} />
    <meta key="og:site_name" property="og:site_name" content="Pulse Fitness" />
    <meta key="og:image" property="og:image" content={`${siteUrl}${previewImageUrl}`} />
    <meta key="og:image:width" property="og:image:width" content="1200" />
    <meta key="og:image:height" property="og:image:height" content="630" />
    <meta key="og:image:alt" property="og:image:alt" content="Pulse Fitness Web Preview" />
    {/* Twitter Meta Tags */}
    <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
    <meta key="twitter:site" name="twitter:site" content="@fitwithpulse" />
    <meta key="twitter:creator" name="twitter:creator" content="@fitwithpulse" />
    <meta key="twitter:title" name="twitter:title" content={title} />
    <meta key="twitter:description" name="twitter:description" content={description} />
    <meta key="twitter:image" name="twitter:image" content={`${siteUrl}${previewImageUrl}`} />
    <meta key="twitter:image:alt" name="twitter:image:alt" content="Pulse Fitness Web Preview" />
    {/* Canonical */}
    <link key="canonical" rel="canonical" href={siteUrl} />
    <meta key="theme-color" name="theme-color" content="#E0FE10" />
  </Head>
);

export default DefaultMeta; 