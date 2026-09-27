import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from './environment';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  ask(
    message: string,
    history: ChatTurn[],
    context: { nodeId?: string; fromId?: string; toId?: string },
  ): Observable<ChatReply> {
    return this.http.post<ChatReply>(`${this.base}/chat`, {
      message,
      history,
      nodeId: context.nodeId || undefined,
      fromId: context.fromId || undefined,
      toId: context.toId || undefined,
    });
  }
}
