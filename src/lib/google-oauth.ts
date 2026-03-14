import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

type PublicConfig = {
  googleClientId?: string;
};

const normalizeGoogleClientId = (value?: string) => {
  const clientId = (value || '').trim();
  if (!clientId || clientId.includes('your-google-client-id-here')) {
    return '';
  }
  return clientId;
};

export function useGoogleOAuthConfig() {
  const query = useQuery({
    queryKey: ['public-config'],
    queryFn: () => api<PublicConfig>('/api/public-config'),
  });

  const googleClientId = normalizeGoogleClientId(query.data?.googleClientId);

  return {
    ...query,
    googleClientId,
    isGoogleOAuthEnabled: googleClientId.length > 0,
  };
}
