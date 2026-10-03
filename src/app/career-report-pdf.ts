import type { jsPDF } from 'jspdf';
import { CareerReport } from './report.service';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 10;
const BOTTOM = PAGE_H - 18;

export async function downloadCareerReportPdf(report: CareerReport): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const writer = new ReportWriter(doc, report);
  writer.draw();
  doc.save(report.filename || 'agamipatha-career-report.pdf');
}

class ReportWriter {
  private y = MARGIN;
  private page = 1;

  constructor(
    private readonly doc: jsPDF,
    private readonly report: CareerReport,
  ) {}

  draw(): void {
    this.header();
    this.heading('AgamiPatha', 11, true);
    this.gap(1);
    this.heading('AI Career Report', 18);
    this.body(`${reportSafe(this.report.standingTitle)} → ${reportSafe(this.report.goalTitle)}`, 11, true);
    const prepared = `Prepared for ${reportSafe(this.report.displayName)}${
      this.report.city ? ` · ${reportSafe(this.report.city)}` : ''
    } · ${new Date(this.report.generatedAtUtc).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`;
    this.body(prepared, 9, true);
    this.rule();

    this.section('Overview', this.report.overview);
    this.heading('Personalised narrative', 13);
    this.body(this.report.ai.intro);
    this.subhead('Why this route fits');
    this.body(this.report.ai.fit);
    this.subhead('Risks to watch');
    this.bullets(this.report.ai.risks);
    this.subhead('Next 30 days');
    this.bullets(this.report.ai.actions30);
    this.subhead('Next 90 days');
    this.bullets(this.report.ai.actions90);

    for (const stage of this.report.stages) {
      this.ensure(28);
      this.heading(reportSafe(stage.title), 12);
      if (stage.kicker) {
        this.body(stage.kicker, 9, true);
      }
      if (stage.summary) {
        this.body(stage.summary);
      }
      for (const group of stage.groups) {
        this.subhead(group.label);
        this.bullets(group.items);
      }
    }

    this.section('What to do next', this.report.nextDoors);
    this.ensure(20);
    this.heading('Disclaimer', 11);
    this.body(this.report.disclaimer, 9, true);
    this.stamp();
  }

  private section(title: string, bullets: string[]): void {
    this.ensure(22);
    this.heading(reportSafe(title), 13);
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
    this.doc.text(reportSafe(text), MARGIN, this.y);
    this.y += 5;
  }

  private body(text: string, size = 10.5, muted = false): void {
    const clean = reportSafe(text).trim();
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
      const lines = this.doc.splitTextToSize(reportSafe(item), CONTENT_W - 6) as string[];
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
    const footer = `${reportSafe(this.report.spine)} · ${reportSafe(this.report.totalLabel)} · agamipatha.com`;
    this.doc.text(footer, MARGIN, FOOTER_Y);
    this.doc.text(String(this.page), PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
    this.doc.setTextColor(17);
  }
}

function reportSafe(value: string): string {
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
