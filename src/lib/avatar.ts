import type { User } from '@shared/types';

export function getUserAvatarUrl(user?: Pick<User, 'avatar' | 'email' | 'name'> | null) {
  if (user?.avatar) return user.avatar;

  const seed = (user?.email || user?.name || 'booking-user').trim().toLowerCase();
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}
