import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/ncaa-mandate-slide";
const FINAL_PPTX = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs/PIL_NCAA_Mandate_Urgency_Slide.pptx";

const C = {
  bg: "#070A0B",
  surface: "#101416",
  surface2: "#14191C",
  white: "#F5F5F2",
  muted: "#A7AAB2",
  dim: "#707680",
  rule: "#30363B",
  lime: "#C8FF00",
  blue: "#4D8FFF",
  violet: "#9B72FF",
  pink: "#F35D9D",
  orange: "#FF9C38",
};

function addRect(slide, name, x, y, w, h, fill, lineFill = "none", lineWidth = 0, radius = "none") {
  return slide.shapes.add({
    geometry: radius === "none" ? "rect" : "roundRect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
    ...(radius === "none" ? {} : { borderRadius: radius }),
  });
}

function addText(slide, name, text, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: "Arial",
    fontSize: opts.fontSize ?? 20,
    bold: opts.bold ?? false,
    color: opts.color ?? C.white,
    alignment: opts.alignment ?? "left",
    verticalAlignment: opts.verticalAlignment ?? "top",
    autoFit: opts.autoFit ?? "shrinkText",
    wrap: opts.wrap ?? "square",
    lineSpacing: opts.lineSpacing,
    insets: opts.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addPractice(slide, index, label, color, x, y, w) {
  addRect(slide, `practice-accent-${index}`, x, y + 4, 6, 47, color, "none", 0, "rounded-sm");
  addText(slide, `practice-number-${index}`, `0${index}`, x + 20, y, 42, 24, {
    fontSize: 16,
    bold: true,
    color,
  });
  addText(slide, `practice-label-${index}`, label, x + 20, y + 23, w - 20, 30, {
    fontSize: 19,
    bold: true,
    color: C.white,
  });
}

function addLeader(slide, index, role, x, y, w) {
  addRect(slide, `leader-${index}-surface`, x, y, w, 52, C.surface2, C.rule, 1, "rounded-lg");
  addText(slide, `leader-${index}-number`, `0${index}`, x + 16, y + 9, 30, 30, {
    fontSize: 15,
    bold: true,
    color: C.lime,
    verticalAlignment: "middle",
  });
  addText(slide, `leader-${index}-role`, role, x + 46, y + 8, w - 58, 34, {
    fontSize: 16,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir("/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs", { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: 1280, height: 720 },
  });
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;

  // Subtle right-side depth without competing with the typography.
  addRect(slide, "right-depth-panel", 778, 0, 502, 720, {
    type: "gradient",
    gradientKind: "linear",
    angleDeg: 0,
    stops: [
      { offset: 0, color: "#070A0B", transparency: 100000 },
      { offset: 100000, color: "#11171A", transparency: 16000 },
    ],
  });

  // Eyebrow.
  addRect(slide, "eyebrow-pill", 70, 38, 306, 42, C.surface, C.rule, 1, "rounded-full");
  addRect(slide, "eyebrow-dot", 91, 54, 9, 9, C.lime, "none", 0, "rounded-full");
  addText(slide, "eyebrow", "WHY SCHOOLS MUST ACT", 112, 48, 238, 23, {
    fontSize: 15,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });
  addText(slide, "bylaw", "NCAA BYLAW 20.2.4.25", 1008, 51, 202, 18, {
    fontSize: 12,
    bold: true,
    color: C.dim,
    alignment: "right",
  });

  // Headline hierarchy.
  addText(slide, "headline-primary", "THE MANDATE IS ACTIVE.", 70, 101, 1140, 66, {
    fontSize: 60,
    bold: true,
    color: C.white,
  });
  addText(slide, "headline-secondary", "COMPLIANCE MUST BE CONFIRMED—EVERY YEAR.", 70, 166, 1140, 50, {
    fontSize: 41,
    bold: true,
    color: C.lime,
  });
  addText(
    slide,
    "scope-explanation",
    "Division I schools—and any school sponsoring a Division I sport—must formally confirm that NCAA-aligned health, safety and mental-health support is in place.",
    70,
    223,
    1115,
    45,
    {
      fontSize: 19,
      color: C.muted,
    },
  );
  addRect(slide, "main-divider", 70, 285, 1140, 1, C.rule);

  // Deadline anchor.
  addRect(slide, "deadline-accent", 70, 315, 7, 286, C.lime, "none", 0, "rounded-sm");
  addText(slide, "deadline-label", "NEXT ANNUAL NCAA DEADLINE", 99, 315, 350, 25, {
    fontSize: 15,
    bold: true,
    color: C.muted,
  });
  addText(slide, "deadline-month-day", "NOV. 6", 91, 345, 360, 105, {
    fontSize: 92,
    bold: true,
    color: C.lime,
  });
  addText(slide, "deadline-year", "2026", 98, 444, 350, 72, {
    fontSize: 58,
    bold: true,
    color: C.white,
  });
  addText(
    slide,
    "deadline-note",
    "Schools are not simply encouraged to act. Their leadership must formally confirm compliance with the NCAA’s health, safety and mental-health guidance.",
    99,
    526,
    336,
    79,
    {
      fontSize: 17,
      color: C.muted,
    },
  );

  // What must be in place.
  addText(slide, "requirements-heading", "WHAT SCHOOLS MUST HAVE IN PLACE", 493, 315, 690, 26, {
    fontSize: 17,
    bold: true,
    color: C.white,
  });
  addPractice(slide, 1, "HEALTHY ENVIRONMENTS", C.blue, 493, 356, 320);
  addPractice(slide, 2, "MENTAL-HEALTH SCREENING", C.violet, 846, 356, 337);
  addPractice(slide, 3, "WRITTEN RESPONSE PLANS", C.pink, 493, 426, 320);
  addPractice(slide, 4, "ACCESS TO LICENSED PROVIDERS", C.orange, 846, 426, 337);

  addRect(slide, "right-divider", 493, 496, 690, 1, C.rule);
  addText(slide, "accountability-heading", "THE SCHOOL LEADERS WHO MUST CONFIRM IT", 493, 513, 690, 24, {
    fontSize: 17,
    bold: true,
    color: C.white,
  });
  addText(slide, "accountability-explanation", "The NCAA form must be signed by:", 493, 541, 690, 22, {
    fontSize: 15,
    color: C.muted,
  });
  addLeader(slide, 1, "SCHOOL PRESIDENT\nOR CHANCELLOR", 493, 570, 216);
  addLeader(slide, 2, "ATHLETIC\nDIRECTOR", 721, 570, 216);
  addLeader(slide, 3, "ATHLETICS HEALTH\nCARE ADMINISTRATOR", 949, 570, 234);

  // Bottom synthesis band.
  addRect(slide, "pulsecheck-band", 70, 646, 1140, 48, "#151C0F", "#435600", 1, "rounded-lg");
  addText(
    slide,
    "pulsecheck-value",
    "PULSECHECK HELPS ATHLETIC DEPARTMENTS IMPLEMENT, MEASURE AND DOCUMENT THE SYSTEM BEHIND COMPLIANCE.",
    92,
    657,
    1096,
    26,
    {
      fontSize: 16,
      bold: true,
      color: C.lime,
      alignment: "center",
      verticalAlignment: "middle",
    },
  );

  slide.speakerNotes.textFrame.setText(
    "The urgency is institutional, not hypothetical: the NCAA’s mental-health best practices are legislatively required across member schools. Division I schools—and Division II/III institutions sponsoring a Division I sport—must annually attest to compliance with consensus-based health, safety and performance guidance. The next listed deadline is Nov. 6, 2026. The responsible signers are the school president or chancellor, athletic director, and campus athletics health care administrator.\n\n[Sources]\n- https://www.ncaa.org/governance/legislation-policy/membership-attestation-requirements/\n- https://www.ncaa.org/what-we-do/health-safety-and-performance/mental-health/best-practices/\n[/Sources]",
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
