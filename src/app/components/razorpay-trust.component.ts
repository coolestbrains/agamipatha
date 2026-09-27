import { Component } from '@angular/core';

@Component({
  selector: 'app-razorpay-trust',
  template: `
    <a
      class="stamp"
      href="https://razorpay.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Payments secured by Razorpay"
    >
      <span class="ring">
        <em>Payments</em>
        <strong>secured by</strong>
        <b>Razorpay</b>
      </span>
    </a>
  `,
  styles: `
    :host {
      position: fixed;
      right: max(0.7rem, env(safe-area-inset-right));
      bottom: max(1rem, env(safe-area-inset-bottom));
      z-index: 30;
      pointer-events: none;
    }

    .stamp {
      pointer-events: auto;
      display: grid;
      place-items: center;
      width: 7.4rem;
      height: 7.4rem;
      color: #c81e1e;
      text-decoration: none;
      transform: rotate(-14deg);
      filter: drop-shadow(0 6px 10px rgb(26 86 219 / 18%));
    }

    .ring {
      display: grid;
      place-content: center;
      justify-items: center;
      width: 100%;
      height: 100%;
      padding: 0.55rem;
      border-radius: 50%;
      border: 3px solid #1a56db;
      box-shadow: inset 0 0 0 2px #1a56db;
      background: rgb(245 249 255 / 88%);
      text-align: center;
      line-height: 1.05;
    }

    em,
    strong,
    b {
      font-style: normal;
      text-transform: uppercase;
    }

    em {
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.08em;
    }

    strong {
      margin-top: 0.12rem;
      font-size: 0.52rem;
      font-weight: 750;
      letter-spacing: 0.12em;
    }

    b {
      margin-top: 0.18rem;
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0.04em;
    }

    @media (max-width: 640px) {
      :host {
        right: max(0.4rem, env(safe-area-inset-right));
        bottom: max(0.7rem, env(safe-area-inset-bottom));
      }

      .stamp {
        width: 5.8rem;
        height: 5.8rem;
      }

      em {
        font-size: 0.52rem;
      }

      strong {
        font-size: 0.44rem;
      }

      b {
        font-size: 0.64rem;
      }
    }
  `,
})
export class RazorpayTrustComponent {}
