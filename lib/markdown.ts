/**
 * Shared inline markdown renderer with DOMPurify sanitization.
 * Used by FloatingChatWidget and Conversation detail page.
 */

import DOMPurify from 'dompurify';

/**
 * Convert inline markdown to sanitized HTML.
 * Supports: **bold**, *italic*, `code`, [[conv:...]] links.
 */
export function inlineMd(text: string): string {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-white/[0.08] text-zinc-300 text-[13px] font-mono">$1</code>')
    .replace(
      /\[\[conv:([^:]+):(\d+):([^\]]+)\]\]/g,
      '<a data-conv-link="true" href="/conversations/$1?conversation_number=$2" class="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer">$3</a>'
    );

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'code', 'a'],
    ALLOWED_ATTR: ['class', 'href', 'data-conv-link'],
  });
}
