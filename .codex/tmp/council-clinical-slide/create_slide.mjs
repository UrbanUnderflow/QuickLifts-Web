import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/council-clinical-slide";
const OUTPUT_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs";
const FINAL_PPTX = `${OUTPUT_DIR}/PIL_Council_Operators_with_Clinical_Leaders_Slide.pptx`;

const ASSETS = {
  jill: `${TMP_DIR}/assets/jill-geer.png`,
  amber: `${TMP_DIR}/assets/amber-camp.png`,
  talia: `${TMP_DIR}/assets/talia-mark.png`,
  tram: `${TMP_DIR}/assets/tram-holloway.png`,
  jeremy: `${TMP_DIR}/assets/jeremy-burnham.jpg`,
  malkia: "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/malkia-advisor.png",
};

const C = {
  bg: "#080A0C",
  surface: "#111519",
  white: "#F4F4F1",
  muted: "#ADB2BC",
  dim: "#858C96",
  rule: "#343A40",
  cyan: "#58D9EC",
  lime: "#C8FF00",
  violet: "#9B72FF",
  orange: "#FF9C38",
  blue: "#4D8FFF",
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

async function addOperatorCard(slide, member, index, x, y, w, h) {
  addShape(slide, "roundRect", `operator-${index}-card`, x, y, w, h, "#111519/98", C.rule, 1, "rounded-xl");

  await addImage(
    slide,
    `operator-${index}-portrait`,
    member.image,
    { left: x + 20, top: y + 25, width: 74, height: 74 },
    {
      alt: `${member.name} portrait`,
      geometry: "ellipse",
      fit: "cover",
      line: { style: "solid", fill: member.accent, width: 1.25 },
    },
  );

  addText(slide, `operator-${index}-name`, member.name, x + 112, y + 20, w - 132, 28, {
    fontSize: 19,
    bold: true,
    color: C.white,
  });
  addText(slide, `operator-${index}-lane`, member.lane, x + 112, y + 52, w - 132, 18, {
    fontSize: 10.5,
    bold: true,
    color: member.accent,
  });
  addText(slide, `operator-${index}-bio`, member.bio, x + 112, y + 80, w - 132, h - 94, {
    fontSize: 16,
    color: C.muted,
    verticalAlignment: "middle",
  });

  addShape(slide, "roundRect", `operator-${index}-accent`, x + 18, y + h - 10, w - 36, 4, member.accent, member.accent, 0, "rounded-full");
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

  addShape(slide, "roundRect", "section-pill", 56, 34, 245, 39, "#121619/96", C.rule, 1, "rounded-full");
  addShape(slide, "ellipse", "section-dot", 74, 49, 8, 8, C.orange);
  addText(slide, "section-label", "COUNCIL OPERATORS", 98, 43, 170, 20, {
    fontSize: 13,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });

  addText(slide, "headline", "The council brings reach, implementation, and clinical depth.", 56, 100, 1110, 48, {
    fontSize: 36,
    bold: true,
    color: C.white,
  });
  addText(
    slide,
    "subtitle",
    "Operators connect communications, youth sport, technology, sports medicine, campus care, and HBCU networks to accelerate adoption.",
    56,
    165,
    1140,
    30,
    { fontSize: 18, color: C.muted },
  );

  const members = [
    {
      name: "Jill Geer",
      lane: "COMMUNICATIONS + OLYMPIC MOVEMENT",
      bio: "USA Gymnastics Chief Communications & Marketing Officer; nearly 20 years across the Olympic movement.",
      accent: C.cyan,
      image: ASSETS.jill,
    },
    {
      name: "Amber Camp",
      lane: "YOUTH SPORT + FUNDRAISING",
      bio: "Youth basketball coach with school and sports fundraising experience at Snap! Raise.",
      accent: C.lime,
      image: ASSETS.amber,
    },
    {
      name: "Talia Mark",
      lane: "SPORT MARKETING + GOVERNING BODIES",
      bio: "Former USA Swimming multicultural marketing director and NASCAR diversity affairs manager.",
      accent: C.violet,
      image: ASSETS.talia,
    },
    {
      name: "Tram Holloway",
      lane: "PERFORMANCE TECHNOLOGY + CLINICS",
      bio: "HyperCharge Health CTO with nearly 30 years in human performance, wellness technology, and clinic implementation.",
      accent: C.orange,
      image: ASSETS.tram,
    },
    {
      name: "Dr. Jeremy Burnham",
      lane: "SPORTS MEDICINE + RESEARCH",
      bio: "Ochsner Baton Rouge Medical Director of Sports Medicine; dual board-certified surgeon, former LSU football player, and clinical-trials investigator.",
      accent: C.blue,
      image: ASSETS.jeremy,
    },
    {
      name: "Dr. Malkia Johnson",
      lane: "CAMPUS MENTAL HEALTH + CLINICAL WORKFLOW",
      bio: "UMES Counseling Services Director and East Coast lead for AuntEDNA’s Clinical Directors Council.",
      accent: C.pink,
      image: ASSETS.malkia,
    },
  ];

  const cardStartX = 56;
  const cardStartY = 225;
  const cardW = 368;
  const cardH = 158;
  const gapX = 28;
  const gapY = 22;
  for (let i = 0; i < members.length; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    await addOperatorCard(
      slide,
      members[i],
      i + 1,
      cardStartX + col * (cardW + gapX),
      cardStartY + row * (cardH + gapY),
      cardW,
      cardH,
    );
  }

  addShape(slide, "roundRect", "adoption-band", 56, 598, 1160, 38, "#171B20/98", C.rule, 1, "rounded-full");
  addText(
    slide,
    "adoption-copy",
    "ADOPTION REQUIRES MORE THAN PRODUCT: STORY  •  TRUST  •  CLINICAL WORKFLOW  •  INSTITUTIONAL ACCESS",
    88,
    608,
    1096,
    18,
    { fontSize: 11.2, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle" },
  );

  addShape(slide, "line", "footer-rule", 56, 676, 1160, 0, "none", C.rule, 1);
  addText(slide, "footer-left", "PULSE INTELLIGENCE LABS  /  Q2 2026 ADVISORY BOARD REVIEW", 56, 688, 430, 14, {
    fontSize: 8.5,
    bold: true,
    color: C.muted,
  });
  addText(slide, "footer-sources", "Sources: Ochsner Health; UMES; HyperCharge Health; USA Gymnastics; council-provided backgrounds", 780, 688, 400, 14, {
    fontSize: 7.8,
    color: C.muted,
    alignment: "right",
  });
  addText(slide, "slide-number", "12", 1195, 687, 20, 14, {
    fontSize: 8.5,
    bold: true,
    color: C.lime,
    alignment: "right",
  });

  slide.speakerNotes.textFrame.setText(
    "The council’s operating reach now includes sports medicine and campus clinical workflow. Dr. Jeremy Burnham brings orthopedic sports medicine leadership, research and athlete perspective. Dr. Malkia Johnson brings UMES campus counseling leadership and East Coast clinical-director coordination through AuntEDNA.\n\nDr. Burnham is not presented as LSU’s current head team physician. Public sources support that he is a former LSU football player, Ochsner Baton Rouge Medical Director of Sports Medicine, a dual board-certified orthopedic surgeon, and a clinical-trials investigator. Dr. Johnson’s UMES title is Director of Counseling Services; the East Coast Clinical Directors Council role comes from council/company-provided materials.\n\n[Sources]\n- https://www.ochsner.org/doctors/jeremy-burnham/\n- https://www.ochsner.org/services/sports-medicine-baton-rouge/\n- https://lsusports.net/sports/fb/roster/player/jeremy-burnham/\n- https://www.sportsmed.org/research/sports-medicine-research-grants/playmaker-grant-lab\n- https://wwwcp.umes.edu/student/emse-leadership-team/\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PIL/TheAthleticMindCouncil.tsx\n- https://www.hyperchargehealth.com/tram-holloway\n- User-provided slide screenshot for Jill Geer, Amber Camp, Talia Mark and Tram Holloway portraits and existing biography copy.\n- https://www.sportsmed.org/uploads/main/images/general/06-Headshots/_square/Burnham-Jeremy.jpg\n- /Users/tremainegrant/Documents/GitHub/QuickLifts-Web/public/malkia-advisor.png\n[/Sources]",
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
