import React, { useState } from 'react';
import { Building2, Download, FileSignature, Loader2, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const INSTITUTION_ROWS = [
  ['University', '[University Name]'],
  ['Athletics Department', '[Athletics Department Name]'],
  ['Team / Program', '[Team / Program Name]'],
  ['Pilot Dates', '[Start Date] to [End Date]'],
];

const FERPA_ROWS = [
  ['Records or information involved', 'School-linked athletics records, education-record fields, or other university-linked pilot data only as specifically identified in the pilot materials.'],
  ['Purpose of disclosure or use', 'To invite athletes, operate the voluntary pilot, support configured support workflows, and review pilot operations.'],
  ['Receiving parties or class of recipients', 'PulseCheck, AuntEdna, authorized athletics staff, sports medicine staff, and approved support partners participating in the pilot workflow.'],
];

const AUTHORIZATION_ITEMS = [
  'The Athletics Department authorizes PulseCheck to invite eligible student-athletes in the identified team or program to review disclosures and voluntarily opt into the pilot.',
  'The department authorizes identified department staff to coordinate pilot logistics, distribute invites, and answer athlete questions about enrollment and participation.',
  'The department understands that AuntEdna is participating as an approved pilot partner for support, escalation, and related workflow operations described in the participant disclosures and pilot materials.',
  'This memo authorizes a limited pilot only and does not obligate the university or department to purchase services, expand the pilot, or enter a longer-term relationship.',
];

const PILOT_SUMMARY_ITEMS = [
  'Participation is opt-in only and not a condition of team membership, scholarship status, roster status, care access, or receipt of athletics benefits.',
  'Pilot workflows may include check-ins, readiness or recovery signals, session activity, survey responses, escalation or support workflow events, and connected wearable or health data the participant affirmatively authorizes.',
  'Some parts of the pilot may be incomplete, experimental, or subject to change during the pilot period.',
];

const DATA_BOUNDARY_ITEMS = [
  'The pilot should follow a minimum-necessary approach for collection, use, and disclosure.',
  'Participant-facing disclosures and invite materials should describe what categories of information may be collected, used, or disclosed, for what purpose, and to whom.',
  'This memo does not authorize unrestricted access to student records, medical records, or protected health information.',
];

const EMERGENCY_ITEMS = [
  'PulseCheck is not emergency response, not crisis care, and not a substitute for medical care, mental health treatment, or emergency services.',
  'AuntEdna may participate in configured support or escalation workflows, but this memo does not replace university emergency procedures, mandated reporting duties, campus safety procedures, clinician judgment, or licensed care obligations.',
  'The Athletics Department remains responsible for its own institutional emergency, reporting, and student-support procedures unless and until a later written agreement states otherwise.',
];

const OPERATIONS_ITEMS = [
  'PulseCheck may provide participant-facing onboarding, disclosures, and pilot notices.',
  'PulseCheck and AuntEdna may operate the pilot workflow described in the participant materials.',
  'The Athletics Department may identify staff points of contact for coordination, follow-up, and participant questions.',
  'The parties may review aggregated or de-identified pilot feedback and operational learnings to decide whether a longer-term arrangement should be considered.',
];

const CONTACT_ROWS = [
  ['PulseCheck contact', 'Tremaine Grant', 'tre@fitwithpulse.ai'],
  ['AuntEdna contact', 'Dr. Tracey', 'tracey@auntedna.ai'],
  ['Athletics Department contact', '[Name]', '[Title, email]'],
  ['Sports medicine / support contact', '[Name]', '[Title, email]'],
];

const STATUS_ITEMS = [
  'This memo is intended to document department-level pilot authorization and operating expectations for a limited pre-contract pilot.',
  'It does not create exclusivity, pricing commitments, guaranteed service levels, broad indemnity obligations, or university-wide contracting authority.',
  'Those items, if needed, should be addressed in later institutional agreements.',
];

const PDF_FILENAME = 'AuntEdna-University-Athletics-Pilot-Authorization-Memo.pdf';

function buildBulletHtml(items: string[]) {
  return items
    .map(
      (item) => `
        <li style="margin-bottom:8px; line-height:1.55; color:#243042;">
          <span style="display:inline-block; width:7px; height:7px; margin-right:10px; border-radius:999px; background:#d7ff00;"></span>
          <span style="display:inline;">${item}</span>
        </li>
      `,
    )
    .join('');
}

function generatePilotMemoPdfMarkup() {
  const generatedAt = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return `
    <div style="width:7.65in; background:#f6f1e8; color:#101726; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:0.22in;">
      <div style="border-radius:26px; overflow:hidden; border:1px solid rgba(15,23,42,0.08); background:#ffffff; box-shadow:0 18px 60px rgba(15,23,42,0.12);">
        <div style="padding:28px 30px; background:linear-gradient(135deg,#0b1020 0%,#182238 55%,#0d4f55 100%); color:#f8fafc;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
            <div>
              <div style="font-size:10px; letter-spacing:0.24em; text-transform:uppercase; color:rgba(215,255,0,0.82); font-weight:700; margin-bottom:10px;">
                AuntEdna Pilot Letter
              </div>
              <div style="font-size:28px; line-height:1.05; font-weight:800; max-width:450px;">
                University Athletics Pilot Authorization Memo
              </div>
              <div style="margin-top:12px; max-width:500px; font-size:12.5px; line-height:1.65; color:rgba(248,250,252,0.76);">
                Pre-contract department memo for a limited, voluntary PulseCheck pilot operated in partnership with AuntEdna.
              </div>
            </div>
            <div style="min-width:150px; border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:14px 16px; background:rgba(255,255,255,0.06);">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(248,250,252,0.55);">Generated</div>
              <div style="margin-top:6px; font-size:13px; font-weight:700;">${generatedAt}</div>
              <div style="margin-top:12px; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(248,250,252,0.55);">Status</div>
              <div style="margin-top:6px; font-size:12px; line-height:1.5; color:rgba(248,250,252,0.8);">Department authorization template only</div>
            </div>
          </div>
        </div>

        <div style="padding:26px 30px 18px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
            <div style="border:1px solid #e6e0d6; border-radius:20px; background:#fbf8f1; padding:16px;">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Memo frame</div>
              <div style="font-size:13px; line-height:1.62; color:#243042;">
                This memo records Athletics Department permission for a limited, voluntary PulseCheck pilot run with AuntEdna and is not a substitute for a later MSA, DSA, BAA, or university-wide contract if one becomes necessary.
              </div>
            </div>
            <div style="border:1px solid #dfe8b4; border-radius:20px; background:#f6ffd2; padding:16px;">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#5c621f; font-weight:700; margin-bottom:10px;">Fill before signature</div>
              <div style="font-size:13px; line-height:1.62; color:#243042;">
                Replace the university, athletics department, team, pilot dates, and department contact placeholders before sending for signature.
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px;">
            <div style="border:1px solid #ece7de; border-radius:20px; background:#ffffff; padding:18px;">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Institution</div>
              ${INSTITUTION_ROWS.map(
                ([label, value]) => `
                  <div style="display:flex; justify-content:space-between; gap:14px; padding:7px 0; border-bottom:1px solid #f1ece4;">
                    <div style="font-size:12px; color:#6b7280;">${label}</div>
                    <div style="font-size:12px; font-weight:700; color:#101726; text-align:right;">${value}</div>
                  </div>
                `,
              ).join('')}
            </div>
            <div style="border:1px solid #ece7de; border-radius:20px; background:#ffffff; padding:18px;">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Key contacts</div>
              ${CONTACT_ROWS.map(
                ([role, name, email]) => `
                  <div style="padding:8px 0; border-bottom:1px solid #f1ece4;">
                    <div style="font-size:11px; color:#6b7280;">${role}</div>
                    <div style="margin-top:2px; font-size:12px; font-weight:700; color:#101726;">${name}</div>
                    <div style="margin-top:2px; font-size:11px; color:#1f4b68;">${email}</div>
                  </div>
                `,
              ).join('')}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1.08fr 0.92fr; gap:16px; margin-bottom:16px;">
            <div style="border:1px solid #ece7de; border-radius:20px; background:#ffffff; padding:18px;">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Pilot summary</div>
              <ul style="margin:0; padding:0; list-style:none;">${buildBulletHtml(PILOT_SUMMARY_ITEMS)}</ul>
            </div>
            <div style="border:1px solid #ece7de; border-radius:20px; background:#ffffff; padding:18px;">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Department authorization</div>
              <ul style="margin:0; padding:0; list-style:none;">${buildBulletHtml(AUTHORIZATION_ITEMS)}</ul>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
            <div style="border:1px solid #ece7de; border-radius:20px; background:#ffffff; padding:18px;">
              <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Data and records boundary</div>
              <ul style="margin:0; padding:0; list-style:none;">${buildBulletHtml(DATA_BOUNDARY_ITEMS)}</ul>
              <div style="margin-top:12px; padding:12px 14px; border-radius:16px; background:#f7f9fc; border:1px solid #e5edf5;">
                <div style="font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:#5a6980; font-weight:700; margin-bottom:8px;">FERPA-style specificity</div>
                ${FERPA_ROWS.map(
                  ([label, value]) => `
                    <div style="margin-bottom:8px;">
                      <div style="font-size:11px; font-weight:700; color:#243042;">${label}</div>
                      <div style="margin-top:2px; font-size:11px; line-height:1.52; color:#556274;">${value}</div>
                    </div>
                  `,
                ).join('')}
              </div>
            </div>
            <div style="display:grid; grid-template-rows:1fr 1fr; gap:16px;">
              <div style="border:1px solid #ece7de; border-radius:20px; background:#ffffff; padding:18px;">
                <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Emergency and care boundary</div>
                <ul style="margin:0; padding:0; list-style:none;">${buildBulletHtml(EMERGENCY_ITEMS)}</ul>
              </div>
              <div style="border:1px solid #ece7de; border-radius:20px; background:#ffffff; padding:18px;">
                <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:10px;">Pilot operations and status</div>
                <ul style="margin:0; padding:0; list-style:none;">${buildBulletHtml(OPERATIONS_ITEMS)}</ul>
                <div style="margin-top:10px; padding-top:10px; border-top:1px solid #ede7dc;">
                  <ul style="margin:0; padding:0; list-style:none;">${buildBulletHtml(STATUS_ITEMS)}</ul>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top:18px; border:1px solid #ece7de; border-radius:22px; background:#fffdfa; padding:18px 18px 20px;">
            <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#706b61; font-weight:700; margin-bottom:12px;">Signatures</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">
              ${[
                ['Athletics Department Representative', '[Name]', '[Title]'],
                ['Pulse Intelligence Labs, Inc.', 'Tremaine Grant', '[Title]'],
                ['AuntEdna', 'Dr. Tracey', '[Title]'],
              ]
                .map(
                  ([entity, name, title]) => `
                    <div style="padding:14px 12px; border-radius:18px; background:#ffffff; border:1px solid #efe8dd;">
                      <div style="font-size:11px; font-weight:800; color:#101726; min-height:34px;">${entity}</div>
                      <div style="margin-top:26px; border-top:1px solid #b7b2a9; padding-top:8px; font-size:11px; color:#243042;">Signature</div>
                      <div style="margin-top:16px; font-size:11px; color:#6b7280;">Name</div>
                      <div style="margin-top:2px; font-size:12px; font-weight:700; color:#101726;">${name}</div>
                      <div style="margin-top:10px; font-size:11px; color:#6b7280;">Title</div>
                      <div style="margin-top:2px; font-size:12px; font-weight:700; color:#101726;">${title}</div>
                      <div style="margin-top:16px; border-top:1px solid #b7b2a9; padding-top:8px; font-size:11px; color:#243042;">Date</div>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

const AuntEdnaPilotAuthorizationMemoTab: React.FC = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (typeof window === 'undefined') return;
    setIsDownloading(true);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '8.15in';
    container.style.zIndex = '-1';
    container.style.pointerEvents = 'none';
    container.innerHTML = generatePilotMemoPdfMarkup();
    document.body.appendChild(container);

    try {
      const html2pdf = (await import('html2pdf.js')).default as any;
      await html2pdf()
        .from(container)
        .set({
          margin: 0.15,
          filename: PDF_FILENAME,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#f6f1e8',
            logging: false,
          },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .save();
    } catch (error) {
      console.error('Failed to generate AuntEdna pilot memo PDF', error);
      window.alert('There was an error generating the PDF. Please try again.');
    } finally {
      container.remove();
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="AuntEdna Pilot Letter"
        title="University Athletics Pilot Authorization Memo"
        version="Pre-Contract Pilot Template | April 8, 2026"
        summary="One-page, pre-contract pilot memo for department-level authorization of a limited, voluntary PulseCheck pilot operated in partnership with AuntEdna. Use this before a full university agreement exists, then replace the institution placeholders and route it for signature."
        highlights={[
          {
            title: 'Built For Pre-Contract Pilots',
            body: 'This memo documents department permission to run an opt-in pilot without pretending to be a full university-wide services agreement.',
          },
          {
            title: 'AuntEdna Is Explicitly Covered',
            body: 'The memo names AuntEdna as an approved pilot partner for support, escalation, and related workflow operations.',
          },
          {
            title: 'Ready To Share',
            body: 'Use the export button to generate a neatly formatted PDF with placeholders, contacts, and signature blocks ready for review.',
          },
        ]}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/40 hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{isDownloading ? 'Preparing PDF…' : 'Download PDF Memo'}</span>
        </button>
      </div>

      <RuntimeAlignmentPanel
        sectionLabel="Authorization Memo"
        role="Department-facing pre-contract memo for athletics teams that want a voluntary, opt-in pilot before a full university agreement is in place."
        sourceOfTruth="This page is authoritative for the default AuntEdna and PulseCheck pilot memo language, including department authorization scope, minimum-necessary data posture, emergency boundary, and default partner contacts."
        masterReference="Use this document when you need a lightweight pilot authorization letter for athletics leadership, sports medicine, or a department contact before a broader institutional agreement exists."
        relatedDocs={[
          'AuntEdna Integration Strategy',
          'Exhibit A - Data Architecture',
          'PulseCheck Team & Pilot Onboarding',
          'Pilot Participation + Privacy Disclosures',
        ]}
      />

      <SectionBlock icon={Building2} title="Purpose and Institution Fields">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Purpose"
            accent="blue"
            body="This memo records the Athletics Department’s permission for a limited, voluntary PulseCheck pilot operated by Pulse Intelligence Labs, Inc. in partnership with AuntEdna. It is meant for a pre-contract pilot period and is not a substitute for a later MSA, DSA, BAA, or university-wide contract if those become necessary."
          />
          <InfoCard
            title="Fill Before Sending"
            accent="amber"
            body="Replace the university, athletics department, team or program, pilot dates, and department support contacts before exporting the final PDF for signature."
          />
        </CardGrid>
        <DataTable columns={['Field', 'Value to complete']} rows={INSTITUTION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Pilot Summary and Department Authorization">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Pilot Summary" accent="purple" body={<BulletList items={PILOT_SUMMARY_ITEMS} />} />
          <InfoCard title="Department Authorization" accent="green" body={<BulletList items={AUTHORIZATION_ITEMS} />} />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Data, Records, and FERPA-Style Specificity">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Minimum-Necessary Boundary" accent="blue" body={<BulletList items={DATA_BOUNDARY_ITEMS} />} />
          <InfoCard
            title="Current Pilot Data Scope"
            accent="purple"
            body="Pilot workflows may include check-ins, readiness or recovery signals, session activity, survey responses, escalation or support workflow events, and connected wearable or health data the participant affirmatively authorizes."
          />
        </CardGrid>
        <DataTable columns={['FERPA-style item', 'What the pilot materials should identify']} rows={FERPA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Stethoscope} title="Emergency Boundary and Operating Expectations">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Emergency and Care Boundary" accent="red" body={<BulletList items={EMERGENCY_ITEMS} />} />
          <InfoCard title="Pilot Operations" accent="green" body={<BulletList items={OPERATIONS_ITEMS} />} />
        </CardGrid>
        <InfoCard title="Memo Status" accent="amber" body={<BulletList items={STATUS_ITEMS} />} />
      </SectionBlock>

      <SectionBlock icon={FileSignature} title="Contacts and Signatures">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Default Partner Contacts"
            accent="blue"
            body="PulseCheck defaults to Tremaine Grant at tre@fitwithpulse.ai and AuntEdna defaults to Dr. Tracey at tracey@auntedna.ai until a pilot-specific contact block is supplied."
          />
          <InfoCard
            title="Signature Posture"
            accent="purple"
            body="Use this memo for department-level authorization and acknowledgment only. It is designed to be signed by the athletics department, Pulse Intelligence Labs, and AuntEdna."
          />
        </CardGrid>
        <DataTable columns={['Role', 'Default name', 'Email or completion field']} rows={CONTACT_ROWS} />
        <DataTable
          columns={['Signature block', 'Name line', 'Title line']}
          rows={[
            ['Athletics Department Representative', '[Name]', '[Title]'],
            ['Pulse Intelligence Labs, Inc.', 'Tremaine Grant', '[Title]'],
            ['AuntEdna', 'Dr. Tracey', '[Title]'],
          ]}
        />
      </SectionBlock>
    </div>
  );
};

export default AuntEdnaPilotAuthorizationMemoTab;
