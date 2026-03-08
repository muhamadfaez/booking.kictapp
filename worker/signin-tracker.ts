import type { UserRole } from '@shared/types';
import type { Env } from './core-utils';

const SIGNIN_KEY = 'analytics:signins:24h';
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 5;

export type SignInMethod = 'OTP' | 'GOOGLE';

export type SignInRecord = {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  method: SignInMethod;
  signedInAt: number;
};

type SignInStore = {
  items: SignInRecord[];
};

const dedupeAndPrune = (items: SignInRecord[], now: number): SignInRecord[] => {
  const cutoff = now - WINDOW_MS;
  const fresh = items.filter((item) => item.signedInAt >= cutoff);
  const byUser = new Map<string, SignInRecord>();
  for (const item of fresh) {
    const prev = byUser.get(item.userId);
    if (!prev || item.signedInAt > prev.signedInAt) {
      byUser.set(item.userId, item);
    }
  }
  return Array.from(byUser.values()).sort((a, b) => b.signedInAt - a.signedInAt);
};

export async function recordSignIn(env: Env, item: SignInRecord): Promise<void> {
  const globalDO = env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName('GlobalDurableObject'));

  for (let i = 0; i < MAX_RETRIES; i++) {
    const now = Date.now();
    const doc = await globalDO.getDoc<SignInStore>(SIGNIN_KEY);
    const version = doc?.v ?? 0;
    const existing = doc?.data?.items ?? [];
    const nextItems = dedupeAndPrune(
      [
        ...existing,
        item,
      ],
      now
    );
    const result = await globalDO.casPut(SIGNIN_KEY, version, { items: nextItems });
    if (result.ok) return;
  }
  throw new Error('Failed to record sign-in');
}

export async function getRecentSignIns(env: Env): Promise<SignInRecord[]> {
  const globalDO = env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName('GlobalDurableObject'));

  for (let i = 0; i < MAX_RETRIES; i++) {
    const now = Date.now();
    const doc = await globalDO.getDoc<SignInStore>(SIGNIN_KEY);
    const version = doc?.v ?? 0;
    const existing = doc?.data?.items ?? [];
    const nextItems = dedupeAndPrune(existing, now);

    // Keep storage compact/pruned; ignore CAS contention and retry.
    const result = await globalDO.casPut(SIGNIN_KEY, version, { items: nextItems });
    if (result.ok) return nextItems;
  }

  const fallback = await globalDO.getDoc<SignInStore>(SIGNIN_KEY);
  return dedupeAndPrune(fallback?.data?.items ?? [], Date.now());
}
