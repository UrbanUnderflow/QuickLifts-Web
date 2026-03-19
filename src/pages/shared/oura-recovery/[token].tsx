import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import admin from '../../../lib/firebase-admin';
import { resolveOuraRecoverySharePreviewMeta } from '../../../lib/sharePreviewMeta';

const COLLECTION = 'pulsecheck-oura-recovery-shares';

type SharedOuraRecoveryMetric = {
  title: string;
  value: string;
  statusLabel: string;
  explanation: string;
  comparisonDetail: string;
  personalDetail: string;
};

type SharedOuraRecoveryPageProps = {
  share: {
    token: string;
    athleteName: string;
    profileHeadline: string;
    edge: string;
    risk: string;
    bestMove: string;
    syncLabel: string | null;
    createdAt: string | null;
    metrics: SharedOuraRecoveryMetric[];
  };
  ogMeta: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
};

function splitParagraphs(value: string): string[] {
  return String(value || '')
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const SharedOuraRecoveryPage = ({
  share,
  ogMeta,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  return (
    <>
      <Head>
        <title>{ogMeta.title}</title>
        <meta name="description" content={ogMeta.description} />
        <meta property="og:title" content={ogMeta.title} />
        <meta property="og:description" content={ogMeta.description} />
        <meta property="og:image" content={ogMeta.image} />
        <meta property="og:url" content={ogMeta.url} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogMeta.title} />
        <meta name="twitter:description" content={ogMeta.description} />
        <meta name="twitter:image" content={ogMeta.image} />
      </Head>

      <main className="shared-oura-page">
        <div className="shared-oura-shell">
          <section className="shared-oura-hero">
            <div className="shared-oura-brand-row">
              <span className="shared-oura-brand-pill">PulseCheck</span>
              <span className="shared-oura-meta-pill">Oura recovery detail</span>
            </div>

            <h1>{share.athleteName}&apos;s recovery read</h1>
            <p className="shared-oura-hero-copy">{share.profileHeadline}</p>

            <div className="shared-oura-meta">
              <span>Shared from PulseCheck</span>
              {share.syncLabel ? <span>Latest Oura sync {share.syncLabel}</span> : null}
              <span>
                {share.createdAt
                  ? new Date(share.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Recently shared'}
              </span>
            </div>
          </section>

          <section className="shared-oura-summary-grid">
            <article className="shared-oura-summary-card">
              <p className="shared-oura-summary-kicker">Today&apos;s edge</p>
              <p>{share.edge}</p>
            </article>
            <article className="shared-oura-summary-card">
              <p className="shared-oura-summary-kicker">Today&apos;s risk</p>
              <p>{share.risk}</p>
            </article>
            <article className="shared-oura-summary-card shared-oura-summary-card-accent">
              <p className="shared-oura-summary-kicker">Best move today</p>
              <p>{share.bestMove}</p>
            </article>
          </section>

          <section className="shared-oura-metrics">
            <div className="shared-oura-section-heading">
              <p className="shared-oura-eyebrow">Signal breakdown</p>
              <h2>What the numbers suggest today</h2>
              <p>
                PulseCheck turns Oura signals into a training-facing read by combining the raw metric, how it compares,
                and what that could change for the athlete today.
              </p>
            </div>

            <div className="shared-oura-metric-grid">
              {share.metrics.map((metric) => (
                <article key={metric.title} className="shared-oura-metric-card">
                  <div className="shared-oura-metric-header">
                    <div>
                      <p className="shared-oura-metric-title">{metric.title}</p>
                      <p className="shared-oura-metric-value">{metric.value}</p>
                    </div>
                    <span className="shared-oura-status-pill">{metric.statusLabel}</span>
                  </div>

                  <div className="shared-oura-copy-block">
                    <p className="shared-oura-copy-label">What this signal tracks</p>
                    {splitParagraphs(metric.explanation).map((paragraph) => (
                      <p key={`${metric.title}-explanation-${paragraph}`}>{paragraph}</p>
                    ))}
                  </div>

                  <div className="shared-oura-copy-block">
                    <p className="shared-oura-copy-label">How this number compares</p>
                    {splitParagraphs(metric.comparisonDetail).map((paragraph) => (
                      <p key={`${metric.title}-comparison-${paragraph}`}>{paragraph}</p>
                    ))}
                  </div>

                  <div className="shared-oura-copy-block shared-oura-copy-block-strong">
                    <p className="shared-oura-copy-label">What this may change today</p>
                    {splitParagraphs(metric.personalDetail).map((paragraph) => (
                      <p key={`${metric.title}-personal-${paragraph}`}>{paragraph}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>

      <style jsx>{`
        .shared-oura-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(16, 185, 129, 0.18), transparent 32%),
            linear-gradient(180deg, #060814 0%, #090b17 52%, #05060f 100%);
          color: #f8fafc;
        }

        .shared-oura-shell {
          width: min(1120px, calc(100vw - 32px));
          margin: 0 auto;
          padding: 48px 0 80px;
        }

        .shared-oura-hero,
        .shared-oura-summary-card,
        .shared-oura-metric-card {
          border: 1px solid rgba(110, 231, 183, 0.16);
          background: rgba(9, 13, 27, 0.86);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(18px);
        }

        .shared-oura-hero {
          border-radius: 32px;
          padding: 32px;
        }

        .shared-oura-brand-row,
        .shared-oura-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .shared-oura-brand-pill,
        .shared-oura-meta-pill,
        .shared-oura-status-pill,
        .shared-oura-meta span {
          border-radius: 999px;
          border: 1px solid rgba(110, 231, 183, 0.16);
          background: rgba(17, 24, 39, 0.7);
          color: rgba(236, 253, 245, 0.9);
        }

        .shared-oura-brand-pill,
        .shared-oura-meta-pill {
          padding: 9px 14px;
          font-size: 0.78rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 700;
        }

        .shared-oura-hero h1 {
          margin: 18px 0 14px;
          font-size: clamp(2.3rem, 5vw, 4.4rem);
          line-height: 0.96;
          letter-spacing: -0.05em;
        }

        .shared-oura-hero-copy {
          max-width: 760px;
          margin: 0 0 22px;
          font-size: clamp(1.05rem, 1.6vw, 1.32rem);
          line-height: 1.65;
          color: rgba(226, 232, 240, 0.84);
        }

        .shared-oura-meta span {
          padding: 10px 14px;
          font-size: 0.88rem;
          color: rgba(203, 213, 225, 0.9);
        }

        .shared-oura-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }

        .shared-oura-summary-card {
          border-radius: 26px;
          padding: 22px;
        }

        .shared-oura-summary-card-accent {
          background:
            linear-gradient(180deg, rgba(17, 24, 39, 0.82), rgba(10, 27, 25, 0.92)),
            rgba(9, 13, 27, 0.86);
        }

        .shared-oura-summary-kicker,
        .shared-oura-eyebrow,
        .shared-oura-copy-label,
        .shared-oura-metric-title {
          margin: 0 0 10px;
          font-size: 0.78rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(167, 243, 208, 0.72);
          font-weight: 700;
        }

        .shared-oura-summary-card p:last-child {
          margin: 0;
          font-size: 1.08rem;
          line-height: 1.7;
          color: rgba(248, 250, 252, 0.94);
        }

        .shared-oura-metrics {
          margin-top: 48px;
        }

        .shared-oura-section-heading {
          max-width: 760px;
          margin-bottom: 22px;
        }

        .shared-oura-section-heading h2 {
          margin: 10px 0 12px;
          font-size: clamp(1.8rem, 3vw, 2.8rem);
          line-height: 1.02;
          letter-spacing: -0.04em;
        }

        .shared-oura-section-heading p:last-child {
          margin: 0;
          color: rgba(203, 213, 225, 0.8);
          line-height: 1.75;
          font-size: 1rem;
        }

        .shared-oura-metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .shared-oura-metric-card {
          border-radius: 30px;
          padding: 24px;
        }

        .shared-oura-metric-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .shared-oura-metric-value {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.04em;
          color: #ffffff;
        }

        .shared-oura-status-pill {
          padding: 8px 12px;
          font-size: 0.82rem;
          font-weight: 700;
          color: #d1fae5;
          white-space: nowrap;
        }

        .shared-oura-copy-block {
          padding-top: 16px;
          margin-top: 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .shared-oura-copy-block p {
          margin: 0 0 10px;
          color: rgba(226, 232, 240, 0.84);
          line-height: 1.72;
        }

        .shared-oura-copy-block p:last-child {
          margin-bottom: 0;
        }

        .shared-oura-copy-block-strong {
          border-top-color: rgba(110, 231, 183, 0.18);
        }

        @media (max-width: 900px) {
          .shared-oura-summary-grid,
          .shared-oura-metric-grid {
            grid-template-columns: 1fr;
          }

          .shared-oura-shell {
            width: min(100vw - 24px, 760px);
            padding: 20px 0 48px;
          }

          .shared-oura-hero,
          .shared-oura-summary-card,
          .shared-oura-metric-card {
            border-radius: 24px;
          }
        }
      `}</style>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<SharedOuraRecoveryPageProps> = async ({
  params,
  req,
  res,
}) => {
  const token = typeof params?.token === 'string' ? params.token : '';
  if (!token) return { notFound: true };

  try {
    const docSnap = await admin.firestore().collection(COLLECTION).doc(token).get();
    if (!docSnap.exists) return { notFound: true };

    const data = docSnap.data() || {};
    if (data.revokedAt) return { notFound: true };

    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const ogMeta = resolveOuraRecoverySharePreviewMeta({
      token,
      athleteName: typeof data.athleteName === 'string' ? data.athleteName : 'Athlete',
      profileHeadline: typeof data.profileHeadline === 'string' ? data.profileHeadline : '',
      siteOrigin,
    });

    const metrics = Array.isArray(data.metrics)
      ? data.metrics
          .filter((metric): metric is SharedOuraRecoveryMetric => {
            return Boolean(
              metric &&
                typeof metric.title === 'string' &&
                typeof metric.value === 'string' &&
                typeof metric.statusLabel === 'string'
            );
          })
          .map((metric) => ({
            title: metric.title,
            value: metric.value,
            statusLabel: metric.statusLabel,
            explanation: typeof metric.explanation === 'string' ? metric.explanation : '',
            comparisonDetail: typeof metric.comparisonDetail === 'string' ? metric.comparisonDetail : '',
            personalDetail: typeof metric.personalDetail === 'string' ? metric.personalDetail : '',
          }))
      : [];

    if (metrics.length === 0) return { notFound: true };

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

    return {
      props: {
        share: {
          token,
          athleteName: typeof data.athleteName === 'string' ? data.athleteName : 'Athlete',
          profileHeadline: typeof data.profileHeadline === 'string' ? data.profileHeadline : '',
          edge: typeof data.edge === 'string' ? data.edge : '',
          risk: typeof data.risk === 'string' ? data.risk : '',
          bestMove: typeof data.bestMove === 'string' ? data.bestMove : '',
          syncLabel: typeof data.syncLabel === 'string' ? data.syncLabel : null,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          metrics,
        },
        ogMeta,
      },
    };
  } catch (error) {
    console.error('[shared/oura-recovery] Failed to load share link:', error);
    return { notFound: true };
  }
};

export default SharedOuraRecoveryPage;
