import React from "react";
import { notFound } from "next/navigation";

import BrandCommunityPage from "../../../components/partners/BrandCommunityPage";
import { getBrandCampaignBySlug } from "../../../lib/brandCampaigns";

// Dynamic partner-facing route for brand community pitches.
// Example: /partners/brands/gymshark

type PageProps = {
  params: {
    brandSlug: string;
  };
};

export default async function BrandPartnerPage({ params }: PageProps) {
  const { brandSlug } = params;

  const brandProps = await getBrandCampaignBySlug(brandSlug);

  if (!brandProps) {
    notFound();
  }

  return <BrandCommunityPage {...brandProps} />;
}
