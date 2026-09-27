import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminTabsComponent } from '../components/admin-tabs.component';
import { AdminApiService } from '../admin-api.service';
import { CareerService } from '../career.service';
import { CareerNode } from '../models/career.model';
import { StatsService } from '../stats.service';

function blank(): CareerNode {
  return {
    id: '',
    title: '',
    shortTitle: '',
    kind: 'undergraduate',
    field: '',
    duration: '',
    typicalAge: '',
    summary: '',
    whatYouStudy: [],
    exams: [],
    skills: [],
    outlook: '',
    salaryHint: '',
    costGovt: '',
    costPvt: '',
    workplaces: [],
    institutes: [],
    certifications: [],
    experienceYearsMin: undefined,
    experienceYearsTypical: undefined,
    entryLevel: '',
    feederRoles: [],
  };
}

@Component({
  selector: 'app-admin-node-edit',
  imports: [FormsModule, RouterLink, AdminTabsComponent],
  templateUrl: './admin-node-edit.component.html',
  styleUrl: './admin-node-edit.component.scss',
})
export class AdminNodeEditComponent {
  private readonly api = inject(AdminApiService);
  private readonly career = inject(CareerService);
  private readonly stats = inject(StatsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isNew = !this.route.snapshot.paramMap.get('id');
  node = blank();
  studyText = '';
  examsText = '';
  skillsText = '';
  workplacesText = '';
  institutesText = '';
  certificationsText = '';
  feederRolesText = '';
  error = signal('');
  saved = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.api.listNodes().subscribe((list) => {
        const found = list.find((n) => n.id === id);
        if (found) {
          this.node = {
            ...found,
            workplaces: found.workplaces ?? [],
            institutes: found.institutes ?? [],
            certifications: found.certifications ?? [],
            feederRoles: found.feederRoles ?? [],
            entryLevel: found.entryLevel ?? '',
          };
          this.syncTexts();
        }
      });
    } else {
      const title = (this.route.snapshot.queryParamMap.get('title') ?? '').trim();
      const kind = (this.route.snapshot.queryParamMap.get('kind') ?? '').trim();
      if (title) {
        this.node.title = title;
        this.node.shortTitle = title;
        this.node.id = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80);
      }
      if (kind === 'profession') {
        this.node.kind = 'profession';
      }
    }
  }

  save(): void {
    this.error.set('');
    this.node.whatYouStudy = this.lines(this.studyText);
    this.node.exams = this.lines(this.examsText);
    this.node.skills = this.lines(this.skillsText);
    this.node.workplaces = this.lines(this.workplacesText);
    this.node.institutes = this.lines(this.institutesText);
    this.node.certifications = this.lines(this.certificationsText);
    this.node.feederRoles = this.lines(this.feederRolesText);
    this.node.entryLevel = (this.node.entryLevel || '').trim() || undefined;
    this.node.experienceYearsMin = this.asOptionalInt(this.node.experienceYearsMin);
    this.node.experienceYearsTypical = this.asOptionalInt(this.node.experienceYearsTypical);
    if (!this.node.id || !this.node.title) {
      this.error.set('Id and title are required.');
      return;
    }
    this.api.saveNode(this.node, this.isNew).subscribe({
      next: () => {
        this.saved.set(true);
        this.career.reload().subscribe();
        this.stats.load().subscribe();
        void this.router.navigate(['/admin/nodes']);
      },
      error: (err) => this.error.set(err.error?.message ?? 'Could not save.'),
    });
  }

  private syncTexts(): void {
    this.studyText = (this.node.whatYouStudy ?? []).join('\n');
    this.examsText = (this.node.exams ?? []).join('\n');
    this.skillsText = (this.node.skills ?? []).join('\n');
    this.workplacesText = (this.node.workplaces ?? []).join('\n');
    this.institutesText = (this.node.institutes ?? []).join('\n');
    this.certificationsText = (this.node.certifications ?? []).join('\n');
    this.feederRolesText = (this.node.feederRoles ?? []).join('\n');
  }

  private asOptionalInt(value: number | string | null | undefined): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isFinite(n) ? n : undefined;
  }

  private lines(text: string): string[] {
    return text.split('\n').map((s) => s.trim()).filter(Boolean);
  }
}
