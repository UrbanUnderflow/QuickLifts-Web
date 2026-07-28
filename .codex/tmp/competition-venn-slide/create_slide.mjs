import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TMP_DIR = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/.codex/tmp/competition-venn-slide";
const FINAL_PPTX = "/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/outputs/PIL_Competition_Venn_Slide.pptx";

const C = {
  bg: "#07090B",
  bg2: "#0C1013",
  surface: "#111518",
  surface2: "#151A1E",
  white: "#F4F4F1",
  muted: "#AAAEB8",
  dim: "#727984",
  rule: "#2E353A",
  lime: "#C8FF00",
  blue: "#4D8FFF",
  violet: "#9A72FF",
  orange: "#FF9A36",
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

function addStrategyItem(slide, index, headline, body, color, x, y, w) {
  addText(slide, `strategy-${index}-number`, `0${index}`, x, y, 42, 30, {
    fontSize: 21,
    bold: true,
    color,
  });
  addText(slide, `strategy-${index}-headline`, headline, x + 52, y, w - 52, 25, {
    fontSize: 18,
    bold: true,
    color: C.white,
  });
  addText(slide, `strategy-${index}-body`, body, x + 52, y + 27, w - 52, 47, {
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
  slide.background.fill = "linear(0deg, #06080A 0%, #0A0E11 100%)";

  // Eyebrow.
  addShape(slide, "roundRect", "eyebrow-pill", 62, 34, 205, 39, C.surface, C.rule, 1, "rounded-full");
  addShape(slide, "ellipse", "eyebrow-dot", 80, 49, 8, 8, C.lime);
  addText(slide, "eyebrow", "COMPETITION", 101, 43, 143, 21, {
    fontSize: 15,
    bold: true,
    color: C.white,
    verticalAlignment: "middle",
  });

  // Headline and setup.
  addText(slide, "headline", "PulseCheck unifies what universities already buy.", 62, 97, 1156, 58, {
    fontSize: 49,
    bold: true,
    color: C.white,
  });
  addText(
    slide,
    "subtitle",
    "WHOOP measures physiological readiness. Calm builds mindfulness. TimelyCare delivers licensed care. PulseCheck connects all three through sport-specific mental performance.",
    62,
    166,
    1142,
    46,
    {
      fontSize: 19,
      color: C.muted,
    },
  );

  // Venn diagram circles: native editable objects.
  addShape(slide, "ellipse", "whoop-circle", 86, 270, 320, 320, `${C.blue}/13`, C.blue, 2);
  addShape(slide, "ellipse", "calm-circle", 337, 270, 320, 320, `${C.violet}/13`, C.violet, 2);
  addShape(slide, "ellipse", "timelycare-circle", 211, 377, 320, 320, `${C.orange}/13`, C.orange, 2);

  // Outer competency labels.
  addText(slide, "whoop-name", "WHOOP", 132, 302, 132, 29, {
    fontSize: 23,
    bold: true,
    color: C.blue,
  });
  addText(slide, "whoop-competency", "PHYSIOLOGICAL READINESS", 132, 337, 214, 42, {
    fontSize: 17,
    bold: true,
    color: C.white,
  });
  addText(slide, "whoop-detail", "Sleep • strain • recovery", 132, 379, 205, 24, {
    fontSize: 15,
    color: C.muted,
  });
  addText(slide, "whoop-gap", "Measures load—not sport-specific mental demands.", 118, 420, 175, 55, {
    fontSize: 14,
    color: C.muted,
    alignment: "center",
  });

  addText(slide, "calm-name", "Calm", 515, 302, 90, 29, {
    fontSize: 23,
    bold: true,
    color: C.violet,
    alignment: "right",
  });
  addText(slide, "calm-competency", "MINDFULNESS SKILLS", 459, 337, 176, 42, {
    fontSize: 17,
    bold: true,
    color: C.white,
    alignment: "right",
  });
  addText(slide, "calm-detail", "Breathing • meditation • sleep", 429, 379, 206, 39, {
    fontSize: 15,
    color: C.muted,
    alignment: "right",
  });
  addText(slide, "calm-gap", "General wellness—not designed around competition.", 559, 420, 140, 55, {
    fontSize: 14,
    color: C.muted,
    alignment: "center",
  });

  addText(slide, "timelycare-name", "TimelyCare", 278, 589, 186, 29, {
    fontSize: 23,
    bold: true,
    color: C.orange,
    alignment: "center",
  });
  addText(slide, "timelycare-competency", "LICENSED CARE", 277, 620, 188, 26, {
    fontSize: 17,
    bold: true,
    color: C.white,
    alignment: "center",
  });
  addText(slide, "timelycare-detail", "24/7 counseling • psychiatry", 262, 650, 218, 23, {
    fontSize: 14,
    color: C.muted,
    alignment: "center",
  });
  addText(slide, "timelycare-proof", "Nearly 500 colleges", 292, 675, 158, 18, {
    fontSize: 13,
    bold: true,
    color: C.orange,
    alignment: "center",
  });

  // Triple-overlap center.
  addShape(slide, "roundRect", "pulsecheck-center", 267, 445, 276, 124, "#131C09/94", C.lime, 2, "rounded-xl");
  addText(slide, "pulsecheck-name", "PULSECHECK", 292, 461, 226, 29, {
    fontSize: 23,
    bold: true,
    color: C.lime,
    alignment: "center",
  });
  addText(slide, "pulsecheck-category", "SPORT-SPECIFIC\nMENTAL PERFORMANCE", 287, 492, 236, 46, {
    fontSize: 17,
    bold: true,
    color: C.white,
    alignment: "center",
  });
  addText(slide, "pulsecheck-action", "Detect early • train daily • escalate", 291, 541, 228, 18, {
    fontSize: 12,
    bold: true,
    color: C.lime,
    alignment: "center",
  });

  // Right-side strategic meaning.
  addShape(slide, "line", "vertical-divider", 724, 255, 0, 411, "none", C.rule, 1);
  addText(slide, "strategy-heading", "WHY THE OVERLAP MATTERS", 766, 263, 424, 29, {
    fontSize: 20,
    bold: true,
    color: C.lime,
  });
  addStrategyItem(
    slide,
    1,
    "PERFORMANCE DRIVES ADOPTION",
    "Athletes engage to get better—not because something is wrong.",
    C.blue,
    766,
    315,
    424,
  );
  addShape(slide, "line", "strategy-rule-1", 766, 394, 424, 0, "none", C.rule, 1);
  addStrategyItem(
    slide,
    2,
    "DAILY TRAINING CREATES A PATH TO CARE",
    "Engagement begins before an athlete needs clinical support.",
    C.violet,
    766,
    415,
    424,
  );
  addShape(slide, "line", "strategy-rule-2", 766, 494, 424, 0, "none", C.rule, 1);
  addStrategyItem(
    slide,
    3,
    "EXISTING CONTRACTS SPEED ADOPTION",
    "Layer onto WHOOP and TimelyCare—or replace fragmented tools.",
    C.orange,
    766,
    515,
    424,
  );

  // Deployment strategy band.
  addShape(slide, "roundRect", "deployment-band", 754, 606, 449, 79, "#12190E", "#3C4E00", 1, "rounded-xl");
  addText(slide, "deployment-modes", "LAND ALONGSIDE  •  INTEGRATE  •  CONSOLIDATE", 776, 621, 405, 23, {
    fontSize: 16,
    bold: true,
    color: C.lime,
    alignment: "center",
  });
  addText(slide, "deployment-explanation", "Existing university contracts shorten the path to adoption.", 790, 652, 377, 20, {
    fontSize: 14,
    bold: true,
    color: C.white,
    alignment: "center",
  });

  slide.speakerNotes.textFrame.setText(
    "PulseCheck's competitive advantage is not simply feature breadth. It uses performance as the athlete's entry point, translates physiological and behavioral signals through the demands of a specific sport, trains mental skills daily, and creates a pathway to licensed care when escalation is needed. TimelyCare reports a footprint of nearly 500 colleges and universities. WHOOP also has a demonstrated collegiate-athletics footprint, including university-wide or department partnerships. The campus presence of these tools can be a distribution advantage: PulseCheck can deploy alongside existing investments, integrate where practical, and help institutions consolidate fragmented point solutions over time.\n\nThe slide intentionally avoids unsupported claims that most institutions are unhappy with TimelyCare or that athletes do not use it. It also does not claim WHOOP cannot recognize activity types; the gap presented is sport-specific mental-performance context and training.\n\n[Sources]\n- https://timelycare.com/\n- https://support.whoop.com/s/article/WHOOP-Strain\n- https://support.whoop.com/s/article/WHOOP-Recovery\n- https://www.whoop.com/us/en/press-center/official-performance-partner-howard-university-athletics/\n- https://support.calm.com/hc/en-us/articles/360000069973-Breathing-Exercises\n- https://support.calm.com/hc/en-us/articles/35795753391003-Available-Calm-Apps\n[/Sources]",
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
