export function tokenUnexpired(token: string, skewMs = 5_000): boolean {
  const value = token.trim();
  if (!value) {
    return false;
  }

  const payload = decodeJwtPayload(value);
  if (!payload) {
    return false;
  }
  const exp = payload['exp'];
  if (typeof exp !== 'number') {
    return true;
  }
  return exp * 1000 > Date.now() + skewMs;
}

export function buyerIdFromToken(token: string): string {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return '';
  }
  const keys = [
    'nameid',
    'sub',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    'http://schemas.microsoft.com/identity/claims/objectidentifier',
  ];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) {
    return null;
  }
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
  try {
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
