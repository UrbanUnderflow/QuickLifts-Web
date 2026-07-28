import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/auntedna-pipeline-slide";
const OUTPUT_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs";
const FINAL_PPTX = `${OUTPUT_DIR}/PIL_AuntEDNA_NCAA_Pipeline_Slide.pptx`;

const ASSETS = {
  background: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/investor/july-2026/hero-basketball-huddle.png",
  traceyAction: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/dr-tracey-basketball.jpeg",
  traceyPortrait: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/dr-tracey.png",
  jelanna: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/jelanna.jpg",
  mark: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/auntedna-mark.png",
};

const C = {
  bg: "#050708",
  surface: "#111518",
  surface2: "#171B1F",
  white: "#F5F5F2",
  muted: "#AEB3BD",
  dim: "#858B96",
  rule: "#343A40",
  lime: "#C8FF00",
  pink: "#F65AAF",
  blue: "#4D8FFF",
  violet: "#9B72FF",
  orange: "#FF9C38",
};

function addShape(slide, geometry, name, x, y, w, h, fill = "none", lineFill = "none", lineWidth = 0, radius) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addText(slide, name, text, x, y, w, h, opts = {}) {
  const shape = addShape(slide, "textbox", name, x, y, w, h);
  shape.text = text;
  shape.text.style = {
    typeface: "Arial",
    fontSize: opts.fontSize ?? 20,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: opts.color ?? C.white,
    alignment: opts.alignment ?? "left",
    verticalAlignment: opts.verticalAlignment ?? "top",
    autoFit: opts.autoFit ?? "shrinkText",
    wrap: opts.wrap ?? "square",
    insets: opts.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

async function readImage(imagePath) {
  const bytes = await fs.readFile(imagePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function contentTypeFor(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function addImage(slide, name, imagePath, position, opts = {}) {
  return slide.images.add({
    blob: await readImage(imagePath),
    contentType: contentTypeFor(imagePath),
    alt: opts.alt ?? name,
    fit: opts.fit ?? "cover",
    position,
    geometry: opts.geometry ?? "rect",
    ...(opts.borderRadius ? { borderRadius: opts.borderRadius } : {}),
    ...(opts.line ? { line: opts.line } : {}),
  });
}

function addBulletLine(slide, name, text, x, y, w, color = C.muted, dotColor = C.lime, fontSize = 14) {
  addShape(slide, "ellipse", `${name}-dot`, x, y + 7, 6, 6, dotColor);
  addText(slide, name, text, x + 15, y, w - 15, 24, { fontSize, color });
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;

  await addImage(
    slide,
    "basketball-huddle-background",
    ASSETS.background,
    { left: 0, top: 0, width: 1280, height: 720 },
    { alt: "Basketball team huddling in an arena", fit: "cover" },
  );
  addShape(slide, "rect", "background-darkener", 0, 0, 1280, 720, "#030407/83");
  addShape(slide, "rect", "content-depth", 0, 190, 1280, 530, {
    type: "gradient",
    gradientKind: "linear",
    angleDeg: 90,
    stops: [
      { offset: 0, color: "#050708", transparency: 38000 },
      { offset: 100000, color: "#050708", transparency: 2000 },
    ],
  });

  // Section label.
  addShape(slide, "roundRect", "section-pill", 56, 30, 270, 40, "#121619/96", C.rule, 1, "rounded-full");
  addShape(slide, "ellipse", "section-dot", 76, 45, 8, 8, C.lime);
  addText(slide, "section-label", "CLINICAL + GTM PATHWAY", 98, 39, 205, 22, {
    fontSize: 13,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });

  // Headline and positioning statement.
  addText(slide, "headline-white", "AuntEDNA.ai brings clinical care + an", 56, 89, 760, 48, {
    fontSize: 32,
    bold: true,
    color: C.white,
  });
  addText(slide, "headline-accent", "active NCAA pipeline.", 675, 89, 550, 48, {
    fontSize: 32,
    bold: true,
    color: C.pink,
  });
  addText(
    slide,
    "subtitle",
    "PulseCheck owns detection, scoring and routing. AuntEDNA adds clinical escalation, research validation and institutional access.",
    56,
    145,
    1150,
    34,
    { fontSize: 19, color: C.muted },
  );

  // Left profile: Tracey leads visually.
  addShape(slide, "roundRect", "tracey-card", 56, 205, 420, 352, "#111518/96", C.rule, 1, "rounded-xl");
  await addImage(
    slide,
    "tracey-action-photo",
    ASSETS.traceyAction,
    { left: 57, top: 206, width: 148, height: 350 },
    { alt: "Dr. Tracey Hathaway playing Division I basketball at the University of Rhode Island", fit: "cover", borderRadius: "rounded-xl" },
  );
  addShape(slide, "rect", "tracey-photo-fade", 135, 206, 70, 350, {
    type: "gradient",
    gradientKind: "linear",
    angleDeg: 0,
    stops: [
      { offset: 0, color: C.surface, transparency: 100000 },
      { offset: 100000, color: C.surface, transparency: 0 },
    ],
  });
  await addImage(
    slide,
    "tracey-current-portrait",
    ASSETS.traceyPortrait,
    { left: 184, top: 224, width: 62, height: 62 },
    {
      alt: "Dr. Tracey Hathaway",
      geometry: "ellipse",
      fit: "cover",
      line: { style: "solid", fill: C.pink, width: 1.4 },
    },
  );
  addText(slide, "tracey-name", "Dr. Tracey Hathaway", 260, 226, 190, 25, {
    fontSize: 19,
    bold: true,
    color: C.white,
  });
  addText(slide, "tracey-role", "CO-FOUNDER • ATHLETICS ACCESS", 260, 257, 190, 20, {
    fontSize: 10.5,
    bold: true,
    color: C.pink,
  });
  addText(slide, "tracey-journey", "ATHLETE → COACH → ATHLETIC DIRECTOR", 184, 307, 270, 25, {
    fontSize: 15,
    bold: true,
    color: C.lime,
  });
  addBulletLine(slide, "tracey-bullet-1", "Former D1 women’s basketball player, University of Rhode Island", 184, 344, 266, C.muted, C.pink, 13.5);
  addBulletLine(slide, "tracey-bullet-2", "Two decades across coaching and collegiate athletics administration", 184, 391, 266, C.muted, C.pink, 13.5);
  addBulletLine(slide, "tracey-bullet-3", "Former women’s basketball coach, athletic director and NCAA committee contributor", 184, 438, 266, C.muted, C.pink, 13.5);
  addText(slide, "tracey-footnote", "Deep, active relationships across college athletics.", 184, 505, 260, 28, {
    fontSize: 13.5,
    bold: true,
    color: C.white,
  });

  // Center profile: Jelanna.
  addShape(slide, "roundRect", "jelanna-card", 492, 205, 286, 352, "#111518/96", C.rule, 1, "rounded-xl");
  await addImage(
    slide,
    "jelanna-portrait",
    ASSETS.jelanna,
    { left: 515, top: 226, width: 84, height: 84 },
    {
      alt: "Jelanna Salas Olivera",
      geometry: "ellipse",
      fit: "cover",
      line: { style: "solid", fill: C.violet, width: 1.4 },
    },
  );
  addText(slide, "jelanna-name", "Jelanna Salas Olivera", 515, 324, 238, 28, {
    fontSize: 19,
    bold: true,
    color: C.white,
  });
  addText(slide, "jelanna-role", "CO-FOUNDER • ENTERPRISE EXECUTION", 515, 358, 240, 20, {
    fontSize: 10.5,
    bold: true,
    color: C.violet,
  });
  addText(slide, "jelanna-journey", "BIG FOUR → BIG PHARMA → DIGITAL HEALTH", 515, 394, 240, 36, {
    fontSize: 14.5,
    bold: true,
    color: C.lime,
  });
  addBulletLine(slide, "jelanna-bullet-1", "Transformation consulting across EY and KPMG", 515, 443, 236, C.muted, C.violet, 13.5);
  addBulletLine(slide, "jelanna-bullet-2", "Big Pharma experience at Eli Lilly", 515, 479, 236, C.muted, C.violet, 13.5);
  addBulletLine(slide, "jelanna-bullet-3", "Former cheerleader with enterprise, product and healthcare fluency", 515, 515, 236, C.muted, C.violet, 13.5);

  // Right: institutional leverage and GTM.
  addShape(slide, "roundRect", "leverage-card", 794, 205, 430, 352, "#111518/96", C.rule, 1, "rounded-xl");
  addText(slide, "leverage-label", "THE SHARED ADVANTAGE", 820, 226, 250, 20, {
    fontSize: 12,
    bold: true,
    color: C.lime,
  });
  addText(slide, "six-years-stat", "6 YEARS", 818, 258, 180, 58, {
    fontSize: 36,
    bold: true,
    color: C.white,
  });
  addText(slide, "six-years-desc", "building with the NCAA", 1010, 276, 180, 28, {
    fontSize: 15,
    bold: true,
    color: C.pink,
  });
  addText(
    slide,
    "foundation-copy",
    "Together they co-founded athLEDA, now the Alfreeda Goff Foundation—developing athletes for life after sport through NCAA-backed programming.",
    820,
    326,
    374,
    67,
    { fontSize: 16, color: C.muted },
  );
  addShape(slide, "line", "leverage-divider", 820, 406, 374, 0, "none", C.rule, 1);
  addText(slide, "pipeline-label", "ACTIVE RELATIONSHIPS → PILOT PIPELINE", 820, 424, 360, 22, {
    fontSize: 13,
    bold: true,
    color: C.blue,
  });
  addText(slide, "pipeline-schools", "Hampton  •  UMES  •  Claflin  •  Clark Atlanta", 820, 456, 370, 30, {
    fontSize: 16.5,
    bold: true,
    color: C.white,
  });
  addText(
    slide,
    "pipeline-copy",
    "Their nonprofit trust, athletics network and campus access feed directly into PulseCheck’s GTM motion.",
    820,
    496,
    370,
    42,
    { fontSize: 14, color: C.muted },
  );

  // Evidence and funding strip.
  addShape(slide, "roundRect", "proof-strip", 56, 575, 1168, 104, "#111518/98", C.rule, 1, "rounded-xl");
  addText(slide, "proof-strip-label", "RESEARCH + COMMERCIALIZATION LEVERAGE", 78, 590, 270, 18, {
    fontSize: 10.5,
    bold: true,
    color: C.lime,
  });
  addText(slide, "phase1-value", "$275K", 78, 617, 110, 33, {
    fontSize: 25,
    bold: true,
    color: C.blue,
  });
  addText(slide, "phase1-copy", "NSF Phase I\nfunded research", 174, 615, 160, 40, {
    fontSize: 13.5,
    bold: true,
    color: C.white,
  });
  addShape(slide, "line", "proof-rule-1", 358, 593, 0, 67, "none", C.rule, 1);
  addText(slide, "adherence-value", "80%", 388, 617, 100, 33, {
    fontSize: 25,
    bold: true,
    color: C.lime,
  });
  addText(slide, "adherence-copy", "adherence evidence\nacross 1,000+ athletes", 480, 615, 200, 40, {
    fontSize: 13.5,
    bold: true,
    color: C.white,
  });
  addShape(slide, "line", "proof-rule-2", 704, 593, 0, 67, "none", C.rule, 1);
  addText(slide, "phase2-value", "$1.4M", 734, 617, 110, 33, {
    fontSize: 25,
    bold: true,
    color: C.pink,
  });
  addText(slide, "phase2-copy", "Phase II proposal preparation", 833, 610, 245, 23, {
    fontSize: 14,
    bold: true,
    color: C.white,
  });
  addText(slide, "phase2-detail", "PulseCheck included for commercialization, pilot subsidy + integrations", 833, 637, 350, 25, {
    fontSize: 12.5,
    color: C.muted,
  });

  slide.speakerNotes.textFrame.setText(
    "AuntEDNA.ai contributes three forms of leverage to PulseCheck: clinical escalation infrastructure, evidence-building capacity, and an established institutional channel into college athletics. Tracey should lead the verbal story: she brings lived athlete experience plus two decades of coaching and athletics administration. Jelanna complements that with Big Four transformation and Big Pharma execution. Together, their Alfreeda Goff Foundation relationship with the NCAA creates direct access and a credible pilot pipeline.\n\nPublic sources describe the Alfreeda Goff Foundation as formerly athLEDA and state that the NCAA partnership began in 2020. The six-year label reflects the current 2026 deck date. Public AuntEDNA materials describe the NSF Phase I award as $275K. The 80% adherence figure and PulseCheck's planned inclusion in a $1.4M Phase II proposal are company-provided figures and should be presented as evidence/preparation, not as an awarded Phase II grant.\n\n[Sources]\n- https://www.uri.edu/magazine/issues/spring-2023/ensuring-student-athlete-success-on-and-beyond-the-field/\n- https://www.ncaa.org/news/2022/11/22/media-center-arise-program-opening-new-doors-ideas-for-hbcu-student-athletes.aspx\n- https://rwuhawks.com/sports/womens-basketball/roster/coaches/tracey-hathaway/36\n- https://auntedna.ai/about-us-2/\n- https://hamptonpirates.com/news/2025/9/11/general-hampton-university-athletics-joins-with-athleda-org-for-student-athlete-programming.aspx\n- https://www.linkedin.com/in/jelanna-salas-olivera-she-ella-316a0521\n- https://www.linkedin.com/posts/auntedna-ai_mentalhealthtech-responsibleai-collegeathletes-activity-7336391390999781377-RZ0e\n- User-provided information: 80% adherence result; Jelanna's former cheerleading background; PulseCheck's planned Phase II participation and $1.4M proposal target.\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/investor/july-2026/hero-basketball-huddle.png\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/dr-tracey-basketball.jpeg\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/dr-tracey.png\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/jelanna.jpg\n[/Sources]",
  );

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
