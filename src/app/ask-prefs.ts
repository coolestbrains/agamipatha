export type Audience = 'student' | 'guardian' | 'explore';

export interface AskPrefs {
  audience?: Audience;
  fromId?: string;
  toId?: string;
}

const ASK_KEY = 'agamipatha-ask';
const LEGACY_AUDIENCE_KEY = 'agamipatha-audience';

export function isAudience(value: unknown): value is Audience {
  return value === 'student' || value === 'guardian' || value === 'explore';
}

function askKey(accountId: string): string {
  return accountId ? `${ASK_KEY}:${accountId}` : ASK_KEY;
}

function parseAsk(raw: string | null): AskPrefs {
  if (!raw) {
    return {};
  }
  try {
    const data = JSON.parse(raw) as AskPrefs;
    return {
      audience: isAudience(data.audience) ? data.audience : undefined,
      fromId: typeof data.fromId === 'string' ? data.fromId : undefined,
      toId: typeof data.toId === 'string' ? data.toId : undefined,
    };
  } catch {
    return isAudience(raw) ? { audience: raw } : {};
  }
}

export function readAsk(accountId: string): AskPrefs {
  try {
    const legacy = sessionStorage.getItem(LEGACY_AUDIENCE_KEY);
    const guest = parseAsk(localStorage.getItem(ASK_KEY));
    const account = accountId ? parseAsk(localStorage.getItem(askKey(accountId))) : {};
    const fromLegacy = isAudience(legacy) ? { audience: legacy } : {};
    return { ...fromLegacy, ...guest, ...account };
  } catch {
    return {};
  }
}

export function persistAsk(accountId: string, patch: Partial<AskPrefs>): void {
  try {
    const next: AskPrefs = { ...readAsk(accountId), ...patch };
    if (!next.toId) {
      delete next.toId;
    }
    const raw = JSON.stringify(next);
    localStorage.setItem(ASK_KEY, raw);
    if (accountId) {
      localStorage.setItem(askKey(accountId), raw);
    }
    sessionStorage.removeItem(LEGACY_AUDIENCE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAsk(accountId: string): void {
  try {
    localStorage.removeItem(ASK_KEY);
    if (accountId) {
      localStorage.removeItem(askKey(accountId));
    }
    sessionStorage.removeItem(LEGACY_AUDIENCE_KEY);
  } catch {
    /* ignore */
  }
}
