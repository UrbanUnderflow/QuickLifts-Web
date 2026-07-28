import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/gtm-icp-slide";
const FINAL_PPTX = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs/PIL_GTM_Ecosystem_ICP_Slide.pptx";

const C = {
  bg: "#070A0B",
  surface: "#101416",
  surface2: "#12180D",
  white: "#F5F5F2",
  muted: "#9FA4AD",
  rule: "#30363B",
  lime: "#C8FF00",
  blue: "#4D8FFF",
  violet: "#9B72FF",
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

function addEngine(slide, index, headline, body, color, x, y, w, bodyHeight) {
  addText(slide, `engine-${index}-number`, `0${index}`, x, y, 55, 38, {
    fontSize: 28,
    bold: true,
    color,
  });
  addText(slide, `engine-${index}-headline`, headline, x + 76, y + 1, w - 76, 31, {
    fontSize: 22,
    bold: true,
    color: C.white,
  });
  addText(slide, `engine-${index}-body`, body, x + 76, y + 38, w - 76, bodyHeight, {
    fontSize: 15,
    color: C.muted,
  });
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir("/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs", { recursive: true });

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;

  // Section label.
  addShape(slide, "roundRect", "section-pill", 62, 42, 230, 40, C.surface, C.rule, 1, "rounded-full");
  addShape(slide, "ellipse", "section-dot", 80, 57, 8, 8, C.lime);
  addText(slide, "section-label", "GO-TO-MARKET", 102, 51, 165, 22, {
    fontSize: 15,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });

  // ICP patch.
  addShape(slide, "roundRect", "icp-patch", 1001, 36, 226, 79, C.surface2, C.lime, 1.5, "rounded-xl");
  addText(slide, "icp-kicker", "BEACHHEAD ICP", 1020, 48, 188, 18, {
    fontSize: 11,
    bold: true,
    color: C.lime,
    alignment: "center",
  });
  addText(slide, "icp-title", "ATHLETIC DIRECTORS", 1014, 67, 200, 22, {
    fontSize: 17,
    bold: true,
    color: C.white,
    alignment: "center",
  });
  addText(slide, "icp-scope", "NCAA  •  NAIA  •  NJCAA", 1022, 93, 184, 13, {
    fontSize: 9.5,
    bold: true,
    color: C.muted,
    alignment: "center",
  });

  // Headline.
  addText(slide, "headline", "Expand across the ecosystem.", 62, 112, 870, 61, {
    fontSize: 50,
    bold: true,
    color: C.white,
  });

  // Nested market diagram.
  addShape(slide, "ellipse", "ecosystem-outer", 43, 166, 530, 510, "#4D8FFF/05", C.blue, 1.7);
  addShape(slide, "ellipse", "ecosystem-youth", 99, 252, 418, 414, "#9B72FF/04", C.violet, 1.7);
  addShape(slide, "ellipse", "ecosystem-college", 164, 330, 288, 286, "#C8FF00/04", C.lime, 1.7);
  addShape(slide, "ellipse", "ecosystem-ncaa", 244, 427, 128, 128, C.lime);

  addText(slide, "outer-label", "FULL INSTITUTIONAL ECOSYSTEM", 143, 207, 329, 23, {
    fontSize: 16,
    bold: true,
    color: C.blue,
    alignment: "center",
  });
  addText(slide, "outer-sub", "SPORTS  •  EDUCATION  •  WORKFORCE", 148, 232, 319, 18, {
    fontSize: 12.5,
    bold: true,
    color: C.muted,
    alignment: "center",
  });
  addText(slide, "youth-label", "YOUTH + AMATEUR ATHLETICS", 154, 289, 310, 22, {
    fontSize: 16,
    bold: true,
    color: C.violet,
    alignment: "center",
  });
  addText(slide, "college-label", "COLLEGE ATHLETICS", 207, 376, 202, 22, {
    fontSize: 16,
    bold: true,
    color: C.lime,
    alignment: "center",
  });
  addText(slide, "ncaa-label", "NCAA", 261, 472, 94, 34, {
    fontSize: 23,
    bold: true,
    color: C.bg,
    alignment: "center",
    verticalAlignment: "middle",
  });

  // Acquisition engines.
  addShape(slide, "line", "vertical-divider", 625, 231, 0, 417, "none", C.rule, 1);
  addText(slide, "engine-heading", "Three acquisition engines", 671, 243, 490, 41, {
    fontSize: 29,
    bold: true,
    color: C.white,
  });

  addEngine(
    slide,
    1,
    "Athletic Mind Council + Network",
    "Olympic gold medalists, former professional athletes, clinicians, coaches and sport-governing-body leaders create warm access and credibility.",
    C.lime,
    671,
    329,
    512,
    48,
  );
  addShape(slide, "line", "engine-rule-1", 671, 426, 512, 0, "none", C.rule, 1);
  addEngine(
    slide,
    2,
    "Athletic Director Conferences",
    "NACDA & Affiliates Convention  •  NCAA Convention\nNIAAA/NFHS National Athletic Directors Conference",
    C.lime,
    671,
    450,
    512,
    43,
  );
  addShape(slide, "line", "engine-rule-2", 671, 547, 512, 0, "none", C.rule, 1);
  addEngine(
    slide,
    3,
    "Elite Youth Sporting Events",
    "AAU National Championships  •  Junior Olympic Games  •  Nike EYBL Peach Jam\nUSA Volleyball Junior Nationals  •  US Youth Soccer National Championships  •  New Balance Nationals",
    C.lime,
    671,
    569,
    512,
    55,
  );

  // Market-entry thesis.
  addText(
    slide,
    "market-entry-footer",
    "LAND IN COLLEGE  •  PROVE OUTCOMES  •  EXPAND INTO YOUTH  •  SCALE ACROSS THE ECOSYSTEM",
    319,
    688,
    904,
    18,
    {
      fontSize: 13,
      bold: true,
      color: C.lime,
      alignment: "center",
    },
  );

  slide.speakerNotes.textFrame.setText(
    "PulseCheck's beachhead ideal customer profile is the athletic director: the executive buyer responsible for athlete health, performance, compliance and departmental budgets. The company lands inside college athletics, proves measurable outcomes, expands into youth and amateur athletics, and ultimately scales across the broader institutional ecosystem.\n\n[Sources]\n- User-provided GTM slide and positioning.\n- https://nacda.com/sports/2018/7/17/nacda-events-html.aspx\n- https://www.ncaa.org/convention/\n- https://niaaa.org/conferences\n- https://aausports.org/junior-olympic-games/future-dates/\n- https://nikeeyb.com/\n- https://usavolleyball.org/story/usa-volleyball-brings-premier-junior-event-to-indianapolis-in-2026/\n- https://www.usyouthsoccer.org/national-championships/\n- https://nbnationalsout.com/\n[/Sources]",
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
