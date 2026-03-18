import React from 'react';
import { Activity, AlertTriangle, Building2, Database, FileText, ShieldCheck, Smartphone, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const linkClassName = 'text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200';

function SourceLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      className={linkClassName}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}

const POSITIONING_CARDS = [
  {
    title: 'Bundle The System, Not Just A Device',
    accent: 'blue' as const,
    body: 'The school offer should be software plus provisioning plus replacement operations plus the Pulse band. Hardware alone is not the product advantage.',
  },
  {
    title: 'Screenless Beats Smartwatch For Teams',
    accent: 'green' as const,
    body: 'A screenless band fits the team-issued equipment model better: cheaper, less distracting, easier to replace, and cleaner to position as readiness and recovery infrastructure.',
  },
  {
    title: 'OEM First, Custom Hardware Later',
    accent: 'amber' as const,
    body: 'The first lane should be a private-label OEM program. Only move into fully custom hardware after the bundle proves close-rate lift, attach rate, and acceptable support economics.',
  },
];

const BUNDLE_ROWS: Array<Array<React.ReactNode>> = [
  ['Software Only', 'Schools with an existing device mix', 'PulseCheck software, onboarding, admin reporting, BYOD integrations', 'Keeps hardware optional and protects deal flow.'],
  ['Team Bundle', 'New school contracts that want standardization', 'PulseCheck plus Pulse-branded screenless band, charger, provisioning, support, replacement rules', 'Recommended default package for school sales.'],
  ['Team Bundle Plus', 'Larger departments or higher-touch pilots', 'Everything in Team Bundle plus replacement pool, analytics review, and premium implementation support', 'Best fit once a school expands beyond the first team or pilot.'],
];

const DEVICE_SPEC_ROWS: Array<Array<React.ReactNode>> = [
  ['Required', 'Screenless wrist form factor', 'Keeps the device in the team-equipment lane instead of smartwatch territory.'],
  ['Required', '5 to 7 day battery minimum', 'Reduces charger friction and support burden for athletes and staff.'],
  ['Required', 'Reliable resting heart-rate and sleep capture', 'Supports the first usable readiness and recovery posture.'],
  ['Required', 'BLE sync plus SDK/API or controlled white-label app lane', 'Pulse must remain the system of record.'],
  ['Preferred', 'HRV if the vendor signal quality is credible', 'Useful, but not worth forcing a weak OEM choice.'],
  ['Preferred', 'Bulk provisioning and inventory support', 'Makes school rollouts materially easier.'],
  ['Avoid In V1', 'Display-heavy watch features, notifications, messaging, or broad medical claims', 'Adds distraction, complexity, and regulatory risk without helping the school bundle thesis.'],
];

const OEM_ROWS: Array<Array<React.ReactNode>> = [
  [
    <div key="jstyle-vendor" className="space-y-1">
      <p className="font-semibold text-white">J-Style</p>
      <p className="text-xs text-zinc-500">Screenless band and smart-ring oriented OEM / ODM vendor</p>
    </div>,
    'Strong fit if we want a white-label wearable partner already speaking the screenless-band language.',
    <div key="jstyle-capabilities" className="space-y-1 text-xs leading-relaxed">
      <p>Official-site positioning emphasizes screenless smart bands, white-label customization, and API / SDK / app / cloud integration.</p>
      <p>
        Sources:{' '}
        <SourceLink href="https://www.jointcorp.com/" label="J-Style site" />
        {' · '}
        <SourceLink href="https://www.jointcorp.com/product-cat/smart-bands/" label="smart bands page" />
      </p>
    </div>,
    'Need live diligence on MOQ, raw-data access, replacement terms, and whether the screenless band can run cleanly without an OEM-first user experience.',
  ],
  [
    <div key="goodway-vendor" className="space-y-1">
      <p className="font-semibold text-white">Goodway</p>
      <p className="text-xs text-zinc-500">General smart-band OEM / ODM manufacturer</p>
    </div>,
    'Strong fit if we want a more process-heavy OEM with explicit white-label app and SDK/API language.',
    <div key="goodway-capabilities" className="space-y-1 text-xs leading-relaxed">
      <p>Goodway states it offers hardware customization, branded packaging, app rebranding, SDK/API support, MOQ around 500 to 1000 units for standard OEM, and 30 to 45 day mass-production timelines.</p>
      <p>
        Source:{' '}
        <SourceLink href="https://www.goodwaytechs.com/smart-bands3.html" label="Goodway smart bands" />
      </p>
    </div>,
    'Useful benchmark vendor because the site also explicitly discusses FCC / CE / RoHS compliance. Still need to verify the finished-product path under Pulse branding.',
  ],
  [
    <div key="miaonova-vendor" className="space-y-1">
      <p className="font-semibold text-white">MiaoNova</p>
      <p className="text-xs text-zinc-500">Screenless-smart-band-focused OEM / ODM supplier</p>
    </div>,
    'Good exploratory fit if we want a vendor leaning harder into the screen-free category thesis.',
    <div key="miaonova-capabilities" className="space-y-1 text-xs leading-relaxed">
      <p>MiaoNova markets itself as a screenless smart-band supplier with custom OEM / ODM options and firmware integration for branded wearable programs.</p>
      <p>
        Sources:{' '}
        <SourceLink href="https://miaonova.com/" label="MiaoNova home" />
        {' · '}
        <SourceLink href="https://miaonova.com/screenless-band-oem-guide.html" label="screenless OEM guide" />
      </p>
    </div>,
    'Most useful as a screenless-category specialist, but we would need stronger diligence on manufacturing maturity, data access, and certification artifacts before pilot commitment.',
  ],
];

const SECONDARY_VENDOR_ROWS: Array<Array<React.ReactNode>> = [
  [
    'iSmarch',
    'Turnkey wearable / IoT solution provider positioning can be useful if we want a fuller ODM conversation rather than simple white-label execution.',
    <SourceLink href="https://ismarch.com/wp-content/uploads/2022/08/iSmarch-Smart-Wearables-and-IOT-Solutions-2022.pdf" label="iSmarch brochure" />,
  ],
];

const REGULATORY_ROWS: Array<Array<React.ReactNode>> = [
  [
    'FDA posture for V1',
    'Likely no FDA clearance or approval if the Pulse band stays in low-risk general wellness territory.',
    'This is an inference from FDA guidance. Keep claims in readiness, recovery, sleep, activity, and general wellness. Avoid diagnosis, treatment, injury detection, or clinical-grade promises.',
    <div key="fda-v1" className="space-y-1 text-xs leading-relaxed">
      <p>
        <SourceLink
          href="https://www.fda.gov/medical-devices/classify-your-medical-device/how-determine-if-your-product-medical-device"
          label="FDA: How to Determine if Your Product is a Medical Device"
        />
      </p>
      <p>
        <SourceLink
          href="https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices"
          label="FDA: General Wellness Policy for Low Risk Devices"
        />
      </p>
    </div>,
  ],
  [
    'If we cross into medical claims',
    'Expect a different FDA path.',
    'If the intended use becomes medical, the product may need device classification work, a 510(k) or other premarket pathway depending on classification, and establishment registration / device listing obligations.',
    <div key="fda-medical" className="space-y-1 text-xs leading-relaxed">
      <p>
        <SourceLink href="https://www.fda.gov/medical-devices/premarket-notification-510k" label="FDA: Premarket Notification 510(k)" />
      </p>
      <p>
        <SourceLink href="https://www.fda.gov/medical-devices/device-registration-and-listing/device-registration-and-listing" label="FDA: Device Registration and Listing" />
      </p>
    </div>,
  ],
  [
    'Bluetooth SIG',
    'Treat Pulse-branded hardware as our own end-user product for Bluetooth qualification purposes.',
    'Bluetooth SIG states end-user products that include Bluetooth technology and are sold, marketed, or distributed must complete qualification. Their support guidance also says promotional or co-branded end-user products still need qualification.',
    <div key="bluetooth" className="space-y-1 text-xs leading-relaxed">
      <p>
        <SourceLink href="https://www.bluetooth.com/develop-with-bluetooth/qualify/" label="Bluetooth qualification overview" />
      </p>
      <p>
        <SourceLink
          href="https://support.bluetooth.com/hc/en-us/articles/360049492331-My-company-creates-promotional-items-for-companies-to-distribute-as-giveaways-Do-these-products-need-to-undergo-and-pass-Bluetooth-Qualification"
          label="Bluetooth SIG promotional item guidance"
        />
      </p>
    </div>,
  ],
  [
    'FCC',
    'The finished product must be properly authorized before U.S. marketing.',
    'FCC guidance says before RF devices are marketed in the United States they must be properly authorized, labeled, and supported by the right disclosures and records. The marketer, importer, and retailer responsibilities still matter even when manufacturing is outsourced.',
    <div key="fcc" className="space-y-1 text-xs leading-relaxed">
      <p>
        <SourceLink href="https://www.fcc.gov/engineering-technology/laboratory-division/general/equipment-authorization" label="FCC equipment authorization" />
      </p>
      <p>
        <SourceLink href="https://docs.fcc.gov/public/attachments/DA-19-91A1_Rcd.pdf" label="FCC enforcement advisory" />
      </p>
    </div>,
  ],
];

const DILIGENCE_ROWS: Array<Array<React.ReactNode>> = [
  ['Data access', 'Can Pulse ingest through SDK/API or a controlled white-label app instead of forcing the OEM app to be the source of truth?'],
  ['Signal quality', 'Are sleep, resting HR, wear-time, and sync reliability good enough for team-wide deployment rather than individual hobby use?'],
  ['School ops fit', 'Can the vendor support samples, bulk provisioning, spare units, chargers, and replacement workflows without chaos?'],
  ['Commercials', 'What are the MOQ, landed cost, sample cost, mass-production lead time, and replacement economics?'],
  ['Certification artifacts', 'Can the vendor provide current Bluetooth, FCC, and test-document support for the exact product family we would private-label?'],
  ['Brand control', 'Can the band, packaging, insert, charger, and app layer all be branded for Pulse?'],
];

const PILOT_STEPS = [
  {
    title: 'Shortlist 3 OEMs and request samples',
    body: 'Start with one screenless-category specialist, one mature smart-band OEM, and one backup vendor so we are comparing more than pure price sheets.',
    owner: 'Partnership + product ops',
  },
  {
    title: 'Validate the data lane before pricing the bundle',
    body: 'Do not price or promise the Pulse band until we confirm the exact sync path, system-of-record posture, and the minimum viable signal set for school reporting.',
    owner: 'Integrations + product',
  },
  {
    title: 'Pilot with one school or one team first',
    body: 'The first bundle should be a controlled rollout with explicit device assignment, replacement rules, and support coverage rather than a broad department launch.',
    owner: 'Implementation + success',
  },
  {
    title: 'Compare against BYOD',
    body: 'Measure activation speed, sync freshness, wear adherence, support tickets, and coach confidence versus a comparable BYOD deployment where possible.',
    owner: 'Ops + analytics',
  },
  {
    title: 'Scale only if the bundle changes the economics',
    body: 'We should only expand the hardware lane if it improves close rate, contract value, roster consistency, or support simplicity enough to justify the extra operational load.',
    owner: 'Leadership',
  },
];

const SUCCESS_ROWS: Array<Array<React.ReactNode>> = [
  ['Sales', 'Bundle attach rate on school deals, contract value lift, and close-rate improvement over software-only proposals.'],
  ['Activation', 'Time from contract signature to athlete activation, first-week sync rate, and team-wide device assignment completion.'],
  ['Product', 'Daily wear adherence, weekly sync freshness, and coach dashboard coverage across the roster.'],
  ['Operations', 'Support tickets per 100 athletes, replacement rate, charger-loss rate, and gross margin after hardware ops.'],
];

const PulseCheckSchoolWearableBundlePlanTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck School Motion"
        title="School Wearable Bundle Plan"
        version="Version 0.1 | March 18, 2026"
        summary="Strategic plan for packaging PulseCheck as a school-ready bundle that combines software, onboarding, and a Pulse-branded screenless wearable. This artifact locks the current recommendation, outlines the first device shape, captures current OEM research, and records the U.S. regulatory posture that should gate the pilot."
        highlights={[
          {
            title: 'Recommended Path',
            body: 'Bundle an OEM screenless Pulse band with PulseCheck for schools instead of building custom hardware from scratch.',
          },
          {
            title: 'Regulatory Read',
            body: 'V1 can likely stay in low-risk general wellness territory if claims remain disciplined, but Bluetooth and FCC obligations still apply to a Pulse-branded product.',
          },
          {
            title: 'Decision Rule',
            body: 'Only scale the hardware lane if it improves close rate, roster consistency, and support simplicity enough to beat a software-only or BYOD model.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Commercial and platform-planning artifact for the school hardware bundle. It defines the recommended bundle posture, first device shape, OEM shortlist, diligence criteria, and the current U.S. regulatory read for launching a Pulse-branded wearable alongside PulseCheck."
        sourceOfTruth="Use this page when deciding whether to pursue a Pulse-branded school wearable, comparing OEM candidates, shaping pilot requirements, or checking which FDA, Bluetooth, and FCC questions must be answered before sale or distribution."
        masterReference="This artifact should be read alongside the Device Integration Strategy and Device Integration Partnership Matrix so school-bundle decisions stay aligned with the canonical PulseCheck health-context pipeline."
        relatedDocs={[
          'Device Integration Strategy',
          'Device Integration Partnership Matrix',
          'Oura Integration Strategy',
          'Health Context Architecture',
          'Health Context Source Record Spec',
        ]}
      />

      <SectionBlock icon={Building2} title="Why This Bundle Exists">
        <CardGrid columns="md:grid-cols-3">
          {POSITIONING_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={FileText} title="Recommended Package Structure">
        <DataTable columns={['Offer', 'Best Buyer', 'Included', 'Why It Exists']} rows={BUNDLE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Recommended Sales Motion"
            accent="green"
            body="Lead every school conversation with two paths: software-only BYOD and the Team Bundle with a Pulse-issued band. That keeps hardware from blocking deals while making the bundled option feel like the cleaner operational choice."
          />
          <InfoCard
            title="System-Of-Record Rule"
            accent="red"
            body="Do not let the OEM app or cloud become the primary truth. PulseCheck should own athlete identity, roster mapping, source precedence, freshness posture, and school reporting."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="First Device Shape">
        <DataTable columns={['Priority', 'Spec', 'Why']} rows={DEVICE_SPEC_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="OEM Shortlist Research">
        <DataTable columns={['Vendor', 'Why It Fits', 'Official-Site Signals', 'What We Still Need To Prove']} rows={OEM_ROWS} />
        <div className="mt-4">
          <DataTable columns={['Secondary Candidate', 'Why Keep It In View', 'Source']} rows={SECONDARY_VENDOR_ROWS} />
        </div>
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Current Favorite Vendor Shape"
            accent="blue"
            body="The strongest first-wave candidates are vendors that explicitly support screenless or health-band programs plus white-label app or SDK/API access. Goodway is the cleanest process-heavy benchmark from the current scan, while J-Style and MiaoNova look more aligned to the screenless category thesis."
          />
          <InfoCard
            title="Important Caution"
            accent="amber"
            body="These OEM notes are based on current official-site positioning and should be treated as lead-generation research, not final diligence. We still need samples, contract terms, data-path validation, and certification artifacts before choosing a pilot vendor."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="U.S. Regulatory Posture">
        <DataTable columns={['Area', 'Current Read', 'What It Means For Pulse', 'Official Source']} rows={REGULATORY_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="FDA Inference"
            accent="green"
            body="Based on current FDA guidance, a V1 school wearable focused on general wellness, readiness, sleep, and recovery likely does not need FDA clearance or approval. That changes quickly if we drift into diagnosis, treatment, injury detection, or clinical-accuracy claims."
          />
          <InfoCard
            title="Not A Free Pass"
            accent="red"
            body="Even if FDA clearance is not needed for V1, the hardware lane still carries real Bluetooth, FCC, support, labeling, and documentation obligations. A private-label device is still our product once Pulse branding is on it."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Vendor Diligence Checklist">
        <DataTable columns={['Question', 'Why It Matters']} rows={DILIGENCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Pilot Sequence">
        <StepRail steps={PILOT_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Success Metrics">
        <DataTable columns={['Metric Area', 'What Good Looks Like']} rows={SUCCESS_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Scale"
            accent="green"
            body={<BulletList items={['Bundle attach rate rises on school deals.', 'Close rate or ACV improves versus software-only proposals.', 'Coaches report better roster consistency than BYOD deployments.']} />}
          />
          <InfoCard
            title="Hold"
            accent="amber"
            body={<BulletList items={['Sales story improves but margins remain unclear.', 'Athlete activation improves but support burden is still noisy.', 'One vendor looks promising but the data path is not yet locked.']} />}
          />
          <InfoCard
            title="Kill"
            accent="red"
            body={<BulletList items={['Support and replacement burden overwhelms the margin.', 'The OEM forces a weak data path or app dependency.', 'The hardware bundle does not outperform BYOD enough to justify the extra work.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckSchoolWearableBundlePlanTab;
