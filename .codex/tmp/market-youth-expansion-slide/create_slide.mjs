import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/market-youth-expansion-slide";
const OUTPUT_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs";
const FINAL_PPTX = `${OUTPUT_DIR}/PIL_NCAA_Market_with_Youth_Expansion_Slide.pptx`;

const C = {
  bg: "#080A0C",
  surface: "#151719",
  surface2: "#121416",
  white: "#F5F5F2",
  muted: "#ADB2BC",
  dim: "#858B96",
  rule: "#343A40",
  lime: "#C8FF00",
  blue: "#4D8FFF",
  violet: "#9B72FF",
  orange: "#FF9C38",
  pink: "#F65AAF",
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

function addExpansionCard(slide, card, index, x, y, w, h) {
  addShape(slide, "roundRect", `expansion-${index}-card`, x, y, w, h, "#151719/98", "#252A2F", 1, "rounded-xl");
  addShape(slide, "roundRect", `expansion-${index}-number-bg`, x + 20, y + 25, 52, 52, `${card.color}/13`, `${card.color}/35`, 1, "rounded-xl");
  addText(slide, `expansion-${index}-number`, String(index).padStart(2, "0"), x + 20, y + 37, 52, 26, {
    fontSize: 15,
    bold: true,
    color: card.color,
    alignment: "center",
    verticalAlignment: "middle",
  });
  addText(slide, `expansion-${index}-title`, card.title, x + 88, y + 24, w - 108, 26, {
    fontSize: 18,
    bold: true,
    color: C.white,
  });
  addText(slide, `expansion-${index}-detail`, card.detail, x + 88, y + 60, w - 108, 50, {
    fontSize: 14,
    color: C.muted,
    verticalAlignment: "middle",
  });
  addShape(slide, "roundRect", `expansion-${index}-accent`, x + 20, y + h - 9, w - 40, 4, card.color, card.color, 0, "rounded-full");
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

  addShape(slide, "roundRect", "section-pill", 50, 40, 185, 39, "#121416/98", "#252A2F", 1, "rounded-full");
  addShape(slide, "ellipse", "section-dot", 68, 55, 8, 8, C.lime);
  addText(slide, "section-label", "THE MARKET", 88, 49, 125, 21, {
    fontSize: 13,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });

  addText(slide, "headline-white", "There are over", 50, 145, 345, 52, {
    fontSize: 39,
    bold: true,
    color: C.white,
  });
  addText(slide, "headline-lime", "1,100 NCAA programs in the U.S.", 393, 145, 810, 52, {
    fontSize: 39,
    bold: true,
    color: C.lime,
  });

  addShape(slide, "roundRect", "primary-card", 50, 260, 1180, 184, "#151719/98", C.lime, 1.3, "rounded-xl");
  addText(slide, "primary-label", "PRIMARY FOCUS  ·  NCAA INSTITUTIONS", 88, 290, 460, 22, {
    fontSize: 14,
    bold: true,
    color: C.lime,
  });

  const statX = [88, 490, 890];
  const stats = [
    { value: "1,100+", label: "NCAA member schools", color: C.blue },
    { value: "500", label: "student-athletes per department", color: C.violet },
    { value: "500K+", label: "athletes covered by the mandate", color: C.lime },
  ];
  stats.forEach((stat, index) => {
    addText(slide, `stat-${index + 1}-value`, stat.value, statX[index], 326, 260, 54, {
      fontSize: 38,
      bold: true,
      color: stat.color,
    });
    addText(slide, `stat-${index + 1}-label`, stat.label, statX[index], 392, 280, 25, {
      fontSize: 16,
      color: C.white,
    });
  });
  addShape(slide, "line", "stat-rule-1", 430, 318, 0, 95, "none", "#2D3338", 1);
  addShape(slide, "line", "stat-rule-2", 830, 318, 0, 95, "none", "#2D3338", 1);

  addText(slide, "later-label", "LATER EXPANSION", 50, 476, 300, 24, {
    fontSize: 14,
    bold: true,
    color: C.dim,
  });

  const expansionCards = [
    {
      title: "Youth athletics",
      detail: "Club, school + governing-body channels",
      color: C.violet,
    },
    {
      title: "Campus-wide licenses",
      detail: "~$400K per institution",
      color: C.blue,
    },
    {
      title: "Clinics & sports medicine",
      detail: "Access + referral network layer",
      color: C.pink,
    },
    {
      title: "Pro teams & federations",
      detail: "Horizon after NCAA proof",
      color: C.orange,
    },
  ];
  const cardW = 281;
  const cardGap = 18;
  expansionCards.forEach((card, index) => {
    addExpansionCard(slide, card, index + 1, 50 + index * (cardW + cardGap), 516, cardW, 128);
  });

  slide.speakerNotes.textFrame.setText(
    "The NCAA remains the primary institutional beachhead. Youth athletics is the first adjacent expansion because the same mental-performance product, governing-body relationships, and event-based acquisition channels can extend into club, school, and national youth-sport ecosystems. Campus-wide licensing, clinics and sports medicine, and professional teams/federations remain additional later-stage channels.\n\n[Sources]\n- User-provided slide screenshot and market assumptions.\n- /var/folders/bc/fcdjljdj1fd0xsly6ssdw8wc0000gn/T/TemporaryItems/NSIRD_screencaptureui_fdRWdG/Screenshot 2026-07-28 at 10.54.37 AM.png\n[/Sources]",
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
