import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/team-will-slide";
const FINAL_PPTX = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs/PIL_Core_Team_with_Will_Watkins_Slide.pptx";

const ASSETS = {
  background: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/investor/july-2026/hero-basketball-huddle.png",
  tremaine: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/tre.jpg",
  bobby: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/bobbyAdvisor.jpg",
  lola: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/lola.jpg",
  will: "/Users/tremainegrant/Downloads/1668718172755.jpeg",
  marques: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/zak.jpg",
  valerie: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/Val.jpg",
  erik: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/ErikEdwards.png",
};

const C = {
  bg: "#050708",
  surface: "#121619",
  surface2: "#151A1D",
  white: "#F5F5F2",
  muted: "#ADB1BA",
  dim: "#858B95",
  rule: "#343A40",
  lime: "#C8FF00",
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

async function addTeamCard(slide, member, index, x, y, w, h) {
  addShape(slide, "roundRect", `member-${index}-card`, x, y, w, h, "#121619/96", C.rule, 1, "rounded-xl");

  const portraitSize = 74;
  const portraitX = x + (w - portraitSize) / 2;
  await addImage(
    slide,
    `member-${index}-portrait`,
    member.image,
    { left: portraitX, top: y + 18, width: portraitSize, height: portraitSize },
    {
      alt: `${member.name} portrait`,
      geometry: "ellipse",
      fit: "cover",
      line: { style: "solid", fill: C.rule, width: 1.3 },
    },
  );

  addText(slide, `member-${index}-name`, member.name, x + 20, y + 104, w - 40, 28, {
    fontSize: 22,
    bold: true,
    color: C.white,
    alignment: "center",
  });
  addText(slide, `member-${index}-role`, member.role, x + 20, y + 139, w - 40, 22, {
    fontSize: 13,
    bold: true,
    color: member.color,
    alignment: "center",
  });
  addShape(slide, "line", `member-${index}-rule`, x + 28, y + 172, w - 56, 0, "none", C.rule, 1);
  addText(slide, `member-${index}-bio`, member.bio, x + 24, y + 186, w - 48, h - 199, {
    fontSize: 14.5,
    color: C.muted,
    alignment: "center",
    verticalAlignment: "middle",
  });
}

async function addAdvisor(slide, advisor, index, centerX, y) {
  const portraitSize = 48;
  await addImage(
    slide,
    `advisor-${index}-portrait`,
    advisor.image,
    { left: centerX - portraitSize / 2, top: y, width: portraitSize, height: portraitSize },
    {
      alt: `${advisor.name} portrait`,
      geometry: "ellipse",
      fit: "cover",
      line: { style: "solid", fill: C.rule, width: 1 },
    },
  );
  addText(slide, `advisor-${index}-name`, advisor.name, centerX - 120, y + 55, 240, 19, {
    fontSize: 13,
    bold: true,
    color: C.white,
    alignment: "center",
  });
  addText(slide, `advisor-${index}-role`, advisor.role, centerX - 130, y + 74, 260, 20, {
    fontSize: 11.5,
    color: C.muted,
    alignment: "center",
  });
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir("/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs", { recursive: true });

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
  addShape(slide, "rect", "background-darkener", 0, 0, 1280, 720, "#030407/74");
  addShape(slide, "rect", "bottom-depth", 0, 238, 1280, 482, {
    type: "gradient",
    gradientKind: "linear",
    angleDeg: 90,
    stops: [
      { offset: 0, color: "#050708", transparency: 48000 },
      { offset: 100000, color: "#050708", transparency: 6000 },
    ],
  });

  // Section label.
  addShape(slide, "roundRect", "section-pill", 62, 38, 210, 40, "#121619/96", C.rule, 1, "rounded-full");
  addShape(slide, "ellipse", "section-dot", 80, 53, 8, 8, C.lime);
  addText(slide, "section-label", "CORE TEAM", 102, 47, 140, 22, {
    fontSize: 15,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });

  // Headline.
  addText(slide, "headline-white", "Operators who know", 62, 108, 420, 44, {
    fontSize: 37,
    bold: true,
    color: C.white,
  });
  addText(slide, "headline-lime-one", "software, athletes,", 447, 108, 660, 44, {
    fontSize: 37,
    bold: true,
    color: C.lime,
  });
  addText(slide, "headline-lime-two", "clinical trust, and enterprise sales.", 62, 153, 1080, 46, {
    fontSize: 37,
    bold: true,
    color: C.lime,
  });

  const members = [
    {
      name: "Tremaine Grant",
      role: "FOUNDER & CEO",
      bio: "Full-stack engineer and AI builder with a decade in clinical research. Former D1 athlete at FSU.",
      color: C.lime,
      image: ASSETS.tremaine,
    },
    {
      name: "Bobby Nweke",
      role: "CHIEF OF STAFF",
      bio: "10 years in human performance across training, athletics, and education.",
      color: C.blue,
      image: ASSETS.bobby,
    },
    {
      name: "Lola Oluwaladun",
      role: "HEAD OF DESIGN",
      bio: "Owns product experience and athlete-facing UX across Pulse.",
      color: C.violet,
      image: ASSETS.lola,
    },
    {
      name: "Will Watkins",
      role: "HEAD OF SALES",
      bio: "Salesforce Global Director of Sales. Former professional player in the Boston Red Sox organization.",
      color: C.orange,
      image: ASSETS.will,
    },
  ];

  const cardY = 238;
  const cardW = 274;
  const cardH = 284;
  const cardGap = 20;
  const cardStartX = 62;
  for (let i = 0; i < members.length; i += 1) {
    await addTeamCard(slide, members[i], i + 1, cardStartX + i * (cardW + cardGap), cardY, cardW, cardH);
  }

  // Advisor strip.
  addShape(slide, "roundRect", "advisor-strip", 62, 544, 1156, 133, "#121619/96", C.rule, 1, "rounded-xl");
  addText(slide, "advisor-heading", "ADVISORS", 530, 558, 220, 21, {
    fontSize: 14,
    bold: true,
    color: C.lime,
    alignment: "center",
  });

  const advisors = [
    { name: "Marques Zak", role: "CMO, ACC", image: ASSETS.marques },
    { name: "Valerie Alexander", role: "Entrepreneur in Residence • Former IPO Attorney", image: ASSETS.valerie },
    { name: "Erik Edwards", role: "Partner, Cooley", image: ASSETS.erik },
  ];
  await addAdvisor(slide, advisors[0], 1, 285, 581);
  await addAdvisor(slide, advisors[1], 2, 640, 581);
  await addAdvisor(slide, advisors[2], 3, 995, 581);

  slide.speakerNotes.textFrame.setText(
    "Will Watkins joins Pulse as Head of Sales. Public sources identify Watkins as Global Director of Sales at Salesforce. The baseball background and Boston Red Sox organization experience are based on company-provided biographical information.\n\n[Sources]\n- User-provided portrait: /Users/tremainegrant/Downloads/1668718172755.jpeg\n- User-provided biographical information for Will Watkins.\n- https://www.linkedin.com/in/will-watkins-78238127\n- https://myemail.constantcontact.com/CAU-Alumni-Newsletter-Issue-7-April-2025.html?aid=2YpslLU8Fck&soid=1139227680712\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/investor/july-2026/hero-basketball-huddle.png\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/tre.jpg\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/bobbyAdvisor.jpg\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/lola.jpg\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/zak.jpg\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/Val.jpg\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/ErikEdwards.png\n[/Sources]",
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
