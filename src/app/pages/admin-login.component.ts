import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule],
  template: `
    <section class="wrap">
      <h1>Admin sign-in</h1>
      <p>
        Manage qualifications, professions, and the store. Sign in with the admin store account.
        Change that password under Users after the first login.
      </p>
      <form class="card form" (ngSubmit)="submit()">
        <label>
          <span>Email or admin</span>
          <input type="text" name="login" [(ngModel)]="login" autocomplete="username" />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" />
        </label>
        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }
        <button class="primary" type="submit">Sign in</button>
      </form>
    </section>
  `,
  styles: `
    .wrap { padding: 2rem 1.5rem; max-width: 28rem; margin-inline: auto; text-align: center; }
    h1 { font-family: var(--serif); }
    .form { padding: 1.2rem; display: grid; gap: 0.8rem; }
    label span { display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem; }
    input { width: 100%; padding: 0.65rem 0.8rem; border-radius: 0.7rem; border: 1px solid var(--line-strong); font: inherit; background: var(--paper); }
    .form-error { color: var(--danger); margin: 0; font-weight: 600; }
  `,
})
export class AdminLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  login = 'admin@agamipatha.com';
  password = '';
  error = signal('');

  submit(): void {
    this.error.set('');
    this.auth.login(this.login.trim() || 'admin@agamipatha.com', this.password).subscribe({
      next: () => void this.router.navigate(['/admin/nodes']),
      error: () => this.error.set('Wrong email or password.'),
    });
  }
}
