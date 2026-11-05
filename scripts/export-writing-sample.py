#!/usr/bin/env python3
"""Export the same public observations as the web brief to a one-page PDF.

Run the local app first, then:
  python3 scripts/export-writing-sample.py --url http://127.0.0.1:3126/research/freight/sample/data

Requires reportlab and pypdf for local authoring, not for the deployed app.
Only public case-study data is requested; browser notes are never read.
"""
import argparse
import html
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]


def plain(value):
    return str(value).translate(str.maketrans({"\u2014": " - ", "\u2013": "-", "\u2011": "-", "\u2212": "-", "\u00d7": "x", "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u00b7": " | "}))


def escape(value):
    return html.escape(plain(value))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:3126/research/freight/sample/data")
    args = parser.parse_args()
    with urlopen(args.url, timeout=60) as response:
        sample = json.load(response)
    if sample.get("projectId") != "freight" or not sample.get("observations"):
        raise ValueError("Expected the freight case study with sourced observations.")
    output = ROOT / "output" / "pdf"
    output.mkdir(parents=True, exist_ok=True)
    target = output / "Allen_Xu_Freight_Research_Sample.pdf"
    ink, blue, muted, line = [colors.HexColor(value) for value in ["#18202c", "#1d4f91", "#526071", "#dde1e7"]]
    styles = {
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=12.3, textColor=ink, spaceAfter=3),
        "muted": ParagraphStyle("muted", fontName="Helvetica", fontSize=8.7, leading=11.1, textColor=muted),
        "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=9.8, leading=12.5, textColor=blue, spaceAfter=3),
        "source": ParagraphStyle("source", fontName="Helvetica", fontSize=7.6, leading=9.5, textColor=muted),
        "scope": ParagraphStyle("scope", fontName="Helvetica", fontSize=7.8, leading=10.1, textColor=muted),
    }
    story = []
    width = A4[0] - 76

    def paragraph(text, style="body"):
        return Paragraph(text, styles[style])

    def cited_text(text, references=(), parts=None):
        chunks = parts if parts is not None else [{"text": text, "references": references}]
        result = []
        for part in chunks:
            result.append(escape(part["text"]))
            refs = " ".join(f'[{number}]' for number in part.get("references", []))
            if refs:
                result.append(f' <font color="#1d4f91">{refs}</font>')
        return "".join(result)

    header = Table([[paragraph("<b>FACTORFORGE</b>", "label"), paragraph(f'{escape(sample["author"])} | {escape(sample["authorRole"])}', "muted")]], colWidths=[width * 0.33, width * 0.67])
    header.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story += [header, HRFlowable(width="100%", thickness=0.7, color=line), Spacer(1, 9)]
    story.append(Paragraph(escape(sample["title"]), ParagraphStyle("title", fontName="Times-Bold", fontSize=23, leading=25, textColor=ink, spaceAfter=5)))
    story.append(paragraph(f'Analysis as of {escape(sample["asOfUtc"])} UTC | Edition {escape(sample["researchVersion"])}', "muted"))
    story.append(paragraph('Public-source research sample | Primary fieldwork proposed', "muted"))
    story.append(Spacer(1, 7))
    story.append(Paragraph(escape(sample["conclusion"]), ParagraphStyle("conclusion", fontName="Times-Roman", fontSize=16, leading=18, textColor=blue, spaceAfter=7)))
    story.append(Spacer(1, 4))
    for observation in sample["observations"]:
        story.append(KeepTogether([
            paragraph(escape(observation["label"]), "label"),
            paragraph(cited_text(observation["finding"], observation["references"], observation.get("findingParts"))),
            paragraph(cited_text(observation["interpretation"], parts=observation.get("interpretationParts")), "muted"),
            Spacer(1, 6),
        ]))
    story += [HRFlowable(width="100%", thickness=0.5, color=line), Spacer(1, 6)]
    story.append(paragraph("Alternative explanations", "label"))
    for item in sample["alternativeExplanations"]:
        story.append(paragraph(f'&#8226; {escape(item)}', "muted"))
    story += [Spacer(1, 6), paragraph("What I would investigate next", "label")]
    for index, item in enumerate(sample["nextChecks"], 1):
        story.append(paragraph(f'{index}. <b>{escape(item["question"])}.</b> {escape(item["test"])}', "muted"))
        story.append(Spacer(1, 3))
    story += [Spacer(1, 6), paragraph("Project leadership & AI tools", "label"), paragraph(escape(sample["contribution"]), "muted"), paragraph(escape(sample["aiAssistance"]), "muted")]
    story += [Spacer(1, 4), HRFlowable(width="100%", thickness=0.5, color=line), Spacer(1, 4), paragraph("Sources | links lead to the original series or filing", "label")]
    source_cells = [paragraph(f'[{source["number"]}] <link href="{html.escape(source["url"], quote=True)}" color="#1d4f91">{escape(source["title"])}</link>', "source") for source in sample["sources"]]
    source_rows = [source_cells[index:index + 2] for index in range(0, len(source_cells), 2)]
    if len(source_rows[-1]) == 1:
        source_rows[-1].append("")
    source_table = Table(source_rows, colWidths=[width / 2, width / 2], hAlign="LEFT")
    source_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    dates = sample.get("componentDates") or {}
    refresh_dates = ' | '.join(f'{label} retrieved {escape(dates.get(key, "unavailable")[:10])}' for key, label in [("macro", "Macro"), ("companies", "SEC"), ("prices", "Prices")])
    story += [source_table, Spacer(1, 7), paragraph(escape(sample["scope"]), "scope"), Spacer(1, 3), paragraph(f'Fixed information cutoff: {escape(sample["informationCutoff"])}. {refresh_dates}. Observation periods shown above.', "scope")]
    doc = SimpleDocTemplate(str(target), pagesize=A4, rightMargin=38, leftMargin=38, topMargin=30, bottomMargin=30, title=sample["title"], author=sample["author"], subject="Independent public-data research writing sample")
    doc.build(story)
    reader = PdfReader(target)
    if len(reader.pages) != 1:
        raise ValueError(f"Expected one page, generated {len(reader.pages)}. Review layout before publishing.")
    extracted = reader.pages[0].extract_text()
    for text in ["Allen Xu", "No primary interviews", "planned, not completed"]:
        if text not in extracted:
            raise ValueError(f"Required boundary or attribution missing: {text}")
    public = ROOT / "public" / "research-samples"
    public.mkdir(parents=True, exist_ok=True)
    public_target = public / "freight-research-sample.pdf"
    public_target.write_bytes(target.read_bytes())
    metadata = {"snapshotBuiltAt": sample["snapshotBuiltAt"], "researchVersion": sample["researchVersion"], "contentHash": sample["contentHash"], "pdfSha256": hashlib.sha256(target.read_bytes()).hexdigest(), "path": "/research-samples/freight-research-sample.pdf", "preparedAt": datetime.now(timezone.utc).isoformat()}
    (ROOT / "src" / "data" / "research" / "sample-export.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (output / "writing-sample-source.json").write_text(json.dumps(sample, indent=2) + "\n")
    print(json.dumps({"pdf": str(target), "pages": 1, "words": len(extracted.split()), "linked_sources": len(sample["sources"]), "public_copy": str(public_target)}))


if __name__ == "__main__":
    main()
