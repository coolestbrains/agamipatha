import { Component, computed, input } from '@angular/core';
import { IconableNode, iconForNode } from '../node-icon';

@Component({
  selector: 'app-node-icon',
  template: `
    <span
      class="mark"
      [class.xs]="size() === 'xs'"
      [class.sm]="size() === 'sm'"
      [class.lg]="size() === 'lg'"
      [style.--wash]="spec().wash"
      [style.--ink]="spec().ink"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24">
        @switch (spec().key) {
          @case ('book') {
            <path d="M5 5.5h6.4A2.6 2.6 0 0 1 14 8.1V19a2.2 2.2 0 0 0-2.2-2.2H5z" />
            <path d="M19 5.5h-6.4A2.6 2.6 0 0 0 10 8.1V19a2.2 2.2 0 0 1 2.2-2.2H19z" />
          }
          @case ('flask') {
            <path d="M9 3.8h6M10 3.8v4.1L6.6 17a3.1 3.1 0 0 0 2.7 4.5h5.4A3.1 3.1 0 0 0 17.4 17L14 7.9V3.8" />
            <path d="M8.2 14.4h7.6" />
          }
          @case ('laptop') {
            <rect x="4" y="5.5" width="16" height="10.2" rx="1.6" />
            <path d="M3 18.8h18" />
          }
          @case ('medical') {
            <path d="M8.4 3.8h7.2v4.4H20.2v7.6h-4.6v4.4H8.4v-4.4H3.8V8.2h4.6z" />
          }
          @case ('scale') {
            <path d="M12 4.2v15.6M7 19.8h10" />
            <path d="M12 6.2 6.2 9.4 4.6 14A3.4 3.4 0 0 0 8 16.6 3.4 3.4 0 0 0 11.4 14L9.8 9.4z" />
            <path d="M12 6.2 17.8 9.4 19.4 14A3.4 3.4 0 0 1 16 16.6 3.4 3.4 0 0 1 12.6 14l1.6-4.6z" />
          }
          @case ('coins') {
            <ellipse cx="9.2" cy="8.2" rx="5.2" ry="3.1" />
            <path d="M4 8.2v4.4c0 1.7 2.3 3.1 5.2 3.1s5.2-1.4 5.2-3.1V8.2" />
            <ellipse cx="14.8" cy="11.4" rx="5.2" ry="3.1" />
            <path d="M9.6 11.4v4.4c0 1.7 2.3 3.1 5.2 3.1s5.2-1.4 5.2-3.1v-4.4" />
          }
          @case ('gear') {
            <circle cx="12" cy="12" r="3.1" />
            <path
              d="M12 3.6 13.3 6l2.4-.7 1.4 2.2 2.3.8-.2 2.5 2 .1.8 2.4-2 1.4.7 2.4-2.2 1.4-.8 2.3-2.5-.2-.1 2-2.4.8-1.4-2-2.4.7-1.4-2.2-2.3-.8.2-2.5-2-.1-.8-2.4 2-1.4-.7-2.4 2.2-1.4.8-2.3 2.5.2.1-2z"
            />
          }
          @case ('bolt') {
            <path d="M13.6 3.4 6.8 13.2h5.1L10.4 20.6l6.8-9.8h-5.1z" />
          }
          @case ('plane') {
            <path d="M21 12 3.8 5.8l2.1 6.2-2.1 6.2z" />
            <path d="M12.2 11.2 8 4.8h2.2L16 11.2M12.2 12.8 8 19.2h2.2L16 12.8" />
          }
          @case ('ship') {
            <path d="M4 14.6 12 8.8l8 5.8v2.2H4z" />
            <path d="M3.4 18.4c1.6 1.6 3.8 2.2 8.6 2.2s7-0.6 8.6-2.2" />
            <path d="M12 8.8V5.2M9.6 5.2h4.8" />
          }
          @case ('leaf') {
            <path d="M5 17.6C5 10.2 10.4 4.2 19.4 4.4 19.8 13.4 13.8 19 6.4 19" />
            <path d="M8.2 15.8 16.6 7.4" />
          }
          @case ('palette') {
            <circle cx="12" cy="12" r="8.2" />
            <circle cx="8.4" cy="10.2" r="1.15" />
            <circle cx="12" cy="7.8" r="1.15" />
            <circle cx="15.7" cy="10.2" r="1.15" />
            <circle cx="14.6" cy="14.8" r="1.15" />
          }
          @case ('mic') {
            <rect x="9" y="3.8" width="6" height="9.4" rx="3" />
            <path d="M6.6 11.4a5.4 5.4 0 0 0 10.8 0M12 16.8v3.4M8.4 20.2h7.2" />
          }
          @case ('shield') {
            <path d="M12 3.6 19.4 6.4v5.4c0 4.6-3 7.4-7.4 8.6C7.6 19.2 4.6 16.4 4.6 11.8V6.4z" />
            <path d="M12 8.2v7.2" />
          }
          @case ('pillar') {
            <path d="M5.2 7.2h13.6M6.4 7.2v10.2M17.6 7.2v10.2M4.4 17.4h15.2M7.8 20.2h8.4M8.8 7.2v10.2M12 7.2v10.2M15.2 7.2v10.2" />
          }
          @case ('building') {
            <path d="M5 20.2V7.4L12 3.8l7 3.6v12.8" />
            <path d="M10 20.2V13h4v7.2" />
            <path d="M8 10.2h.1M12 10.2h.1M16 10.2h.1M8 13.4h.1M16 13.4h.1" />
          }
          @case ('pill') {
            <path d="M8.6 15.4 15.4 8.6a3.4 3.4 0 1 1 4.8 4.8l-6.8 6.8a3.4 3.4 0 0 1-4.8-4.8z" />
            <path d="M10.4 13.6 13.6 10.4" />
          }
          @case ('tooth') {
            <path d="M7.2 5.6c1.6-1.4 3.2-.8 4.8-.8s3.2-.6 4.8.8c1.2 1 .8 3.2.2 4.6L15.4 20c-.4 1.2-2.2 1.2-2.6 0L12 16.2 11.2 20c-.4 1.2-2.2 1.2-2.6 0L7 10.2c-.6-1.4-1-3.6.2-4.6z" />
          }
          @case ('paw') {
            <circle cx="8" cy="8.2" r="1.7" />
            <circle cx="12" cy="6.6" r="1.7" />
            <circle cx="16" cy="8.2" r="1.7" />
            <path d="M8.2 13.4c1.2-1.8 6.4-1.8 7.6 0 1.4 2.1-.2 5.2-3.8 5.2s-5.2-3.1-3.8-5.2z" />
          }
          @case ('wrench') {
            <path d="M14.8 4.4a3.6 3.6 0 0 0-4.8 4.2L4.4 14.2a2.2 2.2 0 0 0 3.1 3.1l5.6-5.6a3.6 3.6 0 0 0 4.2-4.8l-2.2 2.2-2.1-2.1z" />
          }
          @case ('food') {
            <path d="M7 4.2v7.2c0 1.6-1.2 2.4-1.2 2.4v6M9.6 4.2v16M17.8 4.4c0 4.8-2.6 6.2-2.6 8.8v6.6" />
          }
          @case ('ball') {
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4c2.4 2.4 3.6 5.2 3.6 8s-1.2 5.6-3.6 8c-2.4-2.4-3.6-5.2-3.6-8s1.2-5.6 3.6-8z" />
            <path d="M4.8 9.6h14.4M4.8 14.4h14.4" />
          }
          @case ('microscope') {
            <path d="M8.4 20.2h9.2M10.2 17.4h5.6" />
            <path d="M13.2 14.6 16.8 8.4l2.2 1.4-3.6 6.2" />
            <circle cx="8.4" cy="10.8" r="2.6" />
            <path d="M8.4 13.4v4" />
          }
          @case ('earth') {
            <circle cx="12" cy="12" r="8" />
            <path d="M4.4 10.4h15.2M4.4 13.6h15.2M12 4c2.6 2.6 3.8 5.2 3.8 8s-1.2 5.4-3.8 8c-2.6-2.6-3.8-5.2-3.8-8s1.2-5.4 3.8-8z" />
          }
          @case ('people') {
            <circle cx="8.4" cy="8" r="2.3" />
            <path d="M4.4 16.8c.4-3 2-4.6 4-4.6s3.6 1.6 4 4.6" />
            <circle cx="15.8" cy="8.4" r="2.1" />
            <path d="M13.2 16.8c.3-2.4 1.6-3.8 2.6-3.8s2.6 1.4 3.2 3.8" />
          }
          @case ('brain') {
            <path
              d="M8.6 6.2a3.2 3.2 0 0 1 3.4-2 3.2 3.2 0 0 1 3.4 2 3 3 0 0 1 3 3.2 3.1 3.1 0 0 1-1.6 4.2 3 3 0 0 1-1.4 4.4H9.6A3 3 0 0 1 8.2 13.6 3.1 3.1 0 0 1 6.6 9.4 3 3 0 0 1 8.6 6.2z"
            />
            <path d="M12 4.8v13.6" />
          }
          @case ('hardhat') {
            <path d="M5 14.2h14v2.2H5z" />
            <path d="M6.4 14.2a5.6 5.6 0 0 1 11.2 0" />
            <path d="M11 7.2h2v3.2h-2z" />
          }
          @case ('dna') {
            <path d="M8 4.4c8 4.4 0 6.6 8 11.2M16 4.4C8 8.8 16 11 8 15.6" />
            <path d="M9.2 7.2h5.6M9.2 12h5.6M9.2 16.8h5.6" />
          }
          @case ('atom') {
            <circle cx="12" cy="12" r="1.4" />
            <ellipse cx="12" cy="12" rx="8.2" ry="3.2" />
            <ellipse cx="12" cy="12" rx="8.2" ry="3.2" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="8.2" ry="3.2" transform="rotate(-60 12 12)" />
          }
          @case ('calculator') {
            <rect x="6" y="3.6" width="12" height="16.8" rx="2" />
            <path d="M8.4 6.4h7.2v3.2H8.4zM8.6 12.2h.1M12 12.2h.1M15.4 12.2h.1M8.6 15.4h.1M12 15.4h.1M15.4 15.4h.1" />
          }
          @case ('chip') {
            <rect x="7.2" y="7.2" width="9.6" height="9.6" rx="1.4" />
            <path d="M12 4.2v3M12 16.8v3M4.2 12h3M16.8 12h3M7.4 6.2 6 4.8M16.6 6.2 18 4.8M7.4 17.8 6 19.2M16.6 17.8 18 19.2" />
          }
          @case ('exam') {
            <path d="M8 4.4h8.4a1.6 1.6 0 0 1 1.6 1.6v13.6H8A2.4 2.4 0 0 1 5.6 17.2V6.8A2.4 2.4 0 0 1 8 4.4z" />
            <path d="M9.4 9.2h6.4M9.4 12.4h6.4M9.4 15.6h4" />
          }
          @case ('cap') {
            <path d="M3.8 10.4 12 6.4l8.2 4-8.2 4z" />
            <path d="M7.4 12.2v4.2c1.6 1.2 3.2 1.8 4.6 1.8s3-.6 4.6-1.8v-4.2" />
            <path d="M20.2 10.6v5.2" />
          }
          @case ('briefcase') {
            <rect x="3.8" y="8.2" width="16.4" height="11" rx="1.8" />
            <path d="M9 8.2V6.6A1.8 1.8 0 0 1 10.8 4.8h2.4A1.8 1.8 0 0 1 15 6.6v1.6" />
            <path d="M3.8 12.8h16.4" />
          }
          @default {
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7.2v2.2M14.8 12A2.8 2.8 0 1 0 11.2 14.6M12 15.6v.1" />
          }
        }
      </svg>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      line-height: 0;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 2.15rem;
      height: 2.15rem;
      border-radius: 0.75rem;
      background: var(--wash, #e2e8f0);
      color: var(--ink, #475569);
    }
    .mark.xs {
      width: 1.05rem;
      height: 1.05rem;
      border-radius: 0.32rem;
    }
    .mark.sm {
      width: 1.4rem;
      height: 1.4rem;
      border-radius: 0.45rem;
    }
    .mark.lg {
      width: 2.7rem;
      height: 2.7rem;
      border-radius: 0.9rem;
    }
    svg {
      width: 62%;
      height: 62%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class NodeIconComponent {
  readonly node = input<IconableNode | null>(null);
  readonly size = input<'xs' | 'sm' | 'md' | 'lg'>('md');
  readonly spec = computed(() => iconForNode(this.node()));
}
