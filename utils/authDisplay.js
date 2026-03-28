/**
 * Helpers to show how the user signed in (Supabase user.identities), similar to the Supabase dashboard.
 */

const PROVIDER_META = {
  google: { key: 'google', label: 'Google', icon: 'logo-google', color: '#4285F4' },
  apple: { key: 'apple', label: 'Apple', icon: 'logo-apple', color: '#111827' },
  email: { key: 'email', label: 'Email', icon: 'mail-outline', color: '#6B7280' },
  phone: { key: 'phone', label: 'Phone', icon: 'call-outline', color: '#6B7280' },
  facebook: { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  github: { key: 'github', label: 'GitHub', icon: 'logo-github', color: '#24292F' },
  twitter: { key: 'twitter', label: 'Twitter', icon: 'logo-twitter', color: '#1DA1F2' },
  discord: { key: 'discord', label: 'Discord', icon: 'logo-discord', color: '#5865F2' },
  slack: { key: 'slack', label: 'Slack', icon: 'logo-slack', color: '#4A154B' },
  spotify: { key: 'spotify', label: 'Spotify', icon: 'musical-notes-outline', color: '#1DB954' },
  twitch: { key: 'twitch', label: 'Twitch', icon: 'logo-twitch', color: '#9146FF' },
  azure: { key: 'azure', label: 'Microsoft', icon: 'logo-microsoft', color: '#0078D4' },
  linkedin: { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', color: '#0A66C2' },
};

function metaForProvider(provider) {
  const p = String(provider || '').toLowerCase().trim();
  if (PROVIDER_META[p]) return PROVIDER_META[p];
  const label = p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Other';
  return { key: p || 'unknown', label, icon: 'key-outline', color: '#6B7280' };
}

/**
 * Unique linked providers in stable order (Supabase identities order).
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 */
export function getLinkedIdentityProviders(user) {
  if (!user) return [];
  const identities = user.identities;
  if (!Array.isArray(identities) || identities.length === 0) {
    const fallback = user.app_metadata?.provider || user.user_metadata?.provider;
    if (fallback) return [metaForProvider(fallback)];
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const id of identities) {
    const raw = id.provider;
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(metaForProvider(raw));
  }
  return out;
}

/**
 * Primary email or phone for display.
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 */
export function getAccountIdentifier(user) {
  if (!user) return '';
  if (user.email) return user.email;
  if (user.phone) return user.phone;
  const meta =
    user.user_metadata?.email ||
    user.user_metadata?.phone ||
    user.user_metadata?.full_name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  return '';
}

/**
 * Short label string like "Google, Email" for compact UI.
 */
export function formatProvidersLabel(providers, maxLen = 42) {
  if (!providers?.length) return '';
  const s = providers.map((p) => p.label).join(', ');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
