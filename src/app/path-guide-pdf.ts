import type { jsPDF } from 'jspdf';
import { PathGuide } from './path-guide';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 10;
const BOTTOM = PAGE_H - 18;

export async function downloadPathGuidePdf(guide: PathGuide): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const writer = new GuideWriter(doc, guide);
  writer.draw();
  doc.save(guide.filename);
}

class GuideWriter {
  private y = MARGIN;
  private page = 1;

  constructor(
    private readonly doc: jsPDF,
    private readonly guide: PathGuide,
  ) {}

  draw(): void {
    this.header();
    this.heading(pdfSafe(this.guide.brand), 11, true);
    this.gap(1);
    this.heading(pdfSafe(this.guide.title), 18);
    this.body(this.guide.subtitle, 10);
    this.body(this.guide.prepared, 9, true);
    this.rule();
    for (const para of this.guide.intro) {
      this.body(para);
    }
    this.section('Route at a glance', this.guide.overview);
    for (const stage of this.guide.stages) {
      this.ensure(28);
      this.heading(pdfSafe(stage.title), 13);
      if (stage.kicker) {
        this.body(stage.kicker, 9, true);
      }
      for (const para of stage.paragraphs) {
        this.body(para);
      }
      for (const group of stage.groups) {
        this.subhead(group.label);
        this.bullets(group.items);
      }
    }
    for (const block of this.guide.sections) {
      this.section(block.heading, block.bullets ?? [], block.paragraphs);
    }
    this.stamp();
  }

  private section(title: string, bullets: string[] = [], paragraphs: string[] = []): void {
    this.ensure(22);
    this.heading(pdfSafe(title), 13);
    for (const para of paragraphs ?? []) {
      this.body(para);
    }
    if (bullets.length) {
      this.bullets(bullets);
    }
  }

  private header(): void {
    this.doc.setDrawColor(17);
    this.doc.setLineWidth(0.4);
    this.doc.line(MARGIN, 10, PAGE_W - MARGIN, 10);
    this.y = 14;
  }

  private heading(text: string, size: number, muted = false): void {
    this.ensure(size * 0.55 + 6);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(size);
    this.doc.setTextColor(muted ? 90 : 17);
    const lines = this.doc.splitTextToSize(text, CONTENT_W) as string[];
    this.doc.text(lines, MARGIN, this.y);
    this.y += lines.length * (size * 0.42) + 2.2;
    this.doc.setTextColor(17);
  }

  private subhead(text: string): void {
    this.ensure(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.text(pdfSafe(text), MARGIN, this.y);
    this.y += 5;
  }

  private body(text: string, size = 10.5, muted = false): void {
    const clean = pdfSafe(text).trim();
    if (!clean) {
      return;
    }
    this.doc.setFont('helvetica', muted ? 'italic' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(muted ? 80 : 17);
    const lines = this.doc.splitTextToSize(clean, CONTENT_W) as string[];
    const lh = size * 0.42;
    this.ensure(lines.length * lh + 3);
    this.doc.text(lines, MARGIN, this.y);
    this.y += lines.length * lh + 2.4;
    this.doc.setTextColor(17);
  }

  private bullets(items: string[]): void {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    for (const item of items) {
      const lines = this.doc.splitTextToSize(pdfSafe(item), CONTENT_W - 6) as string[];
      this.ensure(lines.length * 4.3 + 2);
      this.doc.circle(MARGIN + 1.2, this.y - 1.1, 0.7, 'F');
      this.doc.text(lines, MARGIN + 5, this.y);
      this.y += lines.length * 4.3 + 1.2;
    }
    this.y += 1.2;
  }

  private rule(): void {
    this.ensure(6);
    this.doc.setDrawColor(180);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 5;
    this.doc.setDrawColor(17);
  }

  private gap(mm: number): void {
    this.y += mm;
  }

  private ensure(need: number): void {
    if (this.y + need <= BOTTOM) {
      return;
    }
    this.stamp();
    this.doc.addPage();
    this.page += 1;
    this.header();
  }

  private stamp(): void {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(110);
    this.doc.text(pdfSafe(this.guide.footer), MARGIN, FOOTER_Y);
    this.doc.text(String(this.page), PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
    this.doc.setTextColor(17);
  }
}

function pdfSafe(value: string): string {
  return (value || '')
    .replace(/₹/g, 'Rs ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/·/g, '|')
    .replace(/[^\t\n\r\x20-\x7E]/g, '');
}
