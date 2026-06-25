import path from 'path';

import type { GetServerSideProps } from 'next';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import HomePage from '../../web/app/home';
import type { BrandCampaignBannerProps } from '../../web/components/BrandCampaignBanner';
import {
  isActiveWithinWindow,
  isTierOneBrand,
  toDate,
} from '../../web/lib/brandCampaigns';

type HomeRouteProps = {
  initialCampaign: BrandCampaignBannerProps | null;
};

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(require(path.join(process.cwd(), 'serviceAccountKey.json'))),
    });
  }

  return getFirestore();
}

export const getServerSideProps: GetServerSideProps<HomeRouteProps> = async () => {
  const db = getAdminDb();
  const snapshot = await db.collection('brandCampaigns').get();
  const now = new Date();

  const campaigns = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      const brandName = typeof data.brandName === 'string' ? data.brandName.trim() : '';
      const campaignTitle = typeof data.campaignTitle === 'string' ? data.campaignTitle.trim() : '';
      const ctaText = typeof data.ctaText === 'string' ? data.ctaText.trim() : '';
      const ctaLink = typeof data.ctaLink === 'string' ? data.ctaLink.trim() : '';
      const logoUrl = typeof data.logoUrl === 'string' ? data.logoUrl.trim() : '';
      const activeFrom = toDate(data.activeFrom);
      const activeTo = toDate(data.activeTo);

      if (!brandName || !campaignTitle || !ctaText || !ctaLink) {
        return null;
      }

      return {
        brandName,
        logoUrl,
        campaignTitle,
        ctaText,
        ctaLink,
        activeFrom,
        activeTo,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((campaign) => isTierOneBrand(campaign.brandName))
    .filter((campaign) =>
      isActiveWithinWindow({
        activeFrom: campaign.activeFrom,
        activeTo: campaign.activeTo,
        now,
      })
    )
    .sort((left, right) => {
      const leftStart = left.activeFrom?.getTime() ?? 0;
      const rightStart = right.activeFrom?.getTime() ?? 0;
      return rightStart - leftStart;
    });

  const activeCampaign = campaigns[0] || null;

  return {
    props: {
      initialCampaign: activeCampaign
        ? {
            brandName: activeCampaign.brandName,
            logoUrl: activeCampaign.logoUrl,
            campaignTitle: activeCampaign.campaignTitle,
            ctaText: activeCampaign.ctaText,
            ctaLink: activeCampaign.ctaLink,
            activeFrom: activeCampaign.activeFrom?.toISOString() || null,
            activeTo: activeCampaign.activeTo?.toISOString() || null,
          }
        : null,
    },
  };
};

export default HomePage;
