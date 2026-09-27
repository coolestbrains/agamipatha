import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink],
  template: `
    <section class="wrap">
      <p class="crumb"><a routerLink="/store">← Back to store</a></p>
      <h1>Privacy</h1>
      <p class="lede">How AgamiPatha uses the details you give us when you create an account or buy an ebook.</p>

      <article class="card body">
        <h2>Who we are</h2>
        <p>
          AgamiPatha is run by Smruti Ranjan Sahoo. This site helps you map Indian education routes and buy digital
          workbooks from the store.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>Name, email and/or mobile, and a password when you register at checkout</li>
          <li>Purchase records so you can download ebooks you paid for</li>
          <li>Path searches and optional catalogue suggestions you send</li>
          <li>Guest visit counts used in the site totals — once per browser and domain each day</li>
        </ul>

        <h2>Payments</h2>
        <p>
          Card, UPI, netbanking and wallet details are collected by Razorpay, not by AgamiPatha. We keep the Razorpay
          order and payment ids needed to confirm a paid download.
        </p>

        <h2>How we use it</h2>
        <p>
          To create your store account, complete checkout, let you sign in later, deliver PDFs, and improve the
          qualification map. We do not sell your contact details.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Account and purchase records stay until you ask us to remove them, or until they are no longer needed to
          prove a paid download. Passwords are stored hashed.
        </p>

        <h2>Your choices</h2>
        <p>
          You can log in to download books you bought. To correct or delete an account, write to
          <a href="mailto:admin&#64;agamipatha.com">admin&#64;agamipatha.com</a>.
        </p>

        <p class="updated">Last updated 15 September 2026.</p>
      </article>
    </section>
  `,
  styles: `
    .wrap {
      padding: 2rem max(1.5rem, env(safe-area-inset-right)) 3rem max(1.5rem, env(safe-area-inset-left));
      max-width: 40rem;
      margin-inline: auto;
      text-align: left;
    }
    .crumb { margin: 0 0 0.75rem; }
    .crumb a { color: var(--teal); text-decoration: none; font-weight: 650; font-size: 0.9rem; }
    h1 { font-family: var(--serif); font-size: clamp(1.8rem, 4vw, 2.5rem); margin: 0 0 0.6rem; text-align: left; }
    .lede { color: var(--muted); margin: 0 0 1.2rem; }
    .body { padding: 1.2rem 1.25rem 1.4rem; display: grid; gap: 0.65rem; }
    h2 { font-size: 0.95rem; margin: 0.45rem 0 0; text-align: left; }
    p, li { margin: 0; color: var(--ink); font-size: 0.95rem; line-height: 1.5; }
    ul { margin: 0; padding-left: 1.2rem; display: grid; gap: 0.35rem; }
    .updated { margin-top: 0.6rem; color: var(--muted); font-size: 0.8rem; }
  `,
})
export class PrivacyPageComponent {}
