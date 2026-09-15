const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MARKDOWN_MIMES = new Set(['text/markdown', 'text/x-markdown']);
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
const MARKDOWN_EXT = /\.(md|markdown)$/i;

export const COMPOSER_ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp,text/markdown,text/x-markdown,.md,.markdown';

function mimeOf(mime: string) {
  return mime.trim().toLowerCase();
}

export function isImageAttachment(mime: string, filename = '') {
  const type = mimeOf(mime);
  return IMAGE_MIMES.has(type) || IMAGE_EXT.test(filename);
}

export function isMarkdownAttachment(mime: string, filename = '') {
  const type = mimeOf(mime);
  if (MARKDOWN_MIMES.has(type)) return true;
  return MARKDOWN_EXT.test(filename);
}

export function isAllowedComposerAttachment(file: { type?: string; name?: string }) {
  const mime = file.type ?? '';
  const name = file.name ?? '';
  return isImageAttachment(mime, name) || isMarkdownAttachment(mime, name);
}

export function composerAttachmentMime(file: { type?: string; name?: string }) {
  const name = file.name ?? '';
  const type = mimeOf(file.type ?? '');
  if (IMAGE_MIMES.has(type)) return type;
  if (isMarkdownAttachment(file.type ?? '', name)) return 'text/markdown';
  return file.type || 'application/octet-stream';
}

export function decodeDataUrlToUtf8(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return '';
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const binary = /;base64/i.test(header) ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return new TextDecoder().decode(bytes);
}
