import { ListView } from './models';

/** Public link anyone can open to see and join the list. */
export function shareUrl(slug: string, origin = location.origin): string {
  return `${origin}/l/${slug}`;
}

/**
 * Private link that signs this person in on another device. The token sits in the URL fragment,
 * which browsers never send to servers.
 */
export function personalUrl(slug: string, token: string, origin = location.origin): string {
  return `${shareUrl(slug, origin)}#t=${encodeURIComponent(token)}`;
}

/** Reads (and validates) a token from a `#t=...` fragment. */
export function tokenFromFragment(hash: string): string | null {
  const match = /^#t=([A-Za-z0-9_\-%]{20,200})$/.exec(hash);
  return match ? decodeURIComponent(match[1]) : null;
}

export function inviteText(title: string, url: string): string {
  return `Pick yours for "${title}" 👉 ${url}`;
}

/** Opens WhatsApp (app on phones, web on desktop) with the text ready to send. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function canShareFiles(files: File[]): boolean {
  return (
    canNativeShare() && typeof navigator.canShare === 'function' && navigator.canShare({ files })
  );
}

/** Resolves to false if the person dismissed the share sheet or sharing isn't possible. */
export async function nativeShare(data: ShareData): Promise<boolean> {
  if (!canNativeShare()) {
    return false;
  }
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure contexts: fall back to a temporary text area.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}

/** Plain-text recap of who took what, formatted for pasting into a chat. */
export function buildSummary(view: ListView): string {
  const lines = [`*${view.title}*`];
  for (const item of view.items) {
    const stock = item.quantityLimit === null ? '' : ` / ${item.quantityLimit}`;
    const who = item.claims?.length
      ? ` — ${item.claims.map((c) => (c.quantity > 1 ? `${c.name} ×${c.quantity}` : c.name)).join(', ')}`
      : '';
    lines.push(`• ${item.name}: ${item.claimed}${stock}${who}`);
  }
  const people = view.participants?.filter((p) => !p.host || p.total > 0) ?? [];
  const waiting = people.filter((p) => p.total === 0).map((p) => p.name);
  lines.push('');
  const pickers = people.filter((p) => p.total > 0).length;
  lines.push(`${view.claimedTotal} picked by ${pickers} ${pickers === 1 ? 'person' : 'people'}`);
  if (waiting.length) {
    lines.push(`Not picked yet: ${waiting.join(', ')}`);
  }
  return lines.join('\n');
}
