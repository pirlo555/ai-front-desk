# -*- coding: utf-8 -*-
"""Sales kit PDF: bilingual, two columns (Spanish left, English right)."""

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak,
)

OUT = "Kit-de-venta-Recepcionista-IA.pdf"

INK = colors.HexColor("#16232B")
INK2 = colors.HexColor("#4E5F5C")
INK3 = colors.HexColor("#7C8C88")
ACCENT = colors.HexColor("#D9551F")
LINE = colors.HexColor("#D3DAD7")
SOFT = colors.HexColor("#FBEADF")
PANEL = colors.HexColor("#F4F6F4")
GO = colors.HexColor("#256A52")

M = 0.55 * inch
PW, PH = LETTER
COLW = (PW - 2 * M - 0.28 * inch) / 2

S = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=23, leading=26,
                         textColor=INK, spaceAfter=4),
    "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=10.5, leading=14,
                          textColor=INK2, spaceAfter=2),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13.5, leading=16,
                         textColor=INK, spaceBefore=2, spaceAfter=2),
    "kicker": ParagraphStyle("kicker", fontName="Helvetica-Bold", fontSize=7.8, leading=10,
                             textColor=ACCENT, spaceAfter=3),
    "lbl": ParagraphStyle("lbl", fontName="Helvetica-Bold", fontSize=7.8, leading=10,
                          textColor=ACCENT, spaceAfter=3),
    "lblq": ParagraphStyle("lblq", fontName="Helvetica-Bold", fontSize=7.8, leading=10,
                           textColor=INK3, spaceAfter=3),
    "say": ParagraphStyle("say", fontName="Times-Roman", fontSize=11.2, leading=15,
                          textColor=INK, spaceAfter=6),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.2, leading=12.6,
                           textColor=INK2, spaceAfter=5, alignment=TA_LEFT),
    "note": ParagraphStyle("note", fontName="Helvetica-Oblique", fontSize=8.4, leading=11.4,
                           textColor=INK3, spaceAfter=2),
    "obj": ParagraphStyle("obj", fontName="Helvetica-Bold", fontSize=9.6, leading=12.6,
                          textColor=INK, spaceAfter=3),
    "ans": ParagraphStyle("ans", fontName="Times-Roman", fontSize=10.4, leading=14,
                          textColor=INK, spaceAfter=3),
    "li": ParagraphStyle("li", fontName="Helvetica", fontSize=9.2, leading=12.6,
                         textColor=INK2, spaceAfter=3, leftIndent=10, bulletIndent=1),
    "card": ParagraphStyle("card", fontName="Helvetica", fontSize=9, leading=12,
                           textColor=INK2),
    "cardb": ParagraphStyle("cardb", fontName="Helvetica-Bold", fontSize=10, leading=13,
                            textColor=INK),
}


def two_col(left, right):
    """Spanish on the left, English on the right, divided by a hairline."""
    t = Table([[left, right]], colWidths=[COLW, COLW], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 13),
        ("LEFTPADDING", (1, 0), (1, 0), 13),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, LINE),
    ]))
    return t


def say_box(label, lines, note=None, quiet=False):
    """A block of words to be said out loud."""
    inner = [Paragraph(label, S["lblq"] if quiet else S["lbl"])]
    for ln in lines:
        inner.append(Paragraph(ln, S["say"]))
    if note:
        inner.append(Spacer(1, 1))
        inner.append(Paragraph(note, S["note"]))
    t = Table([[inner]], colWidths=[COLW - 13], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LINEABOVE", (0, 0), (-1, 0), 2, LINE if quiet else ACCENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def section(num, es_title, en_title):
    def head(n, title):
        t = Table([[Paragraph(n, ParagraphStyle("n", fontName="Helvetica-Bold", fontSize=9,
                                                leading=11, textColor=ACCENT)),
                    Paragraph(title, S["h2"])]],
                  colWidths=[17, COLW - 30], hAlign="LEFT")
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        return t
    return two_col([head(num, es_title)], [head(num, en_title)])


def panel(es, en, bg=SOFT):
    def cell(txt):
        return Paragraph(txt, ParagraphStyle("p", fontName="Times-Roman", fontSize=10.2,
                                             leading=13.6, textColor=INK))
    t = Table([[cell(es), cell(en)]], colWidths=[COLW, COLW], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
    ]))
    return t


def objection(es_q, es_a, en_q, en_a, es_tip=None, en_tip=None):
    def side(q, a, tip):
        out = [Paragraph(q, S["obj"]), Paragraph(a, S["ans"])]
        if tip:
            out.append(Paragraph(tip, S["note"]))
        return out
    t = Table([[side(es_q, es_a, es_tip), side(en_q, en_a, en_tip)]],
              colWidths=[COLW, COLW], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 13),
        ("LEFTPADDING", (1, 0), (1, 0), 13),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, LINE),
    ]))
    return t


def deco(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(M, PH - M + 12, PW - M, PH - M + 12)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK3)
    canvas.drawString(M, PH - M + 17, "RECEPCIONISTA BILINGÜE 24/7   ·   BILINGUAL 24/7 FRONT DESK")
    canvas.drawRightString(PW - M, PH - M + 17, "Miami")
    canvas.line(M, M - 10, PW - M, M - 10)
    canvas.drawString(M, M - 21, "Español a la izquierda   ·   English on the right")
    canvas.drawRightString(PW - M, M - 21, str(doc.page))
    canvas.restoreState()


doc = BaseDocTemplate(OUT, pagesize=LETTER,
                      leftMargin=M, rightMargin=M, topMargin=M, bottomMargin=M,
                      title="Kit de venta - Recepcionista IA bilingue",
                      author="Nivezzo / AI Front Desk", subject="Guion de venta bilingue")
doc.addPageTemplates([PageTemplate(id="main",
                                   frames=[Frame(M, M, PW - 2 * M, PH - 2 * M, id="f",
                                                 leftPadding=0, rightPadding=0,
                                                 topPadding=0, bottomPadding=0)],
                                   onPage=deco)])

F = []
gap = lambda h=11: Spacer(1, h)

# ─────────────────────────── COVER ───────────────────────────
F += [
    Spacer(1, 26),
    Paragraph("Kit de venta", S["h1"]),
    Paragraph("Recepcionista bilingüe 24/7 para negocios locales", S["sub"]),
    Paragraph("Bilingual 24/7 front desk for local businesses", S["sub"]),
    gap(18),
    panel(
        "<b>Cómo se usa este documento.</b> Cada página lleva el español a la "
        "izquierda y el inglés a la derecha. No tiene que decidir el idioma antes "
        "de entrar: use la columna que le pida el dueño en cuanto abra la boca.",
        "<b>How to use this.</b> Every page has Spanish on the left and English on "
        "the right. You do not have to pick a language before you walk in: use "
        "whichever column the owner answers you in.",
        bg=PANEL),
    gap(14),
    two_col(
        [Paragraph("LO QUE VENDES", S["kicker"]),
         Paragraph("Cuando nadie coge el teléfono, al cliente le llega un mensaje "
                   "de texto en segundos, en inglés o en español, que le pregunta "
                   "qué necesita y le aparta la cita. El negocio se lo encuentra "
                   "con el nombre y el teléfono.", S["body"]),
         Paragraph("No es una centralita. No finge ser una persona. No da consejos. "
                   "Recoge y pasa.", S["body"])],
        [Paragraph("WHAT YOU SELL", S["kicker"]),
         Paragraph("When nobody picks up, the caller gets a text within seconds, in "
                   "English or Spanish, asking what they need and holding their slot. "
                   "The business finds it waiting, with a name and a number.", S["body"]),
         Paragraph("It is not a call centre. It never pretends to be a person. It "
                   "never gives advice. It collects and hands over.", S["body"])]),
    gap(14),
    two_col(
        [Paragraph("LAS TRES REGLAS", S["kicker"]),
         Paragraph("1. No vendas el producto. Vende la llamada que perdieron.", S["body"]),
         Paragraph("2. No digas «inteligencia artificial». Di «mensaje de texto automático».", S["body"]),
         Paragraph("3. No pidas la venta en la primera visita. Pide la prueba gratis.", S["body"])],
        [Paragraph("THE THREE RULES", S["kicker"]),
         Paragraph("1. Don't sell the product. Sell the call they missed.", S["body"]),
         Paragraph("2. Don't say \"artificial intelligence\". Say \"automatic text back\".", S["body"]),
         Paragraph("3. Don't ask for the sale on the first visit. Ask for the free trial.", S["body"])]),
    PageBreak(),
]

# ─────────────────────── IN PERSON ───────────────────────
F += [
    Paragraph("En persona", S["h1"]),
    Paragraph("In person — the walk-in", S["sub"]),
    gap(14),
    section("1", "La entrada", "The opener"),
    gap(6),
    two_col(
        [say_box("DILE ESTO", [
            "«Buenas, ¿es usted el dueño? Soy Ariel, trabajo aquí en Miami. "
            "Una pregunta rápida y me voy: cuando ustedes están ocupados y suena "
            "el teléfono y nadie lo coge, ¿qué pasa con esa persona?»"],
            "Y ahora cállate. Deja que conteste él. Casi siempre dicen «pues se pierde».")],
        [say_box("SAY THIS", [
            "\"Hi, are you the owner? I'm Ariel, I work here in Miami. One quick "
            "question and I'm out of your way: when you're all busy and the phone "
            "rings and nobody picks it up, what happens to that person?\""],
            "Then stop talking. Let him answer. Nine times out of ten he says \"we lose them\".")]),
    gap(11),
    section("2", "Cuando conteste", "When he answers"),
    gap(6),
    two_col(
        [say_box("DILE ESTO", [
            "«Eso es justo lo que arreglo. Cuando nadie contesta, la persona recibe "
            "un mensaje de texto en cinco segundos, en inglés o en español, que le "
            "pregunta qué necesita y le aparta la cita. Usted se la encuentra por la "
            "mañana con el nombre y el teléfono.»",
            "«¿Le enseño cómo se ve? Son dos minutos, aquí en el móvil.»"],
            "Dale tu teléfono con la demo abierta. Que escriba él, no tú.")],
        [say_box("SAY THIS", [
            "\"That's exactly what I fix. When nobody answers, that person gets a "
            "text within five seconds, in English or Spanish, asking what they need "
            "and holding their slot. You find it in the morning with a name and a "
            "phone number.\"",
            "\"Want me to show you? Two minutes, right here on my phone.\""],
            "Hand him your phone with the demo open. He types, not you.")]),
    gap(11),
    section("3", "La jugada que más cierra", "The move that closes"),
    gap(6),
    two_col(
        [Paragraph("Llama a tres negocios el sábado por la mañana o a la hora de comer. "
                   "Apunta quién no contesta. A esos vuelves en persona.", S["body"]),
         say_box("DILE ESTO", [
             "«Le llamé el sábado a las 11:20 y no me cogieron. No es una crítica, "
             "sé que están liados. Pero si yo hubiera sido un cliente, me habría ido "
             "al siguiente. Eso es lo que yo arreglo.»"],
             "Es incontestable, porque es verdad y les pasó a ellos.")],
        [Paragraph("Call three businesses on a Saturday morning or at lunchtime. Write "
                   "down who doesn't answer. Those are the ones you visit.", S["body"]),
         say_box("SAY THIS", [
             "\"I called you Saturday at 11:20 and nobody picked up. That's not a dig "
             "— I know you're busy. But if I'd been a customer, I'd have gone to the "
             "next guy on the list. That's what I fix.\""],
             "It's unanswerable, because it's true and it happened to them.")]),
    gap(11),
    section("4", "El cierre", "The close"),
    gap(6),
    two_col(
        [Paragraph("No vendas en la primera visita. <b>Vende la prueba.</b>", S["body"]),
         say_box("DILE ESTO", [
             "«Mire, se lo dejo funcionando gratis 30 días con su nombre y sus "
             "horarios. Si en un mes no le trae ni un cliente, lo apagamos y no me "
             "debe nada. Si le trae, hablamos de precio. ¿Le parece?»"])],
        [Paragraph("Don't sell on the first visit. <b>Sell the trial.</b>", S["body"]),
         say_box("SAY THIS", [
             "\"Here's what I'll do: I'll set it up free for 30 days with your name "
             "and your hours. If it doesn't bring you a single customer in a month, "
             "we switch it off and you owe me nothing. If it does, we talk price. "
             "Fair enough?\""])]),
    PageBreak(),
]

# ───────────────────────── BY PHONE ─────────────────────────
F += [
    Paragraph("Por teléfono", S["h1"]),
    Paragraph("On the phone — the cold call", S["sub"]),
    gap(10),
    panel("<b>Aquí tienes diez segundos, no dos minutos.</b> Le estás "
          "interrumpiendo y los dos lo sabéis. Dilo tú primero: reconocer la "
          "interrupción es lo que hace que no te cuelguen.",
          "<b>You have ten seconds here, not two minutes.</b> You are interrupting "
          "and you both know it. Say so first: naming the interruption is what "
          "stops them hanging up."),
    gap(12),
    section("1", "Pedir por el dueño", "Getting to the owner"),
    gap(6),
    two_col(
        [say_box("DILE ESTO", ["«Buenas, ¿está el dueño?»"],
                 "Si te preguntan de qué se trata: «Es sobre las llamadas que "
                 "se les pierden cuando están ocupados. Treinta segundos.»", quiet=True),
         Paragraph("Si no está: «¿Me puede decir a qué hora suele estar? Prefiero "
                   "llamarle cuando no le interrumpa.» Anótalo y llama entonces.", S["body"])],
        [say_box("SAY THIS", ["\"Hi, is the owner around?\""],
                 "If they ask what it's about: \"It's about the calls that get "
                 "missed when you're all busy. Thirty seconds.\"", quiet=True),
         Paragraph("If he's out: \"What time is he usually in? I'd rather call when "
                   "I'm not interrupting.\" Write it down and call then.", S["body"])]),
    gap(11),
    section("2", "Los primeros diez segundos", "The first ten seconds"),
    gap(6),
    two_col(
        [say_box("DILE ESTO", [
            "«Hola, soy Ariel, de aquí de Miami. Le llamo en frío, así que le pido "
            "treinta segundos y usted decide si sigo. ¿Le va bien?»"],
            "Pedir permiso lo cambia todo. El que dice «sí» ya te está escuchando.")],
        [say_box("SAY THIS", [
            "\"Hi, this is Ariel, local here in Miami. This is a cold call, so give "
            "me thirty seconds and then you decide if I keep going. Fair?\""],
            "Asking permission changes everything. A man who says yes is already listening.")]),
    gap(11),
    section("3", "El motivo y la pregunta", "The reason and the question"),
    gap(6),
    two_col(
        [say_box("DILE ESTO", [
            "«Gracias. Ayudo a negocios como el suyo a no perder las llamadas que "
            "no alcanzan a contestar. Cuando nadie coge, al cliente le llega un "
            "mensaje de texto en segundos, en inglés o en español, y le pregunta "
            "qué necesita.»",
            "«¿Qué pasa ahora mismo en su negocio cuando entra una llamada y están "
            "todos ocupados?»"],
            "La pregunta es lo importante. Cállate y deja que la conteste.")],
        [say_box("SAY THIS", [
            "\"Thanks. I help businesses like yours stop losing the calls they can't "
            "get to. When nobody picks up, the caller gets a text within seconds, in "
            "English or Spanish, asking what they need.\"",
            "\"What happens right now when a call comes in and everyone's busy?\""],
            "The question is the point. Stop talking and let him answer it.")]),
    gap(11),
    section("4", "El cierre del teléfono", "The phone close"),
    gap(6),
    two_col(
        [Paragraph("Por teléfono <b>no pidas una reunión.</b> Pide mandarle el enlace. "
                   "Es un sí barato y te mete la demo en su bolsillo.", S["body"]),
         say_box("DILE ESTO", [
             "«Mire, no le robo más tiempo: ¿le mando un enlace por mensaje para que "
             "lo pruebe usted cuando tenga un minuto? Si le gusta, hablamos. Si no, "
             "no me vuelve a oír.»"])],
        [Paragraph("On the phone, <b>don't ask for a meeting.</b> Ask to text him the "
                   "link. It's a cheap yes and it puts the demo in his pocket.", S["body"]),
         say_box("SAY THIS", [
             "\"I won't take more of your time: can I text you a link so you can try "
             "it yourself when you get a minute? If you like it, we talk. If not, you "
             "never hear from me again.\""])]),
    PageBreak(),
]

# ───────────── VOICEMAIL + FOLLOW-UP ─────────────
F += [
    Paragraph("Buzón de voz y mensaje", S["h1"]),
    Paragraph("Voicemail and follow-up text", S["sub"]),
    gap(14),
    section("5", "Si salta el buzón", "If you get voicemail"),
    gap(6),
    two_col(
        [say_box("DÉJALE ESTO", [
            "«Hola, soy Ariel, de Miami, el 305-555-0100. Le llamo porque ayudo a "
            "negocios como el suyo a recuperar las llamadas que no alcanzan a "
            "contestar: cuando nadie coge, al cliente le llega un mensaje en "
            "segundos preguntándole qué necesita. Si quiere verlo, mi número otra "
            "vez: 305-555-0100. Gracias.»"],
            "Treinta segundos como mucho. Di tu número dos veces, despacio, "
            "al principio y al final.")],
        [say_box("LEAVE THIS", [
            "\"Hi, this is Ariel, local here in Miami, 305-555-0100. I'm calling "
            "because I help businesses like yours win back the calls they can't get "
            "to: when nobody picks up, the caller gets a text within seconds asking "
            "what they need. If you'd like to see it, my number again: 305-555-0100. "
            "Thanks.\""],
            "Thirty seconds maximum. Say your number twice, slowly, at the start "
            "and at the end.")]),
    gap(11),
    section("6", "El mensaje de después", "The text you send after"),
    gap(6),
    two_col(
        [say_box("MÁNDALE ESTO", [
            "«Hola [nombre], soy Ariel — acabamos de hablar por teléfono. Aquí "
            "tiene la demostración: [enlace]",
            "Escríbale como si fuera un cliente suyo, en español o en inglés, y "
            "verá exactamente lo que recibiría usted. Cualquier cosa, me dice.»"],
            "Mándalo en los cinco minutos siguientes, mientras se acuerda de ti.",
            quiet=True)],
        [say_box("SEND THIS", [
            "\"Hi [name], it's Ariel — we just spoke on the phone. Here's the demo: "
            "[link]",
            "Write to it like one of your own customers would, in English or Spanish, "
            "and you'll see exactly what you'd get. Any questions, just tell me.\""],
            "Send it within five minutes, while he still remembers you.",
            quiet=True)]),
    gap(11),
    section("7", "Objeciones de teléfono", "Phone-only objections"),
    gap(4),
    objection("«No me interesa.» (en los primeros cinco segundos)",
              "«Lo entiendo, todavía no sabe qué es. Deme una frase y cuelgue si no "
              "le sirve: cuando nadie coge el teléfono, al cliente le llega un "
              "mensaje en segundos. ¿Eso le pasa?»",
              "\"Not interested.\" (in the first five seconds)",
              "\"Fair enough, you don't know what it is yet. Give me one sentence and "
              "hang up if it's not for you: when nobody picks up the phone, the caller "
              "gets a text within seconds. Does that happen to you?\"",
              "Es un reflejo, no una respuesta. No lo tomes como un no.",
              "That's a reflex, not an answer. Don't take it as a no."),
    objection("«Mándeme un email.»",
              "«Claro. Aunque es más rápido por mensaje, que lo abre en el momento. "
              "¿Le va bien a este mismo número desde el que le llamo?»",
              "\"Send me an email.\"",
              "\"Sure. Though a text is quicker — you'd see it right away. Is this the "
              "best number, the one I'm calling?\"",
              "El email es una forma educada de decir adiós. El mensaje, no.",
              "An email is a polite goodbye. A text isn't."),
    objection("«Estoy ocupado ahora.»",
              "«Lo sé, por eso le llamo: es justo el problema. ¿Cuándo le viene mejor, "
              "mañana temprano o después de las cinco?»",
              "\"I'm busy right now.\"",
              "\"I know — that's exactly the problem I'm calling about. When's better, "
              "early tomorrow or after five?\"",
              "Dos opciones, no una pregunta abierta.",
              "Two options, never an open question."),
    PageBreak(),
]

# ───────────────────── OBJECTIONS ─────────────────────
F += [
    Paragraph("Las cinco objeciones", S["h1"]),
    Paragraph("The five real objections", S["sub"]),
    gap(14),
    objection("«Ya tengo quien conteste el teléfono.»",
              "«Perfecto, esto no la sustituye. Es para cuando ella está con un "
              "cliente, en el almuerzo, o son las nueve de la noche. ¿Qué pasa con "
              "esas llamadas ahora mismo?»",
              "\"I already have someone answering the phone.\"",
              "\"Good — this doesn't replace her. It's for when she's with a customer, "
              "at lunch, or it's nine at night. What happens to those calls today?\"",
              "No discutas su equipo. Amplía el horario, no lo reemplaces.",
              "Never argue with his staff. Extend the hours, don't replace them."),
    objection("«Es muy caro.»",
              "«¿Cuánto vale para usted un cliente nuevo? … Con que le recupere uno "
              "al mes, ya se pagó solo. Y si no le recupera ninguno, lo cancela.»",
              "\"That's expensive.\"",
              "\"What's one new customer worth to you? … If it wins back one a month, "
              "it's paid for itself. And if it wins back none, you cancel.\"",
              "Deja que el número lo diga él. Nunca tú.",
              "Let him say the number. Never you."),
    objection("«A mis clientes no les gustan los robots.»",
              "«No contesta el teléfono ni finge ser una persona. Manda un mensaje de "
              "texto como el que mandaría usted si tuviera tiempo. Y contesta en "
              "español, que es lo que media Miami prefiere.»",
              "\"My customers don't like robots.\"",
              "\"It doesn't answer the phone and it never pretends to be a person. It "
              "sends the text you'd send yourself if you had a free hand. And it "
              "answers in Spanish, which is what half of Miami would rather read.\""),
    objection("«¿Y si le dice algo equivocado a un cliente?»",
              "«No puede. No diagnostica, no da consejos y no promete precios. Solo "
              "pregunta qué necesitan y se lo pasa a usted. Todo lo decide usted.»",
              "\"What if it tells a customer something wrong?\"",
              "\"It can't. It never diagnoses, never advises, never quotes a price. It "
              "asks what they need and hands it to you. Every decision stays yours.\"",
              "Si dudan, enséñales la prueba del abogado: le preguntan «¿tengo caso?» "
              "y se niega a opinar.",
              "If they doubt it, show them the law firm demo: ask it \"do I have a "
              "case?\" and watch it refuse to answer."),
    objection("«Ahora no tengo tiempo.»",
              "«Por eso lo monto yo. Usted no instala nada ni aprende nada. Me da el "
              "nombre del negocio y los horarios, y en dos días lo tiene funcionando.»",
              "\"I don't have time for this right now.\"",
              "\"That's why I set it up. You install nothing and learn nothing. Give me "
              "the business name and your hours and it's running in two days.\""),
    gap(16),
    panel("<b>Si te dicen que no quince veces seguidas,</b> no es que el producto sea "
          "malo. Es que así es vender. Treinta visitas para dos síes es una tasa "
          "normal. Sigue.",
          "<b>If you get fifteen noes in a row,</b> it isn't the product. That's what "
          "selling is. Thirty visits for two yeses is a normal rate. Keep going."),
    PageBreak(),
]

# ───────────────────── WHO TO CALL ─────────────────────
def tier_row(n, es_name, es_why, en_name, en_why):
    def side(name, why):
        return [Paragraph(name, S["cardb"]), Paragraph(why, S["card"])]
    t = Table([[Paragraph(n, ParagraphStyle("tn", fontName="Helvetica-Bold", fontSize=15,
                                            leading=17, textColor=ACCENT)),
                side(es_name, es_why), side(en_name, en_why)]],
              colWidths=[22, COLW - 22, COLW], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (1, 0), (1, 0), 13),
        ("LEFTPADDING", (2, 0), (2, 0), 13),
        ("RIGHTPADDING", (2, 0), (2, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LINEBEFORE", (2, 0), (2, 0), 0.5, LINE),
    ]))
    return t


F += [
    Paragraph("A quién llamar", S["h1"]),
    Paragraph("Who to call, in order", S["sub"]),
    gap(14),
    two_col([Paragraph("MÁXIMA PRIORIDAD", S["kicker"])],
            [Paragraph("START HERE", S["kicker"])]),
    gap(2),
    tier_row("1",
             "Aire acondicionado y fontanería",
             "En Miami el aire es una emergencia. Pierden entre $50.000 y $200.000 al "
             "año en llamadas sin contestar.",
             "A/C and plumbing",
             "In Miami, air conditioning is an emergency. They lose $50,000 to $200,000 "
             "a year in unanswered calls."),
    tier_row("2",
             "Clínicas dentales",
             "Un paciente nuevo vale cientos de dólares y ya tienen presupuesto de "
             "software.",
             "Dental clinics",
             "A new patient is worth hundreds, and they already budget for software."),
    tier_row("3",
             "Abogados de inmigración",
             "Miami más español es obligatorio. Un caso vale miles y llaman fuera de "
             "horario.",
             "Immigration attorneys",
             "Miami plus Spanish is non-negotiable. A case is worth thousands and they "
             "call after hours."),
    tier_row("4",
             "Talleres mecánicos",
             "Volumen alto, mucho dueño hispano y casi ninguno tiene nada montado.",
             "Auto repair shops",
             "High volume, many Hispanic owners, and almost none have anything set up."),
    gap(16),
    two_col(
        [Paragraph("DESPUÉS", S["kicker"]),
         Paragraph("Cerrajeros · Techadores · Abogados de accidentes · Clínicas "
                   "médicas y med spas · Control de plagas", S["body"]),
         gap(6),
         Paragraph("SÁLTATE POR AHORA", S["kicker"]),
         Paragraph("Restaurantes (una llamada perdida vale poco) · Peluquerías "
                   "(ticket bajo) · Cadenas y franquicias (no deciden ellos)", S["body"])],
        [Paragraph("AFTER THAT", S["kicker"]),
         Paragraph("Locksmiths · Roofers · Accident attorneys · Medical clinics and "
                   "med spas · Pest control", S["body"]),
         gap(6),
         Paragraph("SKIP FOR NOW", S["kicker"]),
         Paragraph("Restaurants (a missed call is worth little) · Hair salons (low "
                   "ticket) · Chains and franchises (they don't decide)", S["body"])]),
    gap(16),
    two_col(
        [Paragraph("DÓNDE ENCONTRARLOS", S["kicker"]),
         Paragraph("Google Maps, buscando en español: «plomero Hialeah», «aire "
                   "acondicionado Westchester», «dentista Little Havana», «abogado "
                   "inmigración Kendall».", S["body"]),
         Paragraph("<b>Zonas:</b> Hialeah · Little Havana · Westchester · Kendall · "
                   "Doral · Sweetwater.", S["body"]),
         Paragraph("<b>Filtra:</b> que tenga teléfono, que tenga reseñas, y que "
                   "<b>no</b> tenga ya un chat en su web.", S["body"])],
        [Paragraph("WHERE TO FIND THEM", S["kicker"]),
         Paragraph("Google Maps, searching in Spanish: \"plomero Hialeah\", \"aire "
                   "acondicionado Westchester\", \"dentista Little Havana\", \"abogado "
                   "inmigración Kendall\".", S["body"]),
         Paragraph("<b>Areas:</b> Hialeah · Little Havana · Westchester · Kendall · "
                   "Doral · Sweetwater.", S["body"]),
         Paragraph("<b>Filter:</b> has a phone, has reviews, and does <b>not</b> "
                   "already have a chat on its website.", S["body"])]),
    gap(14),
    panel("<b>El truco de las reseñas.</b> Mira las de una estrella. Cuando "
          "encuentres «llamé tres veces y nadie contestó», tienes tu argumento de "
          "venta escrito por sus propios clientes. Enséñasela.",
          "<b>The review trick.</b> Read the one-star ones. When you find \"I called "
          "three times and nobody answered\", your pitch has been written for you by "
          "their own customers. Show it to them."),
]

doc.build(F)
print("PDF generado:", OUT)
