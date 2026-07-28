import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/auntedna-clean-partnership-slide";
const STARTER = `${TMP_DIR}/template-starter.pptx`;
const FINAL_PPTX = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs/PIL_AuntEDNA_Clean_Strategic_Partnership_Slide.pptx";

const C = {
  white: "#F5F5F2",
  muted: "#ADB2BC",
  lime: "#C8FF00",
  pink: "#F65AAF",
  purple: "#9B72FF",
  blue: "#4D8FFF",
};

function move(shape, left, top, width, height) {
  shape.position.merge({ left, top, width, height });
}

function restyle(shape, options = {}) {
  shape.text.style = {
    typeface: "Arial",
    fontSize: options.fontSize ?? 16,
    bold: options.bold ?? false,
    color: options.color ?? C.white,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    autoFit: options.autoFit ?? "shrinkText",
    wrap: options.wrap ?? "square",
    insets: options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  const presentation = await PresentationFile.importPptx(await FileBlob.load(STARTER));
  const snapshot = await presentation.inspect({
    kind: "slide,shape,textbox,image,notes",
    maxChars: 30000,
  });
  const records = snapshot.ndjson
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const slide = presentation.resolve(records.find((record) => record.kind === "slide").id);
  const get = (name) => {
    const record = records.find((item) => item.name === name);
    if (!record) throw new Error(`Missing inherited object: ${name}`);
    return presentation.resolve(record.id);
  };
  const images = records.filter((record) => record.kind === "image");
  const findImage = (predicate, label) => {
    const record = images.find(predicate);
    if (!record) throw new Error(`Missing inherited image: ${label}`);
    return presentation.resolve(record.id);
  };

  // Section and headline
  const sectionPill = get("section-pill");
  move(sectionPill, 56, 30, 310, 40);
  const sectionLabel = get("section-label");
  sectionLabel.text = "STRATEGIC PARTNERSHIP";
  move(sectionLabel, 98, 39, 235, 22);
  restyle(sectionLabel, { fontSize: 14, bold: true, color: C.white });

  const headlineWhite = get("headline-white");
  headlineWhite.text = "AuntEDNA.ai brings clinical care + an";
  move(headlineWhite, 56, 88, 620, 48);
  restyle(headlineWhite, { fontSize: 34, bold: true, color: C.white });

  const headlineAccent = get("headline-accent");
  headlineAccent.text = "active NCAA pipeline.";
  move(headlineAccent, 677, 88, 547, 48);
  restyle(headlineAccent, { fontSize: 34, bold: true, color: C.pink });

  const subtitle = get("subtitle");
  subtitle.text =
    "PulseCheck owns detection, scoring and routing. AuntEDNA adds clinical escalation, research validation and institutional access.";
  move(subtitle, 56, 145, 1168, 34);
  restyle(subtitle, { fontSize: 20, color: C.muted, verticalAlignment: "middle" });

  // Remove the redundant full-height Tracey action image and its fade.
  findImage(
    (record) => record.bbox?.[2] === 148 && record.bbox?.[3] === 350,
    "Tracey action photo",
  ).delete();
  get("tracey-photo-fade").delete();

  // Founder cards
  const traceyCard = get("tracey-card");
  move(traceyCard, 56, 202, 568, 224);
  const jelannaCard = get("jelanna-card");
  move(jelannaCard, 640, 202, 584, 224);

  const traceyPhoto = findImage(
    (record) => record.geometry === "ellipse" && record.bbox?.[2] === 62,
    "Tracey headshot",
  );
  traceyPhoto.frame = { left: 82, top: 220, width: 74, height: 74 };
  const jelannaPhoto = findImage(
    (record) => record.geometry === "ellipse" && record.bbox?.[2] === 84,
    "Jelanna headshot",
  );
  jelannaPhoto.frame = { left: 666, top: 220, width: 74, height: 74 };

  const traceyName = get("tracey-name");
  traceyName.text = "Dr. Tracey Hathaway";
  move(traceyName, 176, 218, 390, 30);
  restyle(traceyName, { fontSize: 24, bold: true, color: C.white });

  const traceyRole = get("tracey-role");
  traceyRole.text = "CO-FOUNDER • ATHLETICS ACCESS";
  move(traceyRole, 176, 252, 380, 20);
  restyle(traceyRole, { fontSize: 12, bold: true, color: C.pink });

  const traceyJourney = get("tracey-journey");
  traceyJourney.text = "ATHLETE → COACH → ATHLETIC DIRECTOR";
  move(traceyJourney, 176, 279, 385, 24);
  restyle(traceyJourney, { fontSize: 15, bold: true, color: C.lime });

  const traceyBullets = [
    ["tracey-bullet-1-dot", "tracey-bullet-1", 318, "Former Division I women’s basketball player, University of Rhode Island"],
    ["tracey-bullet-2-dot", "tracey-bullet-2", 348, "Former women’s basketball coach and athletic director"],
    ["tracey-bullet-3-dot", "tracey-bullet-3", 378, "Doctorate in Higher Education, Worcester State University"],
  ];
  for (const [dotId, textId, top, copy] of traceyBullets) {
    const dot = get(dotId);
    move(dot, 84, top + 6, 6, 6);
    const text = get(textId);
    text.text = copy;
    move(text, 100, top, 490, 24);
    restyle(text, { fontSize: 12, bold: false, color: C.muted, verticalAlignment: "middle" });
  }
  const traceyFootnote = get("tracey-footnote");
  traceyFootnote.text = "Deep, active relationships across college athletics.";
  move(traceyFootnote, 100, 402, 490, 18);
  restyle(traceyFootnote, { fontSize: 12, bold: true, color: C.white });

  const jelannaName = get("jelanna-name");
  jelannaName.text = "Jelanna Salas Olivera";
  move(jelannaName, 760, 218, 390, 30);
  restyle(jelannaName, { fontSize: 24, bold: true, color: C.white });

  const jelannaRole = get("jelanna-role");
  jelannaRole.text = "CO-FOUNDER • ENTERPRISE EXECUTION";
  move(jelannaRole, 760, 252, 390, 20);
  restyle(jelannaRole, { fontSize: 12, bold: true, color: C.purple });

  const jelannaJourney = get("jelanna-journey");
  jelannaJourney.text = "BIG FOUR → BIG PHARMA → DIGITAL HEALTH";
  move(jelannaJourney, 760, 279, 400, 24);
  restyle(jelannaJourney, { fontSize: 15, bold: true, color: C.lime });

  const jelannaBullets = [
    ["jelanna-bullet-1-dot", "jelanna-bullet-1", 318, "Transformation consulting across EY and KPMG"],
    ["jelanna-bullet-2-dot", "jelanna-bullet-2", 348, "Big Pharma experience at Eli Lilly"],
    ["jelanna-bullet-3-dot", "jelanna-bullet-3", 378, "Former cheerleader with enterprise, product and healthcare fluency"],
  ];
  for (const [dotId, textId, top, copy] of jelannaBullets) {
    const dot = get(dotId);
    move(dot, 668, top + 6, 6, 6);
    const text = get(textId);
    text.text = copy;
    move(text, 684, top, 500, 24);
    restyle(text, { fontSize: 12, color: C.muted, verticalAlignment: "middle" });
  }

  // Full-width access story
  const leverageCard = get("leverage-card");
  move(leverageCard, 56, 442, 1168, 116);

  const leverageLabel = get("leverage-label");
  leverageLabel.text = "THE ACCESS ENGINE";
  move(leverageLabel, 78, 456, 190, 18);
  restyle(leverageLabel, { fontSize: 11, bold: true, color: C.lime });

  const organizationsStat = get("six-years-stat");
  organizationsStat.text = "2";
  move(organizationsStat, 78, 482, 55, 48);
  restyle(organizationsStat, { fontSize: 34, bold: true, color: C.white });

  const organizationsDesc = get("six-years-desc");
  organizationsDesc.text = "CO-FOUNDED\nORGANIZATIONS";
  move(organizationsDesc, 132, 486, 145, 40);
  restyle(organizationsDesc, { fontSize: 11, bold: true, color: C.pink, verticalAlignment: "middle" });

  const foundationCopy = get("foundation-copy");
  foundationCopy.text =
    "Together, they co-founded AuntEDNA.ai and the Alfreeda Goff Foundation—pairing clinical infrastructure with athlete development.";
  move(foundationCopy, 292, 476, 435, 63);
  restyle(foundationCopy, { fontSize: 15, color: C.muted, verticalAlignment: "middle" });

  const leverageDivider = get("leverage-divider");
  move(leverageDivider, 755, 462, 0, 76);

  const pipelineLabel = get("pipeline-label");
  pipelineLabel.text = "6 YEARS OF NCAA-BACKED WORK";
  move(pipelineLabel, 785, 456, 350, 20);
  restyle(pipelineLabel, { fontSize: 12, bold: true, color: C.blue });

  const pipelineSchools = get("pipeline-schools");
  pipelineSchools.text = "Athletic departments  •  coaches  •  student-athletes";
  move(pipelineSchools, 785, 483, 395, 25);
  restyle(pipelineSchools, { fontSize: 14, bold: true, color: C.white });

  const pipelineCopy = get("pipeline-copy");
  pipelineCopy.text =
    "Trusted relationships create direct access and a qualified pilot pipeline for PulseCheck.";
  move(pipelineCopy, 785, 514, 395, 30);
  restyle(pipelineCopy, { fontSize: 13, color: C.muted });

  // Preserve and slightly tighten the proof strip.
  move(get("proof-strip"), 56, 574, 1168, 105);
  move(get("proof-strip-label"), 78, 588, 290, 18);
  move(get("phase1-value"), 78, 617, 110, 33);
  move(get("phase1-copy"), 174, 614, 160, 40);
  move(get("proof-rule-1"), 358, 592, 0, 68);
  move(get("adherence-value"), 388, 617, 100, 33);
  move(get("adherence-copy"), 480, 614, 200, 40);
  move(get("proof-rule-2"), 704, 592, 0, 68);
  move(get("phase2-value"), 734, 617, 110, 33);
  move(get("phase2-copy"), 833, 610, 245, 23);
  move(get("phase2-detail"), 833, 637, 350, 25);

  slide.speakerNotes.text =
    "Tracey and Jelanna bring two connected assets to PulseCheck: AuntEDNA.ai’s clinical and research infrastructure, and the Alfreeda Goff Foundation’s trusted access across college athletics. Their six years of NCAA-backed programming have built relationships with athletic departments, coaches, administrators, and student-athletes. That access strengthens implementation and feeds qualified pilot opportunities into PulseCheck’s go-to-market motion.\n\nThe NSF Phase II amount is a proposal target, not an awarded grant.\n\n[Sources]\n- Existing slide and user-provided direction, 2026-07-28.\n- https://www.uri.edu/magazine/issues/spring-2023/ensuring-student-athlete-success-on-and-beyond-the-field/\n- https://www.ncaa.org/news/2022/11/22/media-center-arise-program-opening-new-doors-ideas-for-hbcu-student-athletes.aspx\n- https://auntedna.ai/about-us-2/\n- User-provided information: six-year NCAA relationship; 80% adherence; PulseCheck inclusion in Phase II preparation.\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/dr-tracey.png\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/jelanna.jpg\n[/Sources]";

  const preview = await presentation.export({ slide, format: "png", scale: 2 });
  await writeBlob(`${TMP_DIR}/slide-1.png`, preview);
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${TMP_DIR}/slide-1.layout.json`, await layout.text());
  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(`${TMP_DIR}/deck-montage.webp`, montage);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL_PPTX);
  console.log(FINAL_PPTX);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
