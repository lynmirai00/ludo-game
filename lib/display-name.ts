// The name shown in the top bar and publicly on the leaderboards. Pure, shared by browser and server.
// Never an email address: see "Display name" in docs/02-zitadel.md.

export type ProfileClaims = { name?: unknown; preferred_username?: unknown };

export function displayName(profile: ProfileClaims, sub: string): string {
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  if (name && !name.includes('@')) return name;

  const username = typeof profile.preferred_username === 'string' ? profile.preferred_username.trim() : '';
  const local = username.split('@')[0]?.trim() ?? '';
  if (local) return local;

  // Neither claim is usable: an anonymous but stable handle derived from the ID, never text to translate.
  return `#${sub.slice(-6)}`;
}
