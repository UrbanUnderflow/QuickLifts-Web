# PulseCheck School Wearable Bundle Plan

## 1. Objective

Package PulseCheck as a school-ready offering that combines software, team onboarding, and an optional Pulse-branded wearable so schools can buy one system instead of assembling their own device stack.

## 2. Strategic Thesis

Schools are already asking which wearables athletes should use. A bundled hardware option gives PulseCheck a clearer answer:

- Reduce onboarding friction by standardizing the device lane.
- Reduce support burden from mixed-device troubleshooting.
- Increase contract value by bundling software, hardware, replacements, and team operations.
- Preserve flexibility with a bring-your-own-device fallback for schools that already have Apple Watch, Oura, Garmin, or other supported devices.

The recommended first move is not custom hardware from scratch. The recommended first move is an OEM screenless band under Pulse branding, paired with PulseCheck as the system of record.

## 3. Recommended Product Shape

### North Star Offer

**PulseCheck Team Bundle**

- PulseCheck software licenses
- Team onboarding and provisioning
- Pulse-branded screenless recovery band
- Coach and athlete support
- Device replacement and charger logistics
- Admin reporting and roster-level device status

### First Hardware Direction

Use a screenless band instead of a smartwatch.

Why:

- Simpler for schools to issue and manage
- Lower distraction during class, lifts, practice, and team travel
- Better replacement economics than a full watch
- Easier to position as a recovery and readiness tool rather than a general-purpose consumer device
- Closer to the "team equipment" mental model schools already understand

### Required MVP Signals

The first Pulse band should focus on signals that support coaching and adherence without overcomplicating hardware selection:

- Sleep duration and sleep consistency
- Resting heart rate
- Heart-rate variability, only if the OEM signal quality is reliable
- Daily activity and training load proxy
- Wear time and sync status
- Battery status

Avoid requiring advanced claims or research-grade positioning in V1.

## 4. Bundle Architecture

### Bundle Tiers

| Tier | Target Buyer | Hardware Posture | Notes |
| --- | --- | --- | --- |
| Software Only | Schools with existing wearables | BYOD | PulseCheck supports Apple Watch, Oura, Garmin, and approved sources. |
| Team Bundle | Schools that want standardization | Pulse-branded OEM band included | Best default package for new school contracts. |
| Team Bundle Plus | Schools that want higher service levels | Band plus replacements, premium ops, and analytics reviews | Best for larger departments or pilot-to-rollout expansions. |

### Recommended Commercial Positioning

Lead with two options in every school conversation:

1. PulseCheck software with flexible BYOD support
2. PulseCheck Team Bundle with Pulse-issued wearables

This keeps the sales motion flexible while making the bundled offer feel like the premium and operationally easier path.

## 5. Operating Model

### What Pulse Owns

- Athlete and coach onboarding workflow
- Device assignment to athlete roster
- Consent and permissions workflow
- Sync health, freshness, and source-status UX
- Team admin reporting
- Replacement policy and hardware support playbook
- Canonical health-context pipeline inside PulseCheck

### What The OEM Should Own

- Device manufacturing
- Base firmware stability
- Charging hardware
- Certification test artifacts already completed at the component or finished-product level
- Replacement manufacturing and batch QA

### What Must Not Happen

Do not let the OEM app and cloud become the primary system of record. The Pulse app and PulseCheck pipeline should own athlete identity, team mapping, source precedence, freshness, and reporting.

## 6. School Buyer Value Proposition

### Athletic Department Benefits

- One vendor instead of separate software and wearable vendors
- Faster athlete setup at the start of term, season, or camp
- Cleaner compliance and support process
- Better team-wide consistency for dashboards and reporting
- Easier budget framing because hardware can be bundled per athlete

### Coach Benefits

- Less troubleshooting across mixed devices
- More consistent readiness and recovery inputs across the roster
- Clearer missing-data detection
- Easier accountability because every athlete has the same baseline equipment

### Athlete Benefits

- Simple team-issued device
- No smartwatch distraction
- No need to compare or shop for a personal wearable
- Faster setup and lower app confusion

## 7. First Device Spec

The first Pulse band spec should be strict and boring in the best way.

### Required

- Screenless wrist form factor
- 5 to 7 day battery minimum
- Waterproof or sweat-resistant for regular training use
- BLE connectivity
- Reliable heart-rate capture during rest and sleep
- Sleep and activity summaries exposed through SDK or API
- White-label hardware branding options
- Custom packaging options
- Team-friendly replacement purchasing

### Preferred

- HRV support
- Strap color customization
- Private-label app skinning or SDK access
- Bulk device provisioning tools
- Firmware update path controlled or coordinated by Pulse

### Avoid In V1

- Medical claims
- Fancy display hardware
- Feature sprawl such as messaging, notifications, or watch-like apps
- OEMs that require the athlete to live inside a separate consumer app to get useful data

## 8. Vendor Scorecard

Score vendors on a 1 to 5 scale and require a minimum threshold before pilot launch.

| Category | Weight | What Good Looks Like |
| --- | --- | --- |
| Signal quality | 25% | Sleep, resting HR, and wear-time data are stable enough for team use. |
| API or SDK access | 20% | Pulse can ingest data directly or through a controlled white-label layer. |
| White-label readiness | 15% | Device, packaging, and app surfaces can be branded for Pulse. |
| School ops fit | 15% | Bulk ordering, spare units, charger availability, and replacement logistics are clean. |
| Unit economics | 10% | Margin supports bundled pricing without killing adoption. |
| Certification posture | 10% | Vendor can provide Bluetooth, FCC, and related product documentation. |
| Manufacturing reliability | 5% | MOQ, lead times, and defect rates are acceptable for a pilot. |

### Vendor Questions

- Do we get direct SDK or API access, or are we forced into the OEM app?
- Can athlete data flow into Pulse as the system of record?
- What is the minimum order quantity?
- What are typical defect and replacement rates?
- Can the device be branded on hardware, packaging, charger, and inserts?
- What Bluetooth and FCC documentation can the vendor provide today?
- Can the vendor support a school pilot with 100 to 300 units before a larger rollout?
- What is the battery life under real use, not marketing use?

## 9. Commercial Model

### Recommended Pricing Structure

Do not lead by selling hardware as a standalone SKU. Lead with per-athlete bundled pricing.

Example packaging:

- Software Only: per athlete, per month
- Team Bundle: per athlete, per month plus hardware included in the contract term
- Team Bundle Plus: per athlete, per month plus premium support and replacement pool

### Margin Logic

Your margin should come from the bundle, not only the hardware markup.

Model the offer using:

- Hardware landed cost
- Packaging cost
- Freight and fulfillment cost
- Expected replacement rate
- Charger and accessory reserve
- Support cost per athlete
- Software gross margin

### Recommended Commercial Rules

- Include one device and one charger per athlete in the standard bundle.
- Build a replacement reserve into the contract price.
- Offer a lost-device fee schedule in the school agreement.
- Default to annual contracts for bundled hardware deals.
- Keep BYOD available so hardware is an upsell, not a blocker.

## 10. Implementation Plan

### Phase 1: Bundle Design

Target window: 2 to 3 weeks

- Lock the first hardware profile for a screenless Pulse band.
- Define the software-only versus bundled-school packaging.
- Build the vendor scorecard and shortlist 3 to 5 OEM candidates.
- Confirm which data fields map cleanly into the current PulseCheck canonical source-record model.

### Phase 2: Vendor Diligence

Target window: 2 to 4 weeks

- Request sample units from shortlist vendors.
- Review SDK, API, app, cloud, and firmware constraints.
- Score signal quality, battery life, sync reliability, and packaging options.
- Confirm MOQ, unit pricing, lead times, and replacement terms.

### Phase 3: Pilot Readiness

Target window: 4 to 6 weeks

- Create device assignment, inventory, and replacement workflows.
- Add school-facing onboarding scripts and support docs.
- Add device status fields to team admin reporting.
- Prepare pilot contracts with hardware language, replacement rules, and support scope.

### Phase 4: Controlled School Pilot

Target window: 1 school partner or 1 team first

- Start with one school or a single team within a school.
- Limit initial rollout to a manageable cohort.
- Measure activation, wear adherence, sync freshness, support tickets, and coach satisfaction.
- Compare outcomes against BYOD teams where possible.

### Phase 5: Scale Or Kill

- Scale if the bundle improves close rate, activation speed, athlete adherence, and contract value.
- Kill or narrow the lane if support complexity overwhelms the margin or if the data quality is not meaningfully better than BYOD.

## 11. Success Metrics

Track the bundle as a business line, not just a device experiment.

### Sales Metrics

- School close rate with hardware bundle versus software-only offer
- Average contract value
- Percentage of school deals choosing the bundle

### Activation Metrics

- Time from contract signature to athlete activation
- Device assignment completion rate
- First-week sync rate

### Product Metrics

- Daily wear adherence
- Weekly sync freshness
- Coach dashboard coverage rate across roster
- Missing-data rate versus BYOD cohorts

### Unit Economics Metrics

- Landed hardware cost per athlete
- Replacement rate
- Support tickets per 100 athletes
- Gross margin by contract

## 12. Compliance Guardrails

This lane should stay inside general wellness positioning unless a later strategy explicitly expands the regulatory scope.

### Claims Guardrails

Safe V1 language:

- readiness
- recovery
- sleep consistency
- training context
- wellness trends
- athlete support

Avoid:

- diagnosis
- treatment
- injury detection claims
- medical-grade promises
- clinical-grade accuracy claims unless independently supported

### Operational Guardrails

- Confirm Bluetooth qualification requirements for the Pulse-branded finished product before sale or distribution.
- Confirm FCC authorization and marketer responsibility before U.S. distribution.
- Require the OEM to provide certification and test documentation as part of diligence.
- Keep school marketing language in the general wellness category unless counsel advises otherwise.

Reference links:

- Bluetooth qualification: <https://www.bluetooth.com/develop-with-bluetooth/qualify/>
- Bluetooth promotional-item guidance: <https://support.bluetooth.com/hc/en-us/articles/360049492331-My-company-creates-promotional-items-for-companies-to-distribute-as-giveaways-Do-these-products-need-to-undergo-and-pass-Bluetooth-Qualification>
- FCC equipment authorization overview: <https://www.fcc.gov/engineering-technology/laboratory-division/general/equipment-authorization>
- FDA general wellness guidance: <https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices>

## 13. Recommended Decision

Move forward with a bundled wearable lane if the following conditions are true:

- Pulse remains the system of record.
- The OEM can support white-label branding without forcing a separate consumer app dependency.
- The landed unit economics work at school-contract scale.
- The first pilot proves simpler onboarding and better roster consistency than BYOD.

Do not move into fully custom hardware until the bundle has already proven:

- better school close rates
- meaningful attach rate
- acceptable support burden
- credible replacement economics

## 14. Immediate Next Steps

1. Build a shortlist of 3 to 5 screenless band OEMs.
2. Create a vendor diligence worksheet using the scorecard above.
3. Define the exact PulseCheck source fields required for V1 hardware ingestion.
4. Draft school bundle pricing options with software-only and hardware-included versions.
5. Choose one pilot buyer profile: college team, high school athletic department, or private performance academy.
