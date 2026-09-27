import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CareerService } from '../career.service';
import { ChatService, ChatTurn } from '../chat.service';

@Component({
  selector: 'app-chat-widget',
  imports: [FormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrl: './chat-widget.component.scss',
})
export class ChatWidgetComponent {
  private readonly chatApi = inject(ChatService);
  private readonly career = inject(CareerService);
  private readonly router = inject(Router);

  @ViewChild('thread') thread?: ElementRef<HTMLElement>;
  @ViewChild('box') box?: ElementRef<HTMLTextAreaElement>;

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly draft = signal('');
  readonly error = signal('');
  readonly messages = signal<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Hi — ask anything. I can help with careers, exams, and the path you are planning, or general questions.',
    },
  ]);

  toggle(): void {
    this.open.update((v) => !v);
    if (!this.open()) {
      return;
    }
    queueMicrotask(() => this.box?.nativeElement.focus());
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.busy()) {
      return;
    }
    this.draft.set('');
    this.error.set('');
    this.messages.update((rows) => [...rows, { role: 'user', text }]);
    this.busy.set(true);
    this.scrollSoon();

    const history: ChatTurn[] = this.messages()
      .slice(1, -1)
      .map((m) => ({ role: m.role, content: m.text }));

    const tree = this.router.parseUrl(this.router.url);
    this.chatApi
      .ask(text, history, {
        nodeId: this.career.detailNode()?.id,
        fromId: tree.queryParams['from'],
        toId: tree.queryParams['to'],
      })
      .subscribe({
        next: (res) => {
          this.messages.update((rows) => [...rows, { role: 'assistant', text: res.reply }]);
          this.busy.set(false);
          this.scrollSoon();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Could not reach the assistant. Try again in a moment.';
          this.error.set(msg);
          this.busy.set(false);
        },
      });
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollSoon(): void {
    queueMicrotask(() => {
      const el = this.thread?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
