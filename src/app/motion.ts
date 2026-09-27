import { animate, group, query, style, transition, trigger } from '@angular/animations';

const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const overlayMotion = trigger('overlayMotion', [
  transition(':enter', [
    group([
      query('.scrim', [style({ opacity: 0 }), animate(`240ms ${ease}`, style({ opacity: 1 }))]),
      query('.panel', [
        style({ transform: 'translateY(12px) scale(0.985)', opacity: 0 }),
        animate(`420ms ${ease}`, style({ transform: 'none', opacity: 1 })),
      ]),
    ]),
  ]),
  transition(':leave', [
    group([
      query('.scrim', [animate('200ms ease', style({ opacity: 0 }))]),
      query('.panel', [animate(`280ms ${ease}`, style({ transform: 'translateY(10px) scale(0.99)', opacity: 0 }))]),
    ]),
  ]),
]);

/** Light fade only — avoid transforming the heavy details panel on close. */
export const detailOverlayMotion = trigger('detailOverlayMotion', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(`180ms ${ease}`, style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('120ms ease', style({ opacity: 0 })),
  ]),
]);

export const stepSwap = trigger('stepSwap', [
  transition('* => *', [
    style({ opacity: 0, transform: 'translateY(14px) scale(0.98)' }),
    animate(`420ms ${ease}`, style({ opacity: 1, transform: 'none' })),
  ]),
]);
