# -*- coding: utf-8 -*-
"""
Idoma Lifeline - Pitch Deck generator.
Mirrors the product design system: Signal Orange / Ink / Cool Stone,
sharp corners, uppercase mono "data" labels, category colour coding.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.shapes import MSO_CONNECTOR

# ---------------------------------------------------------------- palette
INK        = RGBColor(0x1B, 0x24, 0x30)
INK_SOFT   = RGBColor(0x2A, 0x34, 0x41)   # grid lines on dark
STONE      = RGBColor(0xF1, 0xF2, 0xEE)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
ORANGE     = RGBColor(0xE8, 0x60, 0x0C)
ORANGE_DK  = RGBColor(0xC6, 0x4F, 0x00)
BORDER     = RGBColor(0xCF, 0xCB, 0xC0)
MUTED      = RGBColor(0x56, 0x5F, 0x6D)
CLOUD      = RGBColor(0xE9, 0xE7, 0xDF)   # subtle stone card
WHITE_DIM  = RGBColor(0xB9, 0xC0, 0xCC)   # muted text on dark

WATER   = RGBColor(0x1C, 0x6E, 0x8C)
MEDICAL = RGBColor(0xC4, 0x45, 0x3C)
SAFE    = RGBColor(0x1F, 0x8A, 0x78)
FOOD    = RGBColor(0xC9, 0x9A, 0x2E)
SHELTER = RGBColor(0xA8, 0x5C, 0x32)
GREEN   = RGBColor(0x2E, 0x7D, 0x32)

SANS = "Segoe UI"
SANS_L = "Segoe UI Light"
MONO = "Consolas"

# ---------------------------------------------------------------- geometry
SW, SH = 13.333, 7.5
MX = 0.85
CW = SW - 2 * MX

prs = Presentation()
prs.slide_width = Inches(SW)
prs.slide_height = Inches(SH)
BLANK = prs.slide_layouts[6]

# ---------------------------------------------------------------- helpers
def slide():
    return prs.slides.add_slide(BLANK)

def rect(s, x, y, w, h, fill=None, line=None, line_w=1.0, shadow=False):
    shp = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid(); shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line; shp.line.width = Pt(line_w)
    shp.shadow.inherit = False
    return shp

def bg(s, color):
    rect(s, -0.06, -0.06, SW + 0.12, SH + 0.12, fill=color)

def hline(s, x, y, w, color=BORDER, weight=1.0):
    ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x), Inches(y), Inches(x + w), Inches(y))
    ln.line.color.rgb = color; ln.line.width = Pt(weight)
    ln.shadow.inherit = False
    return ln

def vline(s, x, y, h, color=BORDER, weight=1.0):
    ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x), Inches(y), Inches(x), Inches(y + h))
    ln.line.color.rgb = color; ln.line.width = Pt(weight)
    ln.shadow.inherit = False
    return ln

def _set(run, size, color, bold, name, tracking, italic=False):
    f = run.font
    f.size = Pt(size); f.bold = bold; f.italic = italic
    f.name = name; f.color.rgb = color
    if tracking is not None:
        run._r.get_or_add_rPr().set('spc', str(int(tracking)))

def tbox(s, x, y, w, h, anchor=MSO_ANCHOR.TOP):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in ('margin_left', 'margin_right', 'margin_top', 'margin_bottom'):
        setattr(tf, m, 0)
    return tf

def para(tf, text, size, color, bold=False, name=SANS, align=PP_ALIGN.LEFT,
         before=0, after=0, tracking=None, first=False, line=None, italic=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(before); p.space_after = Pt(after)
    if line is not None:
        p.line_spacing = line
    r = p.add_run(); r.text = text
    _set(r, size, color, bold, name, tracking, italic)
    return p

def kicker_title(s, kicker, title, title_size=31, dark=False, tw=11.4):
    ink = WHITE if dark else INK
    rect(s, MX, 0.62, 0.17, 0.17, fill=ORANGE)
    tf = tbox(s, MX + 0.30, 0.58, 9.5, 0.4)
    para(tf, kicker.upper(), 12.5, ORANGE if not dark else ORANGE, bold=True,
         name=MONO, tracking=110, first=True)
    tf2 = tbox(s, MX, 1.02, tw, 1.15)
    para(tf2, title, title_size, ink, bold=True, name=SANS, first=True, line=1.02)

def footer(s, n, dark=False):
    col = WHITE_DIM if dark else MUTED
    lc = INK_SOFT if dark else BORDER
    hline(s, MX, 6.95, CW, color=lc, weight=1.0)
    tf = tbox(s, MX, 7.03, 8.0, 0.32)
    para(tf, "IDOMA LIFELINE  //  OFFLINE-FIRST CRISIS PLATFORM", 9, col,
         name=MONO, tracking=40, first=True)
    tf2 = tbox(s, SW - MX - 3.0, 7.03, 3.0, 0.32)
    para(tf2, f"{n:02d} / 12", 9, col, name=MONO, align=PP_ALIGN.RIGHT,
         tracking=40, first=True)

def content(kicker, title, n, title_size=31, tw=11.4):
    s = slide(); bg(s, STONE)
    kicker_title(s, kicker, title, title_size=title_size, tw=tw)
    footer(s, n)
    return s

def card(s, x, y, w, h, fill=WHITE, line=BORDER, top_accent=None, accent_h=0.09):
    shp = rect(s, x, y, w, h, fill=fill, line=line, line_w=1.0)
    if top_accent is not None:
        rect(s, x, y, w, accent_h, fill=top_accent)
    return shp

def chip(s, x, y, label, color):
    """small square + mono caps label"""
    rect(s, x, y + 0.02, 0.14, 0.14, fill=color)
    tf = tbox(s, x + 0.24, y - 0.03, 3.2, 0.3)
    para(tf, label.upper(), 10.5, INK, bold=True, name=MONO, tracking=50, first=True)

def grid_motif(s):
    for i in range(1, 15):
        vline(s, i * (SW / 15), 0, SH, color=INK_SOFT, weight=0.5)
    for j in range(1, 9):
        hline(s, 0, j * (SH / 9), SW, color=INK_SOFT, weight=0.5)

def arrow(s, x, y, w=0.42, h=0.42, color=ORANGE):
    a = s.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x), Inches(y), Inches(w), Inches(h))
    a.fill.solid(); a.fill.fore_color.rgb = color
    a.line.fill.background(); a.shadow.inherit = False
    return a

# ================================================================ SLIDE 1 — COVER
s = slide(); bg(s, INK)
grid_motif(s)
# left orange spine
rect(s, 0, 0, 0.28, SH, fill=ORANGE)
# pulse-ring motif (echoes product location marker)
ring = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(9.9), Inches(1.15), Inches(2.6), Inches(2.6))
ring.fill.background(); ring.line.color.rgb = ORANGE; ring.line.width = Pt(1.25); ring.shadow.inherit = False
ring2 = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(10.5), Inches(1.75), Inches(1.4), Inches(1.4))
ring2.fill.background(); ring2.line.color.rgb = RGBColor(0x7c,0x2e,0x00); ring2.line.width = Pt(1.0); ring2.shadow.inherit = False
dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(10.97), Inches(2.22), Inches(0.46), Inches(0.46))
dot.fill.solid(); dot.fill.fore_color.rgb = ORANGE; dot.line.fill.background(); dot.shadow.inherit = False

tf = tbox(s, 1.0, 1.7, 9.0, 0.4)
para(tf, "SECURITY & RESILIENCE  ·  EMERGENCY RESPONSE", 13, ORANGE, bold=True,
     name=MONO, tracking=140, first=True)

tf = tbox(s, 0.95, 2.35, 10.5, 2.4)
para(tf, "Idoma Lifeline", 76, WHITE, bold=True, name=SANS, first=True, line=0.98)
para(tf, "Offline-first emergency mapping and SMS relief that keeps working when the network doesn’t.",
     20, WHITE_DIM, name=SANS, before=14, line=1.12)

hline(s, 1.0, 6.05, 11.2, color=INK_SOFT, weight=1.0)
tf = tbox(s, 1.0, 6.22, 8.5, 0.9)
para(tf, "IDOMA CENTENARY PLUS HACKATHON 2026", 12, WHITE, bold=True, name=MONO, tracking=60, first=True)
para(tf, "Abah David  ·  Otukpo, Benue  ·  Prototype", 12, WHITE_DIM, name=MONO, before=4, tracking=30)
tf = tbox(s, 8.6, 6.22, 3.65, 0.9, anchor=MSO_ANCHOR.TOP)
para(tf, "PITCH DECK", 12, ORANGE, bold=True, name=MONO, align=PP_ALIGN.RIGHT, tracking=80, first=True)
para(tf, "v1.0", 12, WHITE_DIM, name=MONO, align=PP_ALIGN.RIGHT, before=4, tracking=30)

# ================================================================ SLIDE 2 — PROBLEM
s = content("The Problem", "When crisis hits, the tools fail exactly when\nthey’re needed most.", 2, title_size=30)
tf = tbox(s, MX, 2.28, 11.2, 0.8)
para(tf, "Insecurity and displacement across Idomaland cut communities off from relief. Standard emergency apps assume strong internet and smartphones — two things displaced, rural populations rarely have.",
     15.5, MUTED, name=SANS, first=True, line=1.2)

cards = [
    ("DISCONNECTED PEOPLE", "Families fleeing danger have no way to find the nearest shelter, clean water, or medical station.", MEDICAL),
    ("TECH THAT GOES DARK", "Google Crisis Map and NGO apps need constant data. They break the moment connectivity drops — exactly during a crisis.", WATER),
    ("UNCOORDINATED RELIEF", "The result: misinformation about safe routes, duplicated NGO effort, and ultimately, loss of life.", FOOD),
]
cw = (CW - 0.6) / 3
for i, (h, b, c) in enumerate(cards):
    x = MX + i * (cw + 0.3)
    card(s, x, 3.35, cw, 2.35, top_accent=c)
    tf = tbox(s, x + 0.28, 3.68, cw - 0.56, 2.0)
    para(tf, f"0{i+1}", 13, c, bold=True, name=MONO, tracking=40, first=True)
    para(tf, h, 15.5, INK, bold=True, name=SANS, before=6, line=1.05)
    para(tf, b, 13, MUTED, name=SANS, before=8, line=1.18)

rect(s, MX, 6.02, CW, 0.62, fill=INK)
tf = tbox(s, MX + 0.28, 6.02, CW - 0.5, 0.62, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "“Relief coordination stops the instant the network drops.”", 15, WHITE, bold=True, name=SANS, first=True)

# ================================================================ SLIDE 3 — SOLUTION
s = content("The Solution", "One platform that works with or without\nthe internet.", 3, title_size=30)
pillars = [
    ("SMS / USSD GATEWAY", "For basic feature phones", "Text a command — e.g. “NEAR WATER” — and receive the nearest verified safe locations. No data, no smartphone required.", ORANGE),
    ("OFFLINE-FIRST PWA", "For smartphones", "A progressive web app that caches maps and resource data, so people can navigate away from hazard zones even fully offline.", WATER),
    ("COORDINATOR DASHBOARD", "For relief coordinators", "Local coordinators verify every incoming community report before it is broadcast — no fake or dangerous information spreads.", SAFE),
]
cw = (CW - 0.6) / 3
for i, (h, sub, b, c) in enumerate(pillars):
    x = MX + i * (cw + 0.3)
    card(s, x, 2.55, cw, 3.5)
    rect(s, x, 2.55, cw, 0.62, fill=c)
    tf = tbox(s, x + 0.26, 2.68, cw - 0.52, 0.4, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, f"0{i+1}", 15, WHITE, bold=True, name=MONO, first=True)
    tf = tbox(s, x + 0.28, 3.38, cw - 0.56, 2.6)
    para(tf, h, 16, INK, bold=True, name=SANS, first=True, line=1.05)
    para(tf, sub.upper(), 10.5, c, bold=True, name=MONO, tracking=60, before=5)
    para(tf, b, 13.5, MUTED, name=SANS, before=12, line=1.22)

tf = tbox(s, MX, 6.2, CW, 0.5)
para(tf, "Crowdsourced by the community  ·  verified by a coordinator  ·  delivered to any device.",
     13.5, INK, bold=True, name=SANS, align=PP_ALIGN.CENTER, first=True)

# ================================================================ SLIDE 4 — HOW IT WORKS
s = content("How It Works", "Crowdsourced. Verified. Broadcast.", 4)
steps = [
    ("REPORT", "Community sends a resource or hazard report via the PWA or a simple SMS.", ORANGE),
    ("VERIFY", "A local coordinator reviews and approves each report on the dashboard.", WATER),
    ("BROADCAST", "Trusted data is pushed to the offline map and returned via SMS replies.", SAFE),
]
n = len(steps)
gap = 0.55
cw = (CW - (n - 1) * gap) / n
y = 2.75; h = 2.15
for i, (t, b, c) in enumerate(steps):
    x = MX + i * (cw + gap)
    card(s, x, y, cw, h, top_accent=c, accent_h=0.11)
    tf = tbox(s, x + 0.3, y + 0.34, cw - 0.6, h - 0.5)
    para(tf, f"STEP {i+1}", 10.5, c, bold=True, name=MONO, tracking=70, first=True)
    para(tf, t, 22, INK, bold=True, name=SANS, before=6)
    para(tf, b, 13, MUTED, name=SANS, before=10, line=1.2)
    if i < n - 1:
        arrow(s, x + cw + (gap - 0.42) / 2, y + h / 2 - 0.21)

# offline note band
rect(s, MX, 5.45, CW, 1.05, fill=WHITE, line=BORDER)
rect(s, MX, 5.45, 0.14, 1.05, fill=INK)
tf = tbox(s, MX + 0.45, 5.45, CW - 0.9, 1.05, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "WHY IT HOLDS UP UNDER CRISIS", 10.5, ORANGE, bold=True, name=MONO, tracking=70, first=True)
para(tf, "Every verified record is cached on-device and mirrored to the SMS gateway, so both smartphone and feature-phone users stay served even after connectivity collapses.",
     13.5, INK, name=SANS, before=5, line=1.18)

# ================================================================ SLIDE 5 — THE PRODUCT
s = content("The Product", "Built for every device in the field.", 5)
tf = tbox(s, MX, 2.05, 11.4, 0.55)
para(tf, "A working prototype today — map, reporting, verification and hazard-aware routing already run end to end.",
     14.5, MUTED, name=SANS, first=True, line=1.2)

cols = [
    ("FEATURE PHONES", "SMS gateway", ["Command-based queries (NEAR WATER, NEAR CLINIC)", "Nearest verified locations returned as plain text", "Zero data usage — works on any GSM handset"], ORANGE),
    ("SMARTPHONES", "Offline PWA", ["Cached maps + resource data for offline use", "Hazard-aware routing steers around danger", "Report resources with one tap, even offline"], WATER),
    ("COORDINATORS", "Verify dashboard", ["Review, approve or flag incoming reports", "Publish only trusted, verified information", "Manage shelters, medical, food, water & hazards"], SAFE),
]
cw = (CW - 0.6) / 3
for i, (h, sub, items, c) in enumerate(cols):
    x = MX + i * (cw + 0.3)
    card(s, x, 2.75, cw, 3.0, top_accent=c)
    tf = tbox(s, x + 0.28, 3.02, cw - 0.56, 2.6)
    para(tf, h, 15.5, INK, bold=True, name=SANS, first=True)
    para(tf, sub.upper(), 10.5, c, bold=True, name=MONO, tracking=55, before=4)
    for k, it in enumerate(items):
        para(tf, it, 12, MUTED, name=SANS, before=10 if k == 0 else 7, line=1.16)

# resource legend
tf = tbox(s, MX, 5.95, 4.5, 0.3)
para(tf, "MAPPED RESOURCE TYPES", 10, MUTED, bold=True, name=MONO, tracking=60, first=True)
legend = [("Shelter", SHELTER), ("Water", WATER), ("Medical", MEDICAL), ("Food", FOOD), ("Safe zone", SAFE), ("Hazard", MEDICAL)]
lx = MX
for name, c in legend:
    chip(s, lx, 6.32, name, c)
    lx += 1.72

# ================================================================ SLIDE 6 — DIFFERENTIATOR
s = content("Why It’s Different", "Competitors go dark when the network does.\nWe don’t.", 6, title_size=30)
colw = (CW - 0.5) / 2
# them
card(s, MX, 2.75, colw, 3.05, fill=WHITE, line=BORDER)
rect(s, MX, 2.75, colw, 0.6, fill=RGBColor(0x9a,0xa1,0xac))
tf = tbox(s, MX + 0.3, 2.75, colw - 0.6, 0.6, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "STANDARD EMERGENCY SOFTWARE", 12.5, WHITE, bold=True, name=MONO, tracking=40, first=True)
tf = tbox(s, MX + 0.3, 3.6, colw - 0.6, 2.1)
for k, t in enumerate(["Google Crisis Map, traditional NGO apps",
                       "Require strong internet + smartphones",
                       "Useless the moment connectivity drops",
                       "Data-heavy and expensive to run at the edge"]):
    para(tf, "—  " + t, 14, MUTED, name=SANS, first=(k==0), before=0 if k==0 else 10, line=1.15)
# us
x2 = MX + colw + 0.5
card(s, x2, 2.75, colw, 3.05, fill=WHITE, line=ORANGE)
rect(s, x2, 2.75, colw, 0.6, fill=ORANGE)
tf = tbox(s, x2 + 0.3, 2.75, colw - 0.6, 0.6, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "IDOMA LIFELINE", 12.5, WHITE, bold=True, name=MONO, tracking=40, first=True)
tf = tbox(s, x2 + 0.3, 3.6, colw - 0.6, 2.1)
for k, t in enumerate(["Purpose-built for low-tech, low-bandwidth",
                       "SMS fallback reaches any feature phone",
                       "Offline caching keeps the map alive in dead zones",
                       "Relief coordination never stops"]):
    para(tf, "✓  " + t, 14, INK, bold=True, name=SANS, first=(k==0), before=0 if k==0 else 10, line=1.15)

rect(s, MX, 6.0, CW, 0.62, fill=INK)
tf = tbox(s, MX + 0.28, 6.0, CW - 0.5, 0.62, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "Our SMS + offline-caching core makes data-heavy competitor platforms irrelevant in real crisis zones.",
     14, WHITE, bold=True, name=SANS, first=True)

# ================================================================ SLIDE 7 — MARKET
s = content("Market Opportunity", "A clear buyer with an urgent, funded need.", 7)
tf = tbox(s, MX, 2.1, 11.4, 0.5)
para(tf, "Agencies and NGOs already spend millions annually on crisis logistics software. We localise it for low-connectivity zones.",
     14.5, MUTED, name=SANS, first=True, line=1.2)

segs = [
    ("GOVERNMENT (B2G)", "State Emergency Management Agencies (SEMA) and local government councils responsible for disaster response.", ORANGE),
    ("INTERNATIONAL NGOs (B2B)", "Red Cross, UNHCR and UNICEF running displacement and relief operations on the ground.", WATER),
    ("GRANT ECOSYSTEM", "USAID, the Gates Foundation and the UNICEF Innovation Fund — actively funding tech that closes the digital divide.", SAFE),
]
cw = (CW - 0.6) / 3
for i, (h, b, c) in enumerate(segs):
    x = MX + i * (cw + 0.3)
    card(s, x, 2.8, cw, 2.5, top_accent=c)
    tf = tbox(s, x + 0.28, 3.1, cw - 0.56, 2.1)
    para(tf, h, 15, INK, bold=True, name=SANS, first=True, line=1.05)
    para(tf, b, 13, MUTED, name=SANS, before=10, line=1.2)

rect(s, MX, 5.55, CW, 1.05, fill=WHITE, line=BORDER)
rect(s, MX, 5.55, 0.14, 1.05, fill=ORANGE)
tf = tbox(s, MX + 0.45, 5.55, CW - 0.9, 1.05, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "THE WEDGE", 10.5, ORANGE, bold=True, name=MONO, tracking=70, first=True)
para(tf, "Land a licensing pilot with SEMA and local councils in Idomaland — then white-label the platform for the next crisis zone.",
     14, INK, name=SANS, before=5, line=1.18)

# ================================================================ SLIDE 8 — FINANCIAL VALUE
s = content("Financial Value", "Three revenue streams, one product.", 8)
rows = [
    ("SOFTWARE LICENSING", "White-labelled SaaS for localised crises — B2G & B2B.", "₦20M – ₦150M+", "per organisation / year", ORANGE),
    ("GRANT CAPITAL", "Equity-free Tech-for-Good grants for pilot programs.", "$50K – $250K", "per pilot (non-dilutive)", SAFE),
    ("NGO COST SAVINGS", "Automated SMS dispatch replaces manual call-centre routing and on-ground scouting — an easy ROI to justify.", "OPEX ↓", "clear return on investment", WATER),
]
y = 2.6; rh = 1.28; gap = 0.2
for i, (h, b, big, small, c) in enumerate(rows):
    yy = y + i * (rh + gap)
    card(s, MX, yy, CW, rh, fill=WHITE, line=BORDER)
    rect(s, MX, yy, 0.14, rh, fill=c)
    tf = tbox(s, MX + 0.45, yy, 6.9, rh, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, h, 15.5, INK, bold=True, name=SANS, first=True)
    para(tf, b, 12.5, MUTED, name=SANS, before=4, line=1.15)
    vline(s, MX + 7.7, yy + 0.22, rh - 0.44, color=BORDER, weight=1.0)
    tf = tbox(s, MX + 7.95, yy, CW - 8.1, rh, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, big, 24, c, bold=True, name=SANS, first=True)
    para(tf, small.upper(), 9.5, MUTED, bold=True, name=MONO, tracking=40, before=3)

# ================================================================ SLIDE 9 — TRACTION / ROADMAP
s = content("Status & Traction", "Working prototype today. MVP and live pilot next.", 9)
# stage tracker
stages = ["IDEA", "PROTOTYPE", "MVP", "SEMA PILOT", "LICENSING"]
current = 1
n = len(stages); gap = 0.28
cw = (CW - (n - 1) * gap) / n
y = 2.35
for i, st in enumerate(stages):
    x = MX + i * (cw + gap)
    done = i <= current
    fill = ORANGE if i == current else (INK if i < current else WHITE)
    line = ORANGE if i == current else BORDER
    txt = WHITE if done else MUTED
    card(s, x, y, cw, 0.72, fill=fill, line=line)
    tf = tbox(s, x, y, cw, 0.72, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, st, 12, txt, bold=True, name=MONO, tracking=30, align=PP_ALIGN.CENTER, first=True)
tf = tbox(s, MX, 3.18, CW, 0.3)
para(tf, "▲ WE ARE HERE", 10, ORANGE, bold=True, name=MONO, tracking=60, first=True)

# built vs next
colw = (CW - 0.5) / 2
card(s, MX, 3.7, colw, 2.75, top_accent=SAFE)
tf = tbox(s, MX + 0.3, 4.0, colw - 0.6, 2.4)
para(tf, "ALREADY BUILT", 12, SAFE, bold=True, name=MONO, tracking=60, first=True)
for k, t in enumerate(["Offline-first PWA with cached, interactive map",
                       "Community reporting for resources & hazards",
                       "Coordinator dashboard to verify reports",
                       "Hazard-aware routing that avoids danger zones"]):
    para(tf, "✓  " + t, 13, INK, name=SANS, before=12 if k == 0 else 8, line=1.15)

x2 = MX + colw + 0.5
card(s, x2, 3.7, colw, 2.75, top_accent=ORANGE)
tf = tbox(s, x2 + 0.3, 4.0, colw - 0.6, 2.4)
para(tf, "NEXT WITH FUNDING", 12, ORANGE, bold=True, name=MONO, tracking=60, first=True)
for k, t in enumerate(["Live SMS/USSD gateway on a dedicated shortcode",
                       "Government-grade, secure hosting & compliance",
                       "Field-hardened MVP for real displacement zones",
                       "Live pilot with SEMA and local councils"]):
    para(tf, "→  " + t, 13, INK, name=SANS, before=12 if k == 0 else 8, line=1.15)

# ================================================================ SLIDE 10 — USE OF FUNDS
s = content("Use of Funds", "Finalise the MVP and land the first\ngovernment pilot.", 10, title_size=30)
funds = [
    (40, "ENTERPRISE INFRASTRUCTURE & SECURITY", "Government-grade servers and database hosting for sensitive geolocation data — meeting public-sector compliance.", ORANGE),
    (40, "SMS / USSD GATEWAY LICENSING", "Africa’s Talking API credits + a dedicated emergency shortcode. The SMS fallback is our primary selling point to government.", WATER),
    (20, "GOVERNMENT PILOT DEPLOYMENT", "Presenting the live prototype to stakeholders and running a secure sandbox for them to test the admin dashboard.", SAFE),
]
y = 2.75; rh = 1.15; gap = 0.22
barx = MX + 8.15; barw = CW - 8.15
for i, (pct, h, b, c) in enumerate(funds):
    yy = y + i * (rh + gap)
    card(s, MX, yy, CW, rh, fill=WHITE, line=BORDER)
    rect(s, MX, yy, 0.14, rh, fill=c)
    tf = tbox(s, MX + 0.45, yy, 7.4, rh, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, h, 14, INK, bold=True, name=SANS, first=True)
    para(tf, b, 12, MUTED, name=SANS, before=4, line=1.15)
    # pct bar
    tf = tbox(s, barx, yy + 0.16, barw, 0.4)
    para(tf, f"{pct}%", 26, c, bold=True, name=SANS, align=PP_ALIGN.RIGHT, first=True)
    rect(s, barx, yy + rh - 0.34, barw, 0.16, fill=CLOUD)
    rect(s, barx, yy + rh - 0.34, barw * pct / 100.0, 0.16, fill=c)

# ================================================================ SLIDE 11 — THE ASK
s = content("The Ask", "Partner with us to keep relief online when\nthe network isn’t.", 11, title_size=30)
colw = (CW - 0.5) / 2
card(s, MX, 2.85, colw, 2.05, top_accent=ORANGE)
tf = tbox(s, MX + 0.32, 3.15, colw - 0.64, 1.6)
para(tf, "OPEN TO", 11, ORANGE, bold=True, name=MONO, tracking=70, first=True)
para(tf, "Angel Investment", 22, INK, bold=True, name=SANS, before=8)
para(tf, "+  Government Partnerships", 16, INK, name=SANS, before=4)
para(tf, "Non-dilutive grants also welcome to accelerate the pilot.", 12.5, MUTED, name=SANS, before=8, line=1.15)

x2 = MX + colw + 0.5
card(s, x2, 2.85, colw, 2.05, top_accent=WATER)
tf = tbox(s, x2 + 0.32, 3.15, colw - 0.64, 1.6)
para(tf, "THE GOAL", 11, WATER, bold=True, name=MONO, tracking=70, first=True)
para(tf, "A live pilot → licensing contract", 19, INK, bold=True, name=SANS, before=8, line=1.05)
para(tf, "with SEMA and local government councils in Idomaland, proving the SMS fallback in real low-network areas.",
     13, MUTED, name=SANS, before=8, line=1.18)

rect(s, MX, 5.15, CW, 1.4, fill=INK)
tf = tbox(s, MX + 0.5, 5.15, CW - 1.0, 1.4, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "WHY NOW", 11, ORANGE, bold=True, name=MONO, tracking=80, first=True)
para(tf, "The displacement crisis in Idomaland is active today. Every week without offline coordination costs lives — and the buyers already have the budget.",
     16, WHITE, bold=True, name=SANS, before=7, line=1.2)

# ================================================================ SLIDE 12 — CLOSING
s = slide(); bg(s, INK)
grid_motif(s)
rect(s, 0, 0, 0.28, SH, fill=ORANGE)
tf = tbox(s, 1.0, 1.55, 11.0, 0.4)
para(tf, "THANK YOU", 13, ORANGE, bold=True, name=MONO, tracking=160, first=True)
tf = tbox(s, 0.95, 2.1, 11.3, 2.2)
para(tf, "Idoma Lifeline", 66, WHITE, bold=True, name=SANS, first=True, line=0.98)
para(tf, "Life-saving information reaches the most vulnerable — regardless of device or network status.",
     19, WHITE_DIM, name=SANS, before=14, line=1.15)

hline(s, 1.0, 5.35, 11.2, color=INK_SOFT, weight=1.0)
contacts = [
    ("PRESENTER", "Abah David"),
    ("EMAIL", "ofuabah@gmail.com"),
    ("PHONE", "07041392111"),
    ("BASE", "Leef Centre, Otukpo, Benue"),
]
cw = 11.2 / 4
for i, (k, v) in enumerate(contacts):
    x = 1.0 + i * cw
    tf = tbox(s, x, 5.6, cw - 0.2, 1.0)
    para(tf, k, 10, ORANGE, bold=True, name=MONO, tracking=80, first=True)
    para(tf, v, 14, WHITE, bold=True, name=SANS, before=6, line=1.1)

# ---------------------------------------------------------------- save
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Idoma_Lifeline_Pitch_Deck.pptx")
prs.save(out)
print("Saved:", out)
print("Slides:", len(prs.slides._sldIdLst))
