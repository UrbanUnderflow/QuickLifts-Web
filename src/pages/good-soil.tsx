import Head from 'next/head';

const title = 'PulseCheck | Good Soil';
const description = 'Meet PulseCheck and connect with founder Tremaine Grant.';
const url = 'https://pulsecheckmind.ai/good-soil';

export default function GoodSoilPage() {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
      </Head>
      <main className="good-soil">
        <a className="brand" href="https://pulsecheckmind.ai">PulseCheck</a>
        <section aria-labelledby="welcome">
          <p className="eyebrow">GOOD SOIL</p>
          <h1 id="welcome">The conversation<br />starts here.</h1>
          <p className="intro">Thanks for meeting PulseCheck. Let’s talk about mental performance, your athletes, and what we can build together.</p>
          <a className="contact" href="mailto:tre@fitwithpulse.ai?subject=Let%E2%80%99s%20connect%20after%20Good%20Soil">Connect with Tremaine <span aria-hidden="true">↗</span></a>
          <p className="signature">Tremaine Grant · Founder &amp; CEO<br /><a href="mailto:tre@fitwithpulse.ai">tre@fitwithpulse.ai</a></p>
        </section>
        <footer><a href="https://pulsecheckmind.ai">Explore PulseCheck <span aria-hidden="true">↗</span></a><span>Mental performance. Every day.</span></footer>
      </main>
      <style jsx>{`
        .good-soil { min-height: 100svh; background: #0b0d0c; color: #f5f5ee; padding: 36px max(24px, calc((100vw - 1120px) / 2)); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; }
        a { color: inherit; text-decoration: none; }
        a:focus-visible { outline: 3px solid #d0ff00; outline-offset: 6px; }
        .brand { font-size: 26px; font-weight: 750; letter-spacing: -1px; color: #d0ff00; align-self: flex-start; }
        section { padding: 96px 0 88px; flex: 1; }
        .eyebrow { color: #b7bbb6; font-size: 12px; letter-spacing: 3px; margin: 0 0 24px; }
        h1 { font-size: clamp(44px, 7vw, 86px); line-height: 1.03; letter-spacing: -0.05em; font-weight: 650; margin: 0 0 28px; }
        .intro { max-width: 550px; color: #b7bbb6; font-size: 18px; line-height: 1.65; margin: 0 0 36px; }
        .contact { display: inline-flex; gap: 32px; align-items: center; padding: 18px 24px; border-radius: 10px; background: #d0ff00; color: #10130b; font-weight: 650; }
        .contact:hover { background: #e0ff66; }
        .signature { color: #b7bbb6; font-size: 14px; line-height: 1.8; margin-top: 24px; }
        .signature a { text-decoration: underline; text-underline-offset: 4px; }
        footer { display: flex; justify-content: space-between; gap: 24px; border-top: 1px solid #2a2e29; padding-top: 24px; font-size: 13px; color: #b7bbb6; }
        @media (max-width: 600px) { section { padding: 72px 0 56px; } footer { flex-direction: column; gap: 12px; } .intro { font-size: 17px; } }
      `}</style>
    </>
  );
}

export function getStaticProps() {
  return { props: { ogMeta: { title, description, url, siteName: 'PulseCheck', image: 'https://pulsecheckmind.ai/pulseCheckIcon.png' } } };
}
