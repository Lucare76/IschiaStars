from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.utils import simpleSplit
import os

# ---------------------------------------------------------------------------
# PALETTE
# ---------------------------------------------------------------------------
BLU      = (0.106, 0.227, 0.361)   # #1B3A5C
ORO      = (0.788, 0.659, 0.298)   # #C9A84C
BIANCO   = (1, 1, 1)
GRIGIO   = (0.953, 0.957, 0.965)   # #F3F4F6
GRIGIO_T = (0.6, 0.6, 0.6)
BLU2     = (0.145, 0.388, 0.922)   # #2563EB
VIOLA    = (0.486, 0.227, 0.929)   # #7C3AED
AMBRA    = (0.851, 0.467, 0.024)   # #D97706
ROSSO    = (0.863, 0.149, 0.149)   # #DC2626
VERDE    = (0.086, 0.639, 0.290)   # #16A34A
ORO_BG   = (0.984, 0.961, 0.902)   # #FBF5E6
BLU_BG   = (0.867, 0.906, 0.980)   # light blue intro
GRIGIO_S = (0.898, 0.910, 0.922)   # shadow #E5E7EB
VERDE_BG = (0.941, 0.992, 0.957)   # #F0FDF4

W, H = A4
MAR = 18 * mm
CW  = W - 2 * MAR   # content width

HEADER_H = 28 * mm
FOOTER_H = 12 * mm
CONTENT_TOP = H - HEADER_H - 4 * mm


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def rgb(c):
    return c[0], c[1], c[2]


def set_fill(c_obj, col):
    c_obj.setFillColorRGB(*col)


def set_stroke(c_obj, col):
    c_obj.setStrokeColorRGB(*col)


def rounded_rect(c_obj, x, y, w, h, r=3*mm, fill=True, stroke=True):
    c_obj.roundRect(x, y, w, h, r, fill=1 if fill else 0, stroke=1 if stroke else 0)


def shadow_card(c_obj, x, y, w, h, r=3*mm):
    """Draw a light shadow then the white card."""
    set_fill(c_obj, GRIGIO_S)
    set_stroke(c_obj, GRIGIO_S)
    c_obj.setLineWidth(0)
    rounded_rect(c_obj, x + 0.7*mm, y - 0.7*mm, w, h, r)
    set_fill(c_obj, BIANCO)
    set_stroke(c_obj, GRIGIO_S)
    c_obj.setLineWidth(0.3)
    rounded_rect(c_obj, x, y, w, h, r)


def text_line(c_obj, txt, x, y, font="Helvetica", size=9, col=None):
    if col:
        set_fill(c_obj, col)
    c_obj.setFont(font, size)
    c_obj.drawString(x, y, txt)


def text_right(c_obj, txt, x, y, font="Helvetica", size=9, col=None):
    if col:
        set_fill(c_obj, col)
    c_obj.setFont(font, size)
    c_obj.drawRightString(x, y, txt)


def wrap_text(c_obj, txt, x, y, max_w, font="Helvetica", size=8.5, col=None, line_h=None):
    if line_h is None:
        line_h = size * 1.35
    if col:
        set_fill(c_obj, col)
    c_obj.setFont(font, size)
    lines = simpleSplit(txt, font, size, max_w)
    for line in lines:
        c_obj.drawString(x, y, line)
        y -= line_h
    return y


def small_badge(c_obj, label, x, y, bg_col, text_col=BIANCO, font_size=6.5):
    w = stringWidth(label, "Helvetica-Bold", font_size) + 5*mm
    h = 4.5*mm
    set_fill(c_obj, bg_col)
    set_stroke(c_obj, bg_col)
    c_obj.setLineWidth(0)
    c_obj.roundRect(x, y, w, h, 1.5*mm, fill=1, stroke=0)
    set_fill(c_obj, text_col)
    c_obj.setFont("Helvetica-Bold", font_size)
    c_obj.drawString(x + 2.5*mm, y + 1.3*mm, label)
    return w


def impact_text(c_obj, label, x, y):
    set_fill(c_obj, VERDE)
    c_obj.setFont("Helvetica-Bold", 7)
    c_obj.drawRightString(x, y, label)


# ---------------------------------------------------------------------------
# HEADER / FOOTER
# ---------------------------------------------------------------------------
LOGO_PATHS = [
    "./assets/logo.png", "./logo.png",
    "./assets/logo.jpg", "./logo.jpg",
    "assets/logo.png", "logo.png",
]

def _load_logo():
    for p in LOGO_PATHS:
        if os.path.exists(p):
            try:
                img = ImageReader(p)
                return img, p
            except Exception:
                continue
    return None, None


_logo_cache = None
_logo_loaded = False


def get_logo():
    global _logo_cache, _logo_loaded
    if not _logo_loaded:
        _logo_cache, _ = _load_logo()
        _logo_loaded = True
    return _logo_cache


def draw_header(c_obj, page_num):
    # Background
    set_fill(c_obj, BLU)
    c_obj.rect(0, H - HEADER_H, W, HEADER_H, fill=1, stroke=0)
    # Gold line
    set_fill(c_obj, ORO)
    c_obj.rect(0, H - HEADER_H, W, 1.5*mm, fill=1, stroke=0)

    logo = get_logo()
    logo_x = MAR
    logo_y = H - HEADER_H + 5*mm
    max_logo_w = 45*mm
    max_logo_h = 18*mm

    if logo:
        try:
            iw, ih = logo.getSize()
            ratio = min(max_logo_w / iw, max_logo_h / ih)
            dw, dh = iw * ratio, ih * ratio
            c_obj.drawImage(logo, logo_x, logo_y, width=dw, height=dh,
                            preserveAspectRatio=True, mask='auto')
        except Exception:
            logo = None

    if not logo:
        set_fill(c_obj, BIANCO)
        c_obj.setFont("Helvetica-Bold", 19)
        c_obj.drawString(logo_x, H - HEADER_H + 9*mm, "IschiaStars")

    # Right label
    set_fill(c_obj, (0.85, 0.85, 0.85))
    c_obj.setFont("Helvetica", 8)
    c_obj.drawRightString(W - MAR, H - HEADER_H + 11*mm, "Per Diego  -  Giugno 2025")


def draw_footer(c_obj, page_num):
    set_fill(c_obj, GRIGIO)
    c_obj.rect(0, 0, W, FOOTER_H, fill=1, stroke=0)
    set_stroke(c_obj, ORO)
    c_obj.setLineWidth(1.0)
    c_obj.line(0, FOOTER_H, W, FOOTER_H)

    set_fill(c_obj, (0.4, 0.4, 0.4))
    c_obj.setFont("Helvetica", 8)
    c_obj.drawString(MAR, 4*mm, "IschiaStars  -  Sistema Preventivi Premium")
    c_obj.drawRightString(W - MAR, 4*mm, f"Pagina {page_num} di 3")


# ---------------------------------------------------------------------------
# SECTION TITLE
# ---------------------------------------------------------------------------
def section_title(c_obj, title, subtitle, y):
    bar_w = 4*mm
    bar_h = 7*mm
    set_fill(c_obj, ORO)
    c_obj.rect(MAR, y - bar_h + 3*mm, bar_w, bar_h, fill=1, stroke=0)
    set_fill(c_obj, BLU)
    c_obj.setFont("Helvetica-Bold", 14)
    c_obj.drawString(MAR + bar_w + 3*mm, y, title)
    set_fill(c_obj, GRIGIO_T)
    c_obj.setFont("Helvetica-Oblique", 9)
    c_obj.drawString(MAR + bar_w + 3*mm, y - 5.5*mm, subtitle)
    return y - 5.5*mm - 4*mm


# ---------------------------------------------------------------------------
# PAGE 1
# ---------------------------------------------------------------------------
CARD_DEFS = [
    {
        "num": "01",
        "title": "Badge Proposta Consigliata",
        "desc": (
            "Nel backoffice puoi assegnare un badge a ogni hotel del preventivo: "
            "Consigliato, Miglior prezzo, Piu' richiesto, Premium, Ideale per famiglie. "
            "Il cliente vede subito quale scegliere e si fida di piu'."
        ),
        "badge": "BACKOFFICE",
        "badge_col": BLU,
        "impact": "+ fiducia del cliente",
    },
    {
        "num": "02",
        "title": "Campo 'Perche' te lo proponiamo'",
        "desc": (
            "Un breve testo che scrivi tu per spiegare al cliente perche' hai scelto quella struttura. "
            "Esempio: struttura centrale, ottimo rapporto qualita'/prezzo, trattamento termale incluso. "
            "Ti trasforma da operatore a consulente."
        ),
        "badge": "BACKOFFICE",
        "badge_col": BLU,
        "impact": "+ valore percepito",
    },
    {
        "num": "03",
        "title": "Box 'Cosa include' per ogni trattamento",
        "desc": (
            "Ogni trattamento (BB, HB, FB) ha un pannello espanso con cosa e' incluso, "
            "cosa e' escluso, note e policy. Il cliente non deve fare domande: "
            "trova tutto nel preventivo."
        ),
        "badge": "PREVENTIVO",
        "badge_col": VIOLA,
        "impact": "- domande ricevute",
    },
    {
        "num": "04",
        "title": "Differenza tra trattamenti",
        "desc": (
            "Accanto al prezzo di ogni trattamento mostri il delta rispetto al precedente, "
            "con il beneficio concreto. Esempio: +200 EUR per Mezza Pensione = cena inclusa ogni sera. "
            "Il cliente capisce il valore dell'upgrade."
        ),
        "badge": "PREVENTIVO",
        "badge_col": VIOLA,
        "impact": "+ upgrade spontaneo",
    },
    {
        "num": "05",
        "title": "CTA e pagina di conferma rassicurante",
        "desc": (
            "Sotto il bottone di conferma compare: 'Nessun pagamento online - ti ricontattiamo per finalizzare.' "
            "Dopo la conferma il cliente vede una pagina grazie con bottone WhatsApp diretto. "
            "Riduce il blocco psicologico e aumenta il tasso di click."
        ),
        "badge": "PREVENTIVO",
        "badge_col": VIOLA,
        "impact": "+ tasso di conferma",
    },
]


def draw_page1(c_obj):
    draw_header(c_obj, 1)
    draw_footer(c_obj, 1)

    y = CONTENT_TOP

    # --- Intro box ---
    box_h = 16*mm
    set_fill(c_obj, ORO_BG)
    set_stroke(c_obj, ORO)
    c_obj.setLineWidth(1.2)
    rounded_rect(c_obj, MAR, y - box_h, CW, box_h, r=2.5*mm)
    set_fill(c_obj, (0.35, 0.25, 0.0))
    c_obj.setFont("Helvetica", 9)
    c_obj.drawString(MAR + 4*mm, y - 5.5*mm,
                     "Ciao Diego, ho preparato un aggiornamento per il tuo gestionale.")
    c_obj.drawString(MAR + 4*mm, y - 10.5*mm,
                     "Queste 5 nuove funzionalita' sono pensate per aiutarti a convertire piu' preventivi in prenotazioni.")
    y -= box_h + 6*mm

    # --- Section title ---
    y = section_title(c_obj,
                      "Il Pacchetto Conversione",
                      "5 funzionalita' per trasformare i preventivi in prenotazioni",
                      y)
    y -= 3*mm

    # --- Cards ---
    card_h = 24*mm
    gap = 4*mm

    for card in CARD_DEFS:
        # shadow + white bg
        shadow_card(c_obj, MAR, y - card_h, CW, card_h, r=3*mm)

        # Gold left accent bar
        set_fill(c_obj, ORO)
        c_obj.rect(MAR, y - card_h + 1.5*mm, 3.5*mm, card_h - 3*mm, fill=1, stroke=0)

        inner_x = MAR + 6.5*mm
        inner_w = CW - 6.5*mm - 2*mm

        # Number
        c_obj.setFont("Helvetica-Bold", 12)
        set_fill(c_obj, ORO)
        c_obj.drawString(inner_x, y - 6.5*mm, card["num"])
        num_w = stringWidth(card["num"], "Helvetica-Bold", 12) + 3*mm

        # Badge top-right
        badge_x = MAR + CW - 2*mm
        badge_w = stringWidth(card["badge"], "Helvetica-Bold", 6.5) + 5*mm
        bx = badge_x - badge_w
        small_badge(c_obj, card["badge"], bx, y - 6*mm, card["badge_col"])

        # Title
        title_max_w = CW - num_w - badge_w - 8*mm
        set_fill(c_obj, BLU)
        c_obj.setFont("Helvetica-Bold", 10.5)
        c_obj.drawString(inner_x + num_w, y - 6.5*mm, card["title"])

        # Description
        desc_y = y - 12.5*mm
        wrap_text(c_obj, card["desc"],
                  inner_x + num_w, desc_y,
                  inner_w - num_w - badge_w - 2*mm,
                  font="Helvetica", size=8, col=(0.25, 0.25, 0.25), line_h=4.2*mm)

        # Impact bottom-right
        impact_col = VERDE if card["impact"].startswith("+") else ROSSO
        set_fill(c_obj, impact_col)
        c_obj.setFont("Helvetica-Bold", 7.5)
        c_obj.drawRightString(MAR + CW - 3*mm, y - card_h + 3.5*mm, card["impact"])

        y -= card_h + gap

    c_obj.showPage()


# ---------------------------------------------------------------------------
# PAGE 2
# ---------------------------------------------------------------------------
STATI = [
    (">", "Preventivo inviato",       "Nessuna azione necessaria",             GRIGIO_T,  (0.85,0.85,0.85)),
    ("O", "Aperto",                   "Il cliente ha visto il preventivo",     BLU2,      BLU2),
    ("*", "Aperto 3+ volte",          "Cliente interessato - valuta un follow-up", AMBRA, AMBRA),
    ("O", "Ha cliccato sull'hotel",   "Interesse specifico - segnalalo",       VIOLA,     VIOLA),
    ("!", "Non aperto dopo 24 ore",   "Reinvia il link o scrivilo su WhatsApp", ROSSO,    ROSSO),
    ("v", "Confermato",               "Ricontattalo per finalizzare la prenotazione", VERDE, VERDE),
]

MOCK_ROWS = [
    ("*", "Cliente caldo",  "Rossi Mario - Aperto 4 volte, ha cliccato Hotel Regina Palace - seguilo oggi", ORO_BG, AMBRA),
    ("!", "Follow-up",      "Bianchi Anna - Non ha aperto il preventivo da 26 ore - reinvia il link",       (1,0.93,0.93), ROSSO),
    ("v", "Confermato",     "Verdi Luigi - Ha scelto Hotel Continental, Mezza Pensione",                    (0.93,1,0.95), VERDE),
]


def draw_page2(c_obj):
    draw_header(c_obj, 2)
    draw_footer(c_obj, 2)

    y = CONTENT_TOP

    # Section title
    y = section_title(c_obj,
                      "Tracking Avanzato nel Backoffice",
                      "Sai sempre chi seguire - e quando farlo",
                      y)
    y -= 2*mm

    # Intro box
    intro_h = 14*mm
    set_fill(c_obj, BLU_BG)
    set_stroke(c_obj, BLU2)
    c_obj.setLineWidth(0.8)
    rounded_rect(c_obj, MAR, y - intro_h, CW, intro_h, r=2.5*mm)
    set_fill(c_obj, BLU)
    c_obj.setFont("Helvetica", 8.5)
    intro = (
        "Il gestionale tiene traccia di ogni azione del cliente sul preventivo e ti mostra chi ha bisogno di un follow-up. "
        "Non devi piu' indovinare: vedi direttamente chi e' interessato e chi non ha ancora aperto."
    )
    wrap_text(c_obj, intro, MAR + 4*mm, y - 5*mm, CW - 8*mm,
              font="Helvetica", size=8.5, col=BLU, line_h=4.5*mm)
    y -= intro_h + 5*mm

    # State cards with dotted connector
    card_h = 14*mm
    gap = 3*mm
    dot_x = MAR + 5*mm
    icon_r = 4*mm

    for i, (icon, label, action, text_col, circle_col) in enumerate(STATI):
        cx = dot_x
        cy = y - card_h / 2

        # Shadow + card
        shadow_card(c_obj, MAR, y - card_h, CW, card_h, r=2.5*mm)

        # Colored circle
        set_fill(c_obj, circle_col)
        c_obj.circle(cx, cy, icon_r, fill=1, stroke=0)
        set_fill(c_obj, BIANCO)
        c_obj.setFont("Helvetica-Bold", 9)
        iw = stringWidth(icon, "Helvetica-Bold", 9)
        c_obj.drawString(cx - iw / 2, cy - 3, icon)

        # Dotted line above (not on first)
        if i > 0:
            set_stroke(c_obj, (0.75, 0.75, 0.75))
            c_obj.setLineWidth(0.8)
            c_obj.setDash(2, 3)
            c_obj.line(cx, y, cx, y + gap)
            c_obj.setDash()

        # Text
        tx = MAR + 12.5*mm
        set_fill(c_obj, BLU)
        c_obj.setFont("Helvetica-Bold", 9)
        c_obj.drawString(tx, y - 5.5*mm, label)
        set_fill(c_obj, text_col)
        c_obj.setFont("Helvetica", 8)
        c_obj.drawString(tx, y - 10.5*mm, action)

        y -= card_h + gap

    y -= 3*mm

    # Mock backoffice
    mock_h = FOOTER_H + 3*mm + len(MOCK_ROWS) * 11*mm + 10*mm
    shadow_card(c_obj, MAR, y - mock_h, CW, mock_h, r=3*mm)

    # Header
    set_fill(c_obj, GRIGIO)
    c_obj.roundRect(MAR, y - 9*mm, CW, 9*mm, 2.5*mm, fill=1, stroke=0)
    set_fill(c_obj, BLU)
    c_obj.setFont("Helvetica-Bold", 8)
    c_obj.drawString(MAR + 4*mm, y - 6*mm,
                     "BACKOFFICE  -  Sezione 'Azioni consigliate' (esempio)")

    row_y = y - 9*mm - 1*mm
    row_h = 10.5*mm

    for icon, tipo, desc, bg, col in MOCK_ROWS:
        set_fill(c_obj, bg)
        c_obj.rect(MAR + 1*mm, row_y - row_h, CW - 2*mm, row_h, fill=1, stroke=0)
        set_fill(c_obj, col)
        c_obj.setFont("Helvetica-Bold", 8.5)
        c_obj.drawString(MAR + 3*mm, row_y - 4.5*mm, f"{icon}  {tipo}")
        set_fill(c_obj, (0.2, 0.2, 0.2))
        c_obj.setFont("Helvetica", 7.5)
        c_obj.drawString(MAR + 3*mm, row_y - 9*mm, desc)
        row_y -= row_h + 0.8*mm

    c_obj.showPage()


# ---------------------------------------------------------------------------
# PAGE 3
# ---------------------------------------------------------------------------
BEFORE_AFTER = [
    ("Tre hotel con i prezzi",             "Badge Consigliato / Premium / Famiglia"),
    ("Nessuna indicazione consigliata",    "Campo 'Perche' te lo proponiamo'"),
    ("Trattamento: solo il prezzo",        "Cosa include + cosa e' escluso"),
    ("Bottone di conferma generico",       "CTA con testo rassicurante"),
    ("Nessun tracking sull'apertura",      "Tracking: aperto, clic hotel, cliente caldo"),
    ("Pagina conferma basica",             "Pagina grazie + bottone WhatsApp"),
]

FEEDBACK_QS = [
    "Quali funzionalita' ti sembrano piu' utili?",
    "C'e' qualcosa che cambieresti o che manca?",
    "Come vorresti vedere i badge nel preventivo?",
    "Il tracking nel backoffice ti sarebbe utile ogni giorno?",
]


def draw_page3(c_obj):
    draw_header(c_obj, 3)
    draw_footer(c_obj, 3)

    y = CONTENT_TOP

    # Section title
    y = section_title(c_obj,
                      "Prima e Dopo l'Aggiornamento",
                      "Come cambia l'esperienza del cliente sul preventivo",
                      y)
    y -= 3*mm

    # Two columns
    col_gap = 7*mm
    col_w = (CW - col_gap) / 2
    col_before_x = MAR
    col_after_x  = MAR + col_w + col_gap

    n_rows = len(BEFORE_AFTER)
    row_h  = 9*mm
    hdr_h  = 9*mm
    table_h = hdr_h + n_rows * row_h

    # Before header
    set_fill(c_obj, GRIGIO_S)
    c_obj.roundRect(col_before_x, y - hdr_h, col_w, hdr_h, 2*mm, fill=1, stroke=0)
    set_fill(c_obj, (0.35, 0.35, 0.35))
    c_obj.setFont("Helvetica-Bold", 10)
    c_obj.drawString(col_before_x + 4*mm, y - 6*mm, "Prima")

    # After header
    set_fill(c_obj, BLU)
    c_obj.roundRect(col_after_x, y - hdr_h, col_w, hdr_h, 2*mm, fill=1, stroke=0)
    set_fill(c_obj, BIANCO)
    c_obj.setFont("Helvetica-Bold", 10)
    c_obj.drawString(col_after_x + 4*mm, y - 6*mm, "Dopo")

    y -= hdr_h

    for i, (before, after) in enumerate(BEFORE_AFTER):
        # alternating bg
        if i % 2 == 0:
            before_bg = BIANCO
            after_bg  = BIANCO
        else:
            before_bg = GRIGIO
            after_bg  = VERDE_BG

        set_fill(c_obj, before_bg)
        c_obj.rect(col_before_x, y - row_h, col_w, row_h, fill=1, stroke=0)
        set_fill(c_obj, after_bg)
        c_obj.rect(col_after_x, y - row_h, col_w, row_h, fill=1, stroke=0)

        # separator line
        set_stroke(c_obj, GRIGIO_S)
        c_obj.setLineWidth(0.4)
        c_obj.line(col_before_x, y - row_h, col_before_x + col_w, y - row_h)
        c_obj.line(col_after_x, y - row_h, col_after_x + col_w, y - row_h)

        ty = y - row_h / 2 - 1.5*mm

        # Before
        set_fill(c_obj, (0.5, 0.5, 0.5))
        c_obj.setFont("Helvetica", 8)
        c_obj.drawString(col_before_x + 6*mm, ty, "x  " + before)

        # After
        set_fill(c_obj, VERDE)
        c_obj.setFont("Helvetica-Bold", 8)
        c_obj.drawString(col_after_x + 3*mm, ty, "v")
        set_fill(c_obj, BLU)
        c_obj.setFont("Helvetica", 8)
        c_obj.drawString(col_after_x + 6*mm, ty, after)

        y -= row_h

    y -= 6*mm

    # Feedback box
    fb_lines = 4
    fb_row_h = 13*mm
    fb_h = 10*mm + 6*mm + fb_lines * fb_row_h + 8*mm
    remaining = y - FOOTER_H - 2*mm
    if fb_h > remaining:
        fb_h = remaining

    set_fill(c_obj, ORO_BG)
    set_stroke(c_obj, ORO)
    c_obj.setLineWidth(1.5)
    rounded_rect(c_obj, MAR, y - fb_h, CW, fb_h, r=3*mm)

    # Title
    set_fill(c_obj, BLU)
    c_obj.setFont("Helvetica-Bold", 12)
    c_obj.drawString(MAR + 5*mm, y - 8*mm, "La tua opinione e' fondamentale")

    # Subtext
    set_fill(c_obj, (0.3, 0.2, 0.0))
    c_obj.setFont("Helvetica", 8.5)
    c_obj.drawString(MAR + 5*mm, y - 13.5*mm,
                     "Queste funzionalita' sono state pensate per te. Prima di svilupparle voglio sapere cosa ne pensi.")

    qy = y - 19*mm
    for q in FEEDBACK_QS:
        set_fill(c_obj, BLU)
        c_obj.setFont("Helvetica-Bold", 8.5)
        c_obj.drawString(MAR + 5*mm, qy, q)
        # Answer line (gold)
        set_stroke(c_obj, ORO)
        c_obj.setLineWidth(0.8)
        c_obj.line(MAR + 5*mm, qy - 4*mm, MAR + CW - 5*mm, qy - 4*mm)
        qy -= fb_row_h

    # Footer note
    set_fill(c_obj, (0.45, 0.35, 0.05))
    c_obj.setFont("Helvetica-Oblique", 8)
    c_obj.drawString(MAR + 5*mm, y - fb_h + 4*mm,
                     "Puoi rispondere direttamente su questo documento o scrivermi via WhatsApp.")

    c_obj.showPage()


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    out = "IschiaStars_Nuove_Funzionalita.pdf"
    c_obj = canvas.Canvas(out, pagesize=A4)
    c_obj.setTitle("IschiaStars - Nuove Funzionalita' del Gestionale Preventivi")
    c_obj.setAuthor("IschiaStars")

    draw_page1(c_obj)
    draw_page2(c_obj)
    draw_page3(c_obj)

    c_obj.save()
    print(f"PDF generato: {out}")


if __name__ == "__main__":
    main()
