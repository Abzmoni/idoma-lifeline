// Idoma Lifeline: Idoma Centenary Hackathon pitch deck (structured pptxgenjs deck)
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const Lu = require("react-icons/lu");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const ROOT = "C:/Users/Abz/Desktop/Projects/emergency";
const SHOTS = ROOT + "/tools/artifacts/";
const OUT = process.env.DECK_OUT || ROOT + "/pitch/Idoma_Lifeline_Pitch_Deck_2026.pptx";

// ------------------------------------------------------------------ theme
const HEX = {
  ink: "1B2430", inkSoft: "2A3441", muted: "56606D", stone: "F1F2EE", white: "FFFFFF",
  orange: "E8600C", water: "1C6E8C", medical: "C4453C", safe: "1F8A78", food: "C99A2E", shelter: "A85C32",
  tint: "FCE6D6", dimText: "B9C0CC",
};
const THEME = {
  name: "Idoma Lifeline",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.muted, lt2: HEX.stone,
    accent1: HEX.orange, accent2: HEX.water, accent3: HEX.medical, accent4: HEX.safe,
    accent5: HEX.food, accent6: HEX.shelter, hlink: HEX.orange, folHlink: HEX.muted,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Idoma Lifeline: Pitch Deck";
pres.author = "HAQTRI PLC";
pres.company = "HAQTRI PLC";
const C = pres.SchemeColor;

// accent scheme names for convenience
const ORANGE = C.accent1, WATER = C.accent2, MEDICAL = C.accent3, SAFE = C.accent4, FOOD = C.accent5, SHELTER = C.accent6;
const INK = C.text1, MUTED = C.text2, WHITE = C.background1, STONE = C.background2;

// ------------------------------------------------------------------ layouts
const FOOT = "IDOMA LIFELINE  ·  Idoma Centenary Hackathon 2026";
function defineLayout(name, dark) {
  pres.defineSlideMaster({
    title: name,
    background: { color: dark ? INK : WHITE },
    objects: [
      { placeholder: { options: { name: "kicker", type: "body", x: 0.6, y: 0.42, w: 12.1, h: 0.32, fontSize: 13, bold: true,
          color: ORANGE, charSpacing: 2, margin: 0, valign: "top" }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.74, w: 12.1, h: 0.75, fontSize: 32, bold: true,
          color: dark ? WHITE : INK, margin: 0, valign: "top", align: "left", fontFace: THEME.headFontFace }, text: "" } },
      { text: { text: FOOT, options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: dark ? WHITE : MUTED, margin: 0 } } },
    ],
    slideNumber: { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: dark ? WHITE : MUTED, align: "right" },
  });
}
defineLayout("LIGHT_CONTENT", false);
defineLayout("DARK_CONTENT", true);
pres.defineSlideMaster({ title: "DARK_COVER", background: { color: INK }, objects: [] });

// ------------------------------------------------------------------ helpers
const iconCache = {};
async function icon(name, hex) {
  const key = name + hex;
  if (iconCache[key]) return iconCache[key];
  const Comp = Lu[name];
  if (!Comp) throw new Error("Missing icon " + name);
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: "#" + hex, size: 256, strokeWidth: 2.2 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return (iconCache[key] = "image/png;base64," + buf.toString("base64"));
}
function tx(s, text, o) {
  s.addText(text, Object.assign({ isTextBox: true, margin: 0, valign: "top", color: INK, fontSize: 15 }, o));
}
function box(s, x, y, w, h, fill, name, line) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: fill },
    line: line ? { color: line, width: 1 } : { type: "none" }, objectName: name,
  });
}
// Signature motif: the map-marker "pin tile" (rounded square + white icon)
async function tile(s, x, y, size, fill, iconName, iconHex = HEX.white) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: size, h: size, rectRadius: size * 0.2, fill: { color: fill },
    line: { type: "none" }, objectName: "pin-tile-" + iconName });
  const pad = size * 0.22;
  s.addImage({ data: await icon(iconName, iconHex), x: x + pad, y: y + pad, w: size - 2 * pad, h: size - 2 * pad, altText: iconName });
}
function content(kicker, title, dark = false) {
  const s = pres.addSlide({ masterName: dark ? "DARK_CONTENT" : "LIGHT_CONTENT", sectionTitle: currentSection });
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  return s;
}
let currentSection = "";
function section(t) { currentSection = t; pres.addSection({ title: t }); }
function caption(s, text, x, y, w, dark = false) {
  tx(s, text, { x, y, w, h: 0.3, fontSize: 10, color: dark ? WHITE : MUTED, italic: true });
}
function shot(s, file, x, y, w, h, alt, dark = false) {
  s.addShape(pres.shapes.RECTANGLE, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06,
    fill: { color: dark ? HEX.inkSoft : HEX.white }, line: { color: dark ? HEX.inkSoft : "CFD4D9", width: 1 }, objectName: "frame-" + alt });
  s.addImage({ path: SHOTS + file, x, y, w, h, altText: alt });
}

(async () => {
  // ================================================================ 1 COVER
  section("Introduction");
  {
    const s = pres.addSlide({ masterName: "DARK_COVER", sectionTitle: currentSection });
    tx(s, "IDOMA CENTENARY HACKATHON 2026  ·  HEALTH & COMMUNITY DEVELOPMENT", { x: 0.7, y: 0.9, w: 8.4, h: 0.35, fontSize: 13, bold: true, color: ORANGE, charSpacing: 2 });
    tx(s, "Idoma Lifeline", { x: 0.7, y: 1.5, w: 8, h: 1.2, fontSize: 60, bold: true, color: WHITE, fontFace: THEME.headFontFace });
    tx(s, "Find verified help in a crisis: online, offline, or on any basic phone.", { x: 0.7, y: 2.85, w: 7.4, h: 1.0, fontSize: 24, color: WHITE });
    const cats = [["LuHouse", SHELTER], ["LuDroplet", WATER], ["LuCross", MEDICAL], ["LuUtensils", FOOD], ["LuShieldCheck", SAFE], ["LuTriangleAlert", ORANGE]];
    for (let i = 0; i < cats.length; i++) await tile(s, 0.7 + i * 0.78, 4.25, 0.6, cats[i][1], cats[i][0]);
    tx(s, [
      { text: "HAQTRI PLC", options: { bold: true, breakLine: true } },
      { text: "Project lead: Abah David", options: { breakLine: true } },
      { text: "Working prototype · Otukpo, Benue State" },
    ], { x: 0.7, y: 5.2, w: 7, h: 1.2, fontSize: 16, color: WHITE, paraSpaceAfter: 4 });
    // phone screenshot
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.35, y: 0.7, w: 2.95, h: 6.1, rectRadius: 0.25, fill: { color: HEX.inkSoft }, line: { type: "none" }, objectName: "phone-body" });
    s.addImage({ path: SHOTS + "mobile.png", x: 9.5, y: 0.85, w: 2.65, h: 5.73, altText: "Idoma Lifeline mobile map" });
    s.addNotes("Good morning, judges. We are HAQTRI PLC, and this is Idoma Lifeline: a working emergency-information service that helps displaced families in Idomaland find verified shelter, water, medical care and food, whether they have internet, have lost it, or only own a basic phone. Category: healthcare access and community development. (~20 seconds)");
  }

  // ================================================================ 2 PROBLEM
  section("Problem and solution");
  {
    const s = content("THE PROBLEM", "Displaced families can't find help they can trust");
    const stats = [
      ["3.7M", "people internally displaced in Nigeria (early 2026)"],
      ["464k", "displaced in Benue State, the 2nd-largest host state (IOM)"],
      ["36%", "of mobile lines still on 2G, with no smartphone data (NCC)"],
    ];
    stats.forEach(([n, l], i) => {
      const y = 1.8 + i * 1.5;
      tx(s, n, { x: 0.6, y, w: 5.2, h: 0.85, fontSize: 54, bold: true, color: ORANGE, fontFace: THEME.headFontFace });
      tx(s, l, { x: 0.6, y: y + 0.85, w: 5.0, h: 0.55, fontSize: 15, color: INK });
    });
    box(s, 6.3, 1.8, 6.4, 4.55, STONE, "causes-card");
    tx(s, "Why it happens", { x: 6.65, y: 2.05, w: 5.8, h: 0.4, fontSize: 19, bold: true });
    const causes = [
      ["LuMessagesSquare", "Help information is scattered across WhatsApp groups, calls and paper lists"],
      ["LuTriangleAlert", "Unverified rumours send families down unsafe roads"],
      ["LuSmartphone", "Smartphone-only apps exclude feature-phone owners"],
      ["LuWifiOff", "Networks drop exactly when people need them most"],
    ];
    for (let i = 0; i < causes.length; i++) {
      const y = 2.6 + i * 0.75;
      await tile(s, 6.65, y, 0.5, i === 1 ? MEDICAL : INK, causes[i][0]);
      tx(s, causes[i][1], { x: 7.35, y: y + 0.02, w: 5.1, h: 0.6, fontSize: 15, valign: "middle" });
    }
    tx(s, [
      { text: "Who is affected: ", options: { bold: true } },
      { text: "displaced families, host communities, and the volunteers and coordinators who serve them" },
    ], { x: 6.65, y: 5.6, w: 5.8, h: 0.6, fontSize: 14 });
    caption(s, "Sources: IOM via Federal Ministry of Information (2026); IOM DTM / secondary reporting; NCC network data via ThisDay (Oct 2026).", 0.6, 6.55, 12.1);
    s.addNotes("Nigeria has about 3.7 million internally displaced people. Benue alone hosts about 464,000, the second-largest number after Borno, and Agatu and Apa in Idomaland are at the centre of it. When a family flees, help information is scattered across WhatsApp groups, phone calls and paper lists. Rumours are unverified, apps assume smartphones and data, and about a third of mobile lines are still on 2G. People waste hours, and sometimes walk into danger, looking for help that is close by. (~50 seconds)");
  }

  // ================================================================ 3 SOLUTION
  {
    const s = content("OUR SOLUTION", "One verified directory, three ways to reach it");
    const cols = [
      ["LuGlobe", WATER, "Online", "Smartphone or laptop with data", "Live map and list of verified help, last-verified times, and directions with hazard warnings."],
      ["LuWifiOff", ORANGE, "Offline", "Smartphone without a connection", "Saved resources and viewed maps keep working. New reports queue on the phone and sync automatically."],
      ["LuPhone", SAFE, "USSD & SMS", "Any basic phone, no data", "Dial a short code, pick a need and a nearby landmark, and get the nearest verified help back."],
    ];
    for (let i = 0; i < 3; i++) {
      const [ic, col, h, dev, body] = cols[i];
      const x = 0.6 + i * 4.135;
      box(s, x, 1.8, 3.83, 3.6, STONE, "channel-" + h);
      await tile(s, x + 0.35, 2.1, 0.8, col, ic);
      tx(s, h, { x: x + 0.35, y: 3.1, w: 3.2, h: 0.45, fontSize: 22, bold: true });
      tx(s, dev, { x: x + 0.35, y: 3.55, w: 3.2, h: 0.35, fontSize: 13, color: MUTED, italic: true });
      tx(s, body, { x: x + 0.35, y: 3.95, w: 3.2, h: 1.3, fontSize: 15 });
    }
    box(s, 0.6, 5.7, 12.1, 0.95, INK, "trust-band");
    await tile(s, 0.85, 5.88, 0.6, ORANGE, "LuShieldCheck");
    tx(s, "Every record is checked by local coordinators before it goes public, and shows when it was last verified.", { x: 1.7, y: 5.75, w: 10.8, h: 0.85, fontSize: 18, bold: true, color: WHITE, valign: "middle" });
    s.addNotes("Idoma Lifeline is one verified directory of emergency resources that people can reach three ways. Online, they get a live map. Offline, the saved app still works and reports queue on the phone. On any basic phone, a USSD menu returns the nearest verified help with no data needed. Local coordinators review everything before it goes public. (~35 seconds)");
  }

  // ================================================================ 4 HOW IT WORKS
  {
    const s = content("HOW IT WORKS", "From a report to verified help in four steps");
    const steps = [
      ["LuMapPin", "Report", "Anyone reports shelter, water, care or a hazard: by app, SMS or USSD, even offline."],
      ["LuUserCheck", "Verify", "A local coordinator checks it in the dashboard, then approves or rejects it."],
      ["LuBadgeCheck", "Publish", "The verified record goes live with its verification time and public contact."],
      ["LuRadioTower", "Reach", "Families find it on the map, in the offline cache, or by a USSD reply."],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.15;
      box(s, x, 1.85, 2.65, 2.75, STONE, "step-" + steps[i][1]);
      tx(s, "0" + (i + 1), { x: x + 0.3, y: 2.05, w: 1, h: 0.5, fontSize: 26, bold: true, color: ORANGE });
      await tile(s, x + 1.8, 2.05, 0.55, INK, steps[i][0]);
      tx(s, steps[i][1], { x: x + 0.3, y: 2.75, w: 2.1, h: 0.45, fontSize: 21, bold: true });
      tx(s, steps[i][2], { x: x + 0.3, y: 3.25, w: 2.15, h: 1.3, fontSize: 14 });
      if (i < 3) s.addImage({ data: await icon("LuChevronRight", HEX.orange), x: x + 2.7, y: 3.0, w: 0.4, h: 0.4, altText: "next" });
    }
    tx(s, "The trust layer", { x: 0.6, y: 4.95, w: 6, h: 0.4, fontSize: 19, bold: true });
    const trust = [
      ["LuLock", "Reporter contact stays private"],
      ["LuClock", "Last-verified time on every record"],
      ["LuRoute", "Route warnings when hazards remain"],
      ["LuCopyCheck", "Offline retries never create duplicates"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.075;
      box(s, x, 5.45, 2.9, 1.1, WHITE, "trust-" + i, "CFD4D9");
      await tile(s, x + 0.2, 5.72, 0.55, SAFE, trust[i][0]);
      tx(s, trust[i][1], { x: x + 0.9, y: 5.5, w: 1.9, h: 1.0, fontSize: 14, valign: "middle" });
    }
    s.addNotes("Here is how it works. Anyone can report, even offline. A coordinator verifies the report, it is published with a verification time, and families reach it on any channel. Trust is built in: reporter phone numbers stay private, every record shows when it was last checked, routes carry hazard warnings, and offline retries never create duplicates. (~35 seconds)");
  }

  // ================================================================ 5 FEATURES
  section("Product");
  {
    const s = content("PRODUCT FEATURES", "A working prototype, built for the field");
    shot(s, "map-home.png", 0.6, 1.8, 7.05, 4.7, "Desktop map with resource categories");
    caption(s, "Desktop map showing Otukpo demonstration data (sample records).", 0.6, 6.58, 7.05);
    const feats = [
      ["LuLayers", SHELTER, "Six need categories", "Shelter, water, medical, food, hazards"],
      ["LuList", WATER, "List view with capacity", "Distance, contacts, last-verified time"],
      ["LuMapPin", ORANGE, "Report in under a minute", "Pin confirmation, no sign-up needed"],
      ["LuWifiOff", INK, "Works offline", "Saved data; reports queue and auto-sync"],
      ["LuRoute", MEDICAL, "Hazard-checked directions", "Warns when a hazard is on the route"],
      ["LuLayoutDashboard", SAFE, "Coordinator dashboard", "Approve, edit, stats and SMS logs"],
    ];
    for (let i = 0; i < feats.length; i++) {
      const y = 1.8 + i * 0.8;
      await tile(s, 8.05, y + 0.05, 0.58, feats[i][1], feats[i][0]);
      tx(s, feats[i][2], { x: 8.85, y, w: 3.85, h: 0.33, fontSize: 16, bold: true });
      tx(s, feats[i][3], { x: 8.85, y: y + 0.35, w: 3.85, h: 0.35, fontSize: 13, color: MUTED });
    }
    s.addNotes("This is not a mock-up. It is a working progressive web app: six need categories, a list view with capacity and verification times, one-minute reporting with no sign-up, full offline mode, hazard-checked directions, and a coordinator dashboard. Let me show you. (~25 seconds)");
  }

  // ================================================================ 6 DEMO
  {
    const s = content("PROTOTYPE DEMONSTRATION", "Live demo: a family near Otukpo needs shelter", true);
    shot(s, "offline.png", 0.6, 1.8, 5.6, 3.73, "Offline mode with a queued report", true);
    caption(s, "Offline: saved data, 1 report waiting to sync", 0.6, 5.62, 5.6, true);
    shot(s, "mobile.png", 6.6, 1.8, 1.82, 3.94, "Mobile map", true);
    caption(s, "Mobile web app", 6.6, 5.82, 2.0, true);
    // USSD phone mock (drawn): mirrors backend/server.js menu text
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.4, y: 1.8, w: 2.6, h: 3.94, rectRadius: 0.22, fill: { color: HEX.inkSoft }, line: { color: "3A4656", width: 1 }, objectName: "ussd-phone" });
    s.addShape(pres.shapes.RECTANGLE, { x: 9.58, y: 2.05, w: 2.24, h: 1.7, fill: { color: "C9D8B6" }, line: { type: "none" }, objectName: "ussd-screen" });
    tx(s, [
      { text: "IDOMA LIFELINE", options: { bold: true, breakLine: true } },
      { text: "1. Find nearest", options: { breakLine: true } },
      { text: "   resource", options: { breakLine: true } },
      { text: "2. Report resource", options: { breakLine: true } },
      { text: "   or hazard" },
    ], { x: 9.68, y: 2.15, w: 2.1, h: 1.5, fontSize: 11, fontFace: "Courier New", color: "1E2A12" });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.68 + c * 0.72, y: 3.95 + r * 0.42, w: 0.6, h: 0.3, rectRadius: 0.08, fill: { color: "3A4656" }, line: { type: "none" }, objectName: `key-${r}-${c}` });
    }
    caption(s, "USSD on any phone (simulator)", 9.4, 5.82, 2.8, true);
    const demo = ["Find shelter", "Go offline", "Report water point", "Reconnect & approve", "USSD query"];
    for (let i = 0; i < 5; i++) {
      const x = 0.6 + i * 2.45;
      box(s, x, 6.25, 2.3, 0.55, HEX.inkSoft, "demo-step-" + i);
      tx(s, [{ text: (i + 1) + "  ", options: { bold: true, color: ORANGE } }, { text: demo[i], options: { color: WHITE } }],
        { x: x + 0.15, y: 6.25, w: 2.1, h: 0.55, fontSize: 14, valign: "middle" });
    }
    s.addNotes("LIVE DEMO, 3 minutes (follow DEMO.md). 1) Choose Shelter, open list view, pick a facility: show verification time and capacity, then directions. 2) Disconnect the network and reload: the saved resources still load. 3) Report a water point and show 'Saved on this device' with the waiting-to-sync count. 4) Reconnect: the report syncs. In the coordinator tab, approve it, and it appears on the public map. 5) In the SMS simulator, send 'WATER Otukpo market'. Say clearly that the USSD/SMS gateway is simulated and a live shortcode is part of the pilot. If the network fails, play the backup video.");
  }

  // ================================================================ 7 INNOVATION
  {
    const s = content("WHAT MAKES IT INNOVATIVE", "Built for the people other tools leave out");
    const Y = "✓", N = "✕", P = "Partial";
    const rows = [
      ["Works without mobile data", N, N, Y, Y],
      ["Works on basic phones", N, N, Y, Y],
      ["Information verified locally", N, N, P, Y],
      ["Pinpoints the nearest help", N, Y, N, Y],
      ["Citizens can report back", Y, P, P, Y],
      ["Warns about hazards on routes", N, N, N, Y],
    ];
    const head = ["Capability", "WhatsApp groups", "Online maps", "Radio & hotlines", "Idoma Lifeline"];
    const cell = (v, last) => ({
      text: v,
      options: { align: "center", bold: v !== P, fontSize: v === P ? 13 : 18,
        color: v === Y ? SAFE : v === N ? MEDICAL : MUTED, fill: { color: last ? HEX.tint : HEX.white } },
    });
    const data = [head.map((h, i) => ({ text: h, options: { bold: true, color: WHITE, fontSize: 14, align: i ? "center" : "left",
      fill: { color: i === 4 ? HEX.orange : HEX.ink } } }))];
    rows.forEach((r) => data.push([{ text: r[0], options: { fontSize: 15, color: INK, fill: { color: HEX.white } } },
      ...r.slice(1).map((v, i) => cell(v, i === 3))]));
    s.addTable(data, { x: 0.6, y: 1.8, w: 12.1, colW: [4.3, 1.95, 1.95, 1.95, 1.95], rowH: 0.52,
      border: { type: "solid", pt: 0.75, color: "D9DEE3" }, valign: "middle", margin: [0, 0.12, 0, 0.12] });
    box(s, 0.6, 5.75, 12.1, 0.85, STONE, "next-language");
    await tile(s, 0.8, 5.89, 0.58, ORANGE, "LuLanguages");
    tx(s, [{ text: "Now in English and Pidgin, ", options: { bold: true } }, { text: "on the map and the USSD menu. Idoma is next, written by native speakers." }],
      { x: 1.6, y: 5.75, w: 10.9, h: 0.85, fontSize: 17, valign: "middle" });
    s.addNotes("What is new? Existing options each solve one piece. WhatsApp needs data and is unverified. Online maps don't know where today's shelter is. Radio can't take reports or point to the nearest water point. Idoma Lifeline combines verification, offline use, basic-phone access, two-way reporting and hazard warnings in one service. The map and the USSD menu already work in English and Pidgin, and Idoma is next, written by our own native speakers. (~40 seconds)");
  }

  // ================================================================ 8 TECHNOLOGY
  {
    const s = content("TECHNOLOGY USED", "Proven, open technology that runs anywhere");
    const left = [
      ["LuSmartphone", WATER, "Progressive web app", "React 19 · Vite · Leaflet · Tailwind"],
      ["LuWifiOff", ORANGE, "Offline layer", "Service worker · IndexedDB (Dexie)"],
      ["LuPhone", SAFE, "SMS & USSD gateway", "Standard telco aggregator callbacks"],
    ];
    tx(s, "ACCESS CHANNELS", { x: 0.6, y: 1.72, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 1 });
    for (let i = 0; i < 3; i++) {
      const y = 2.05 + i * 1.05;
      box(s, 0.6, y, 3.75, 0.92, STONE, "chan-" + i);
      await tile(s, 0.78, y + 0.18, 0.56, left[i][1], left[i][0]);
      tx(s, left[i][2], { x: 1.5, y: y + 0.1, w: 2.8, h: 0.35, fontSize: 15, bold: true });
      tx(s, left[i][3], { x: 1.5, y: y + 0.47, w: 2.8, h: 0.35, fontSize: 12, color: MUTED });
    }
    s.addImage({ data: await icon("LuArrowRight", HEX.orange), x: 4.5, y: 3.3, w: 0.42, h: 0.42, altText: "to API" });
    tx(s, "CORE", { x: 5.05, y: 1.72, w: 3.3, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 1 });
    box(s, 5.05, 2.05, 3.3, 2.97, INK, "api");
    await tile(s, 5.3, 2.28, 0.6, ORANGE, "LuServer");
    tx(s, "Lifeline API", { x: 6.05, y: 2.35, w: 2.2, h: 0.45, fontSize: 19, bold: true, color: WHITE });
    tx(s, [
      { text: "Node.js · Express", options: { bullet: true, breakLine: true } },
      { text: "JWT coordinator login", options: { bullet: true, breakLine: true } },
      { text: "Strict input validation", options: { bullet: true, breakLine: true } },
      { text: "Retry de-duplication", options: { bullet: true } },
    ], { x: 5.3, y: 3.1, w: 2.9, h: 1.8, fontSize: 14, color: WHITE, paraSpaceAfter: 4 });
    s.addImage({ data: await icon("LuArrowRight", HEX.orange), x: 8.5, y: 3.3, w: 0.42, h: 0.42, altText: "to data" });
    tx(s, "DATA & MAPS", { x: 9.05, y: 1.72, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 1 });
    const right = [["LuDatabase", "Database", "SQLite for field kits; PostgreSQL + PostGIS at scale"], ["LuMap", "Open map services", "OpenStreetMap tiles; OSRM road routing"]];
    for (let i = 0; i < 2; i++) {
      const y = 2.05 + i * 1.55;
      box(s, 9.05, y, 3.65, 1.42, STONE, "data-" + i);
      await tile(s, 9.25, y + 0.2, 0.56, INK, right[i][0]);
      tx(s, right[i][1], { x: 10.0, y: y + 0.22, w: 2.6, h: 0.35, fontSize: 15, bold: true });
      tx(s, right[i][2], { x: 9.25, y: y + 0.85, w: 3.3, h: 0.5, fontSize: 13, color: MUTED });
    }
    const q = [
      ["LuFlaskConical", "Playwright end-to-end tests"],
      ["LuContainer", "Docker and one-click Render deploy"],
      ["LuNetwork", "Mapped with graphify: 320 nodes, 0 import cycles"],
      ["LuBadgePercent", "Open-source stack, no licence fees"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.075;
      box(s, x, 5.4, 2.9, 1.15, WHITE, "quality-" + i, "CFD4D9");
      await tile(s, x + 0.2, 5.7, 0.55, SAFE, q[i][0]);
      tx(s, q[i][1], { x: x + 0.9, y: 5.45, w: 1.9, h: 1.05, fontSize: 14, valign: "middle" });
    }
    s.addNotes("The stack is deliberately simple and open. A React progressive web app with a service worker and IndexedDB for offline use. A Node and Express API with JWT-protected coordinator access, strict validation and de-duplication of offline retries. SQLite runs on a single laptop in the field, and PostgreSQL with PostGIS runs at state scale. SMS and USSD callbacks follow the standard aggregator format, so going live means connecting a provider, not rewriting code. It is tested end to end with Playwright and deploys in one click. (~40 seconds)");
  }

  // ================================================================ 9 AUDIENCE
  section("Market and business");
  {
    const s = content("TARGET AUDIENCE", "Who uses it, and who pays for it");
    const panels = [
      ["Users: always free", STONE, ORANGE, [
        ["LuUsers", "Displaced families & host communities", "Find shelter, water, food and care fast"],
        ["LuPhone", "Basic-phone users", "Rural, elderly and low-income residents"],
        ["LuHandHeart", "Volunteers & community leaders", "Report and verify what they see"],
        ["LuHospital", "Clinics, shelters & water points", "Reach the people looking for them"],
      ]],
      ["Customers: who pays", HEX.tint, INK, [
        ["LuLandmark", "State & LGA emergency agencies", "SEMA Benue, NEMA, LGA councils"],
        ["LuHeartHandshake", "NGOs & UN agencies", "IOM, UNHCR, Red Cross, NRC"],
        ["LuRadioTower", "Telcos & USPF", "Sponsor free USSD access"],
        ["LuChartColumn", "Planners & donors", "Aggregated, anonymised needs data"],
      ]],
    ];
    for (let p = 0; p < 2; p++) {
      const [h, fill, tcol, rows] = panels[p];
      const x = 0.6 + p * 6.2;
      box(s, x, 1.8, 5.9, 4.85, fill, "audience-" + p);
      tx(s, h, { x: x + 0.35, y: 2.0, w: 5.2, h: 0.45, fontSize: 20, bold: true });
      for (let i = 0; i < 4; i++) {
        const y = 2.65 + i * 0.97;
        await tile(s, x + 0.35, y + 0.05, 0.6, tcol, rows[i][0]);
        tx(s, rows[i][1], { x: x + 1.2, y, w: 4.5, h: 0.38, fontSize: 16, bold: true });
        tx(s, rows[i][2], { x: x + 1.2, y: y + 0.4, w: 4.5, h: 0.38, fontSize: 14, color: MUTED });
      }
    }
    s.addNotes("Our users never pay: displaced families, basic-phone owners, volunteers, and the facilities that want to be found. Our customers are the institutions already paying to coordinate emergency response: state and LGA emergency agencies, NGOs and UN agencies, telcos and the Universal Service Provision Fund, and planners and donors who need reliable needs data. (~30 seconds)");
  }

  // ================================================================ 10 BUSINESS MODEL
  {
    const s = content("BUSINESS MODEL", "Free for citizens. Paid for by institutions");
    const cards = [
      ["LuLandmark", "State Command licence", "₦12M / state / yr", "All LGAs, coordinator seats, SLA"],
      ["LuBuilding2", "LGA licence", "₦1.5M / LGA / yr", "Entry product; upgrades to state"],
      ["LuHeartHandshake", "NGO & UN deployments", "₦5M / programme / yr", "White-label camp and WASH workspaces"],
      ["LuGraduationCap", "Setup & training", "₦1–3M one-off", "Onboarding, gazetteer, coordinators"],
      ["LuRadioTower", "Sponsored USSD", "Session cost + margin", "Telcos and USPF keep dialling free"],
      ["LuChartColumn", "Needs-insight reports", "₦2M / yr add-on", "Anonymised demand heatmaps"],
    ];
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * 4.135, y = 1.8 + Math.floor(i / 3) * 2.15;
      box(s, x, y, 3.83, 1.95, i < 3 ? STONE : WHITE, "revenue-" + i, i < 3 ? null : "CFD4D9");
      await tile(s, x + 0.3, y + 0.28, 0.55, i < 3 ? ORANGE : INK, cards[i][0]);
      tx(s, cards[i][1], { x: x + 1.05, y: y + 0.3, w: 2.65, h: 0.5, fontSize: 16, bold: true, valign: "middle" });
      tx(s, cards[i][2], { x: x + 0.3, y: y + 0.95, w: 3.4, h: 0.45, fontSize: 22, bold: true, color: ORANGE });
      tx(s, cards[i][3], { x: x + 0.3, y: y + 1.42, w: 3.4, h: 0.38, fontSize: 13, color: MUTED });
    }
    box(s, 0.6, 6.15, 12.1, 0.55, INK, "unit-economics");
    tx(s, [
      { text: "Unit economics:  ", options: { bold: true, color: ORANGE } },
      { text: "about ₦0.6M a year to serve an LGA, so about 60% gross margin. Recurring, multi-year public-sector contracts.", options: { color: WHITE } },
    ], { x: 0.85, y: 6.15, w: 11.7, h: 0.55, fontSize: 15, valign: "middle" });
    s.addNotes("Citizens always use it free. Institutions pay. The anchor is a state licence at 12 million naira a year, covering every LGA, coordinator seats and a service-level agreement. LGAs can start at 1.5 million and upgrade. NGOs and UN agencies pay per programme, and setup and training are charged once. Telcos and the Universal Service Fund sponsor USSD sessions so dialling stays free, and planners buy anonymised needs reports. Serving an LGA costs about 0.6 million a year, giving roughly 60 percent gross margin on recurring public-sector contracts. These are proposed prices that we will validate in the pilot. (~45 seconds)");
  }

  // ================================================================ 11 MARKET & GROWTH
  {
    const s = content("MARKET AND GROWTH", "A ₦1.6B market with a clear path to break-even");
    s.addShape(pres.shapes.OVAL, { x: 0.6, y: 1.9, w: 4.4, h: 4.4, fill: { color: STONE }, line: { color: "CFD4D9", width: 1 }, objectName: "tam" });
    s.addShape(pres.shapes.OVAL, { x: 1.3, y: 3.3, w: 3.0, h: 3.0, fill: { color: HEX.tint }, line: { type: "none" }, objectName: "sam" });
    s.addShape(pres.shapes.OVAL, { x: 2.0, y: 4.7, w: 1.6, h: 1.6, fill: { color: ORANGE }, line: { type: "none" }, objectName: "som" });
    tx(s, [{ text: "TAM  ₦1.6B / yr", options: { bold: true, breakLine: true, fontSize: 18 } }, { text: "37 SEMAs + 774 LGAs", options: { fontSize: 13, color: MUTED } }],
      { x: 1.4, y: 2.15, w: 2.8, h: 0.8, align: "center" });
    tx(s, [{ text: "SAM  ₦0.6B / yr", options: { bold: true, breakLine: true, fontSize: 16 } }, { text: "Conflict-affected states", options: { fontSize: 13, color: MUTED } }],
      { x: 1.6, y: 3.6, w: 2.4, h: 0.8, align: "center" });
    tx(s, [{ text: "₦80M", options: { bold: true, breakLine: true, fontSize: 18 } }, { text: "Year 3", options: { fontSize: 12 } }],
      { x: 2.05, y: 5.15, w: 1.5, h: 0.7, align: "center", color: WHITE });
    s.addChart(pres.charts.BAR, [{ name: "Revenue target (₦M)", labels: ["Year 1 (2027)", "Year 2 (2028)", "Year 3 (2029)"], values: [6, 28, 80] }], {
      x: 5.6, y: 1.75, w: 7.1, h: 3.95, barDir: "col", chartColors: [HEX.orange],
      showTitle: true, title: "Revenue target, ₦ millions", titleFontSize: 15, titleColor: HEX.ink, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: HEX.ink, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: '"₦"0"M"',
      catAxisLabelColor: HEX.muted, catAxisLabelFontSize: 13, catAxisLabelFontFace: "+mn-lt",
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 70,
    });
    tx(s, [
      { text: "Break-even in Year 3 with 3 states and 5 NGO programmes.", options: { bold: true, breakLine: true } },
      { text: "Then 13 conflict-affected states and ECOWAS neighbours." },
    ], { x: 5.6, y: 5.8, w: 7.1, h: 0.7, fontSize: 14 });
    caption(s, "Market sized from our proposed pricing. Revenue figures are targets, not current sales.", 0.6, 6.6, 12.1);
    s.addNotes("Using our own pricing, government alone is a 1.6 billion naira a year market: 37 emergency agencies and 774 LGAs, before NGOs or neighbouring countries. Our serviceable market, the conflict-affected states, is about 0.6 billion. We target 6 million naira in year one from the pilot and one NGO, 28 million in year two with Benue SEMA, and 80 million in year three across three states, which is break-even. These are targets, not current revenue. (~40 seconds)");
  }

  // ================================================================ 12 IMPACT
  section("Impact and plan");
  {
    const s = content("IMPACT", "Impact we will measure, not just claim");
    const kpis = [["300", "residents reached in the 12-month pilot"], ["100+", "basic-phone users served by USSD"], ["90%", "of reports reviewed within 24 hours"],
      ["30", "locally verified resource records"], ["6", "local coordinators trained and paid"]];
    for (let i = 0; i < 5; i++) {
      const x = 0.6 + i * 2.46;
      box(s, x, 1.8, 2.26, 1.95, STONE, "kpi-" + i);
      tx(s, kpis[i][0], { x: x + 0.2, y: 1.95, w: 1.9, h: 0.75, fontSize: 38, bold: true, color: ORANGE, fontFace: THEME.headFontFace });
      tx(s, kpis[i][1], { x: x + 0.2, y: 2.75, w: 1.9, h: 0.9, fontSize: 14 });
    }
    box(s, 0.6, 4.05, 7.35, 2.6, WHITE, "benefits", "CFD4D9");
    tx(s, "Social and economic benefits", { x: 0.9, y: 4.25, w: 6.8, h: 0.4, fontSize: 18, bold: true });
    const ben = [["LuFootprints", "Fewer wasted, dangerous journeys"], ["LuTarget", "Faster, better-targeted aid"],
      ["LuBriefcase", "Paid local coordinator jobs"], ["LuChartColumn", "Shared needs data for planners"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.9 + (i % 2) * 3.5, y = 4.85 + Math.floor(i / 2) * 0.82;
      await tile(s, x, y, 0.5, SAFE, ben[i][0]);
      tx(s, ben[i][1], { x: x + 0.65, y, w: 2.75, h: 0.5, fontSize: 15, valign: "middle" });
    }
    tx(s, "SDG alignment", { x: 8.3, y: 4.1, w: 4.4, h: 0.4, fontSize: 18, bold: true });
    const sdg = [["SDG 3  Good health", "4C9F38", WHITE], ["SDG 6  Clean water", "26BDE2", INK], ["SDG 11  Resilient communities", "FD9D24", INK], ["SDG 16  Peace & strong institutions", "00689D", WHITE]];
    sdg.forEach(([t, f, c], i) => {
      box(s, 8.3, 4.6 + i * 0.52, 4.4, 0.44, f, "sdg-" + i);
      tx(s, t, { x: 8.45, y: 4.6 + i * 0.52, w: 4.2, h: 0.44, fontSize: 14, bold: true, color: c, valign: "middle" });
    });
    s.addNotes("We will measure impact, not just claim it. In the 12-month pilot we target 300 residents reached, at least 100 of them on basic phones; 90 percent of reports reviewed within 24 hours; 30 verified records; and six trained, paid local coordinators. The benefits are fewer wasted and dangerous journeys, faster aid, local jobs, and better data for planners. This supports SDGs 3, 6, 11 and 16. (~35 seconds)");
  }

  // ================================================================ 13 IMPLEMENTATION
  {
    const s = content("IMPLEMENTATION PLAN", "A 12-month pilot, then statewide and beyond");
    s.addShape(pres.shapes.LINE, { x: 0.9, y: 2.55, w: 11.5, h: 0, line: { color: "CFD4D9", width: 2 }, objectName: "timeline" });
    const ph = [
      ["Months 1–2", "Prepare", "Consult 20 residents and 5 providers; agree telco terms"],
      ["Months 3–4", "Integrate", "Connect live USSD; harden offline sync and security"],
      ["Months 5–6", "Field test", "1 community, 50 users, 2 coordinators trained"],
      ["Months 7–10", "Operate & expand", "3 communities, 300 residents, live USSD"],
      ["Months 11–12", "Evaluate", "Measure reach, freshness and cost; sign state deal"],
    ];
    for (let i = 0; i < 5; i++) {
      const x = 0.6 + i * 2.46;
      tx(s, ph[i][0], { x, y: 1.85, w: 2.3, h: 0.35, fontSize: 14, bold: true, color: ORANGE });
      s.addShape(pres.shapes.OVAL, { x: x + 0.1, y: 2.37, w: 0.36, h: 0.36, fill: { color: i === 2 ? ORANGE : INK }, line: { color: WHITE, width: 2 }, objectName: "node-" + i });
      tx(s, ph[i][1], { x, y: 2.9, w: 2.3, h: 0.4, fontSize: 18, bold: true });
      tx(s, ph[i][2], { x, y: 3.35, w: 2.25, h: 1.1, fontSize: 14, color: MUTED });
    }
    tx(s, "Scale path", { x: 0.6, y: 4.7, w: 6, h: 0.4, fontSize: 19, bold: true });
    const sc = [["LuMapPinned", "Year 2", "Benue statewide: all 23 LGAs via SEMA"], ["LuMap", "Year 3", "3 states and 5 NGO programmes"], ["LuGlobe", "Year 4+", "National rollout and ECOWAS"]];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.135;
      box(s, x, 5.25, 3.7, 1.35, i === 0 ? INK : STONE, "scale-" + i);
      await tile(s, x + 0.25, 5.6, 0.6, i === 0 ? ORANGE : INK, sc[i][0]);
      tx(s, sc[i][1], { x: x + 1.05, y: 5.4, w: 2.5, h: 0.4, fontSize: 17, bold: true, color: i === 0 ? WHITE : INK });
      tx(s, sc[i][2], { x: x + 1.05, y: 5.8, w: 2.5, h: 0.7, fontSize: 14, color: i === 0 ? WHITE : INK });
      if (i < 2) s.addImage({ data: await icon("LuChevronRight", HEX.orange), x: x + 3.76, y: 5.75, w: 0.36, h: 0.36, altText: "next" });
    }
    s.addNotes("The pilot runs for 12 months. We consult residents and providers and agree telco terms, connect the live USSD code, field-test in one community, expand to three communities and 300 residents, then evaluate and sign a state agreement. Year 2 is Benue statewide through SEMA. Year 3 is three states and five NGO programmes. After that comes a national rollout and ECOWAS. (~35 seconds)");
  }

  // ================================================================ 14 BUDGET
  {
    const s = content("BUDGET", "₦8M to prove it in the field");
    const b = [["Equipment & materials", 0.4], ["Testing & evaluation", 0.5], ["Outreach & onboarding", 0.6], ["Operations (12 months)", 1.2],
      ["Product development", 1.6], ["Personnel & support", 1.8], ["USSD & telecom", 1.9]];
    s.addChart(pres.charts.BAR, [{ name: "₦M", labels: b.map((x) => x[0]), values: b.map((x) => x[1]) }], {
      x: 0.5, y: 1.75, w: 6.2, h: 4.9, barDir: "bar", chartColors: [HEX.ink],
      showTitle: true, title: "12-month pilot: ₦8.0M total", titleFontSize: 15, titleColor: HEX.ink, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 13, dataLabelColor: HEX.ink, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: '"₦"0.0"M"',
      catAxisLabelColor: HEX.ink, catAxisLabelFontSize: 13, catAxisLabelFontFace: "+mn-lt",
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 55, valAxisMaxVal: 2.4,
    });
    tx(s, "₦1M prize funds Phase 1 (6 months)", { x: 7.1, y: 1.8, w: 5.6, h: 0.45, fontSize: 19, bold: true });
    const prize = [["Product development (online, offline, USSD)", "₦350,000"], ["Technology & infrastructure (incl. USSD setup)", "₦390,000"],
      ["Initial field implementation", "₦60,000"], ["Outreach", "₦50,000"], ["Equipment & materials", "₦50,000"], ["Operations & logistics", "₦50,000"], ["Monitoring & improvement", "₦50,000"]];
    const rows = prize.map(([a, v]) => [{ text: a, options: { fontSize: 14, color: INK } }, { text: v, options: { fontSize: 14, color: INK, align: "right" } }]);
    rows.push([{ text: "Total", options: { fontSize: 14, bold: true, color: WHITE, fill: { color: HEX.orange } } }, { text: "₦1,000,000", options: { fontSize: 14, bold: true, color: WHITE, align: "right", fill: { color: HEX.orange } } }]);
    s.addTable(rows, { x: 7.1, y: 2.35, w: 5.6, colW: [4.2, 1.4], rowH: 0.4, border: { type: "solid", pt: 0.75, color: "D9DEE3" }, valign: "middle", margin: [0, 0.1, 0, 0.1] });
    box(s, 7.1, 5.85, 5.6, 0.8, STONE, "budget-note");
    tx(s, "The prize counts toward the ₦8M. We are seeking pilot partners for the remaining ₦7M.", { x: 7.3, y: 5.85, w: 5.25, h: 0.8, fontSize: 14, valign: "middle" });
    s.addNotes("The full 12-month pilot costs 8 million naira. The largest items are USSD and telecom, people, and product development. The 1 million naira prize has its own six-month plan: about three-quarters goes to product and infrastructure, including USSD setup, and the rest to the first field test. The prize counts toward the 8 million, leaving 7 million that we are raising from pilot partners. (~35 seconds)");
  }

  // ================================================================ 15 CONCLUSION
  section("Conclusion");
  {
    const s = pres.addSlide({ masterName: "DARK_COVER", sectionTitle: currentSection });
    tx(s, "CONCLUSION", { x: 0.7, y: 0.6, w: 7, h: 0.32, fontSize: 13, bold: true, color: ORANGE, charSpacing: 2 });
    tx(s, "Help, found. On every phone.", { x: 0.7, y: 0.95, w: 7.7, h: 0.9, fontSize: 34, bold: true, color: WHITE, fontFace: THEME.headFontFace });
    const qa = [["Problem", "Displaced families can't find trusted help, especially offline or on basic phones"],
      ["Solution", "One coordinator-verified directory reachable online, offline and by USSD"],
      ["Innovation", "Works with no data and no smartphone; verified, two-way, in English and Pidgin today"],
      ["Real world", "Working prototype today; a costed 12-month pilot ready to start"],
      ["Impact", "300 residents, 100+ basic-phone users, 6 local jobs in year one"]];
    qa.forEach(([k, v], i) => {
      const y = 2.15 + i * 0.86;
      tx(s, k, { x: 0.7, y, w: 1.65, h: 0.7, fontSize: 15, bold: true, color: ORANGE });
      tx(s, v, { x: 2.4, y, w: 5.7, h: 0.75, fontSize: 15, color: WHITE });
    });
    box(s, 8.6, 0.9, 4.1, 5.75, HEX.inkSoft, "ask-panel");
    tx(s, "Our ask", { x: 8.9, y: 1.15, w: 3.6, h: 0.5, fontSize: 24, bold: true, color: WHITE });
    const asks = [["LuTrophy", "₦1M prize: live USSD and a first field test within 6 months"], ["LuHandshake", "Pilot partners for the ₦8M, 12-month pilot"], ["LuLandmark", "Introductions to SEMA Benue, IOM and telcos"]];
    for (let i = 0; i < 3; i++) {
      const y = 1.9 + i * 1.08;
      await tile(s, 8.9, y, 0.55, ORANGE, asks[i][0]);
      tx(s, asks[i][1], { x: 9.6, y: y - 0.05, w: 2.9, h: 0.95, fontSize: 15, color: WHITE });
    }
    tx(s, [{ text: "Abah David · HAQTRI PLC", options: { bold: true, breakLine: true } }, { text: "07041392111", options: { breakLine: true } }, { text: "ofuabah@gmail.com" }],
      { x: 8.9, y: 5.25, w: 3.6, h: 1.1, fontSize: 14, color: WHITE });
    s.addNotes("To close, here are the five questions. The problem: families can't find trusted help. Our solution: one verified directory on every channel. Our innovation: it works with no data and no smartphone. It works in the real world today as a prototype, with a costed pilot. And the impact is measurable: 300 residents, 100 basic-phone users and six local jobs in year one. Our ask is the prize to take USSD live and run our first field test in six months, plus partners and introductions for the full pilot. For Idomaland's next hundred years, no one should be one phone call away from help and still unable to find it. Thank you. (~45 seconds)");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("Wrote " + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
