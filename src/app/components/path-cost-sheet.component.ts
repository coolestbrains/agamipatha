import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CostVerdict,
  HouseholdCeiling,
  PathCost,
  emptyCeiling,
  emiOnGap,
  formatBand,
  formatInr,
  judgeCost,
  parseUserMoney,
  pathCostTones,
} from '../path-cost';

const STORAGE_KEY = 'agamipatha-household-ceiling';

@Component({
  selector: 'app-path-cost-sheet',
  imports: [FormsModule, RouterLink],
  templateUrl: './path-cost-sheet.component.html',
  styleUrl: './path-cost-sheet.component.scss',
})
export class PathCostSheetComponent {
  readonly cost = input.required<PathCost>();

  readonly cashText = signal('');
  readonly loanText = signal('');
  readonly walkText = signal('');
  readonly signer = signal('');

  readonly house = computed<HouseholdCeiling>(() => ({
    cash: parseUserMoney(this.cashText()),
    withLoan: parseUserMoney(this.loanText()),
    walkAway: parseUserMoney(this.walkText()),
    signer: this.signer(),
  }));

  readonly gapEmi = computed(() => emiOnGap(this.cost().pvt.mid, this.house().cash, this.cost().years));
  readonly verdict = computed<CostVerdict>(() => judgeCost(this.cost(), this.house()));
  readonly costTones = computed(() => pathCostTones(this.cost()));

  readonly formatInr = formatInr;
  readonly formatBand = formatBand;

  constructor() {
    this.read();
  }

  persist(): void {
    const house = this.house();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(house));
    } catch {
      /* ignore quota */
    }
  }

  private read(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw) as HouseholdCeiling;
      const base = { ...emptyCeiling(), ...saved };
      this.cashText.set(base.cash ? String(base.cash) : '');
      this.loanText.set(base.withLoan ? String(base.withLoan) : '');
      this.walkText.set(base.walkAway ? String(base.walkAway) : '');
      this.signer.set(base.signer || '');
    } catch {
      /* ignore */
    }
  }
}
