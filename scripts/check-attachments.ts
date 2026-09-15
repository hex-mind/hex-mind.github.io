import {
  composerAttachmentMime,
  decodeDataUrlToUtf8,
  isAllowedComposerAttachment,
  isImageAttachment,
  isMarkdownAttachment,
} from '../app/utils/attachments.ts';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(isImageAttachment('image/png', 'x.bin'), 'png mime');
assert(isImageAttachment('', 'shot.WEBP'), 'webp ext');
assert(!isImageAttachment('image/bmp', 'x.bmp'), 'bmp is not a composer image');

assert(isMarkdownAttachment('text/markdown', 'x.txt'), 'markdown mime');
assert(isMarkdownAttachment('', 'notes.md'), 'md ext');
assert(isMarkdownAttachment('text/plain', 'README.markdown'), 'plain + markdown ext');
assert(!isMarkdownAttachment('text/plain', 'notes.txt'), 'txt is not markdown');

assert(isAllowedComposerAttachment({ type: 'image/jpeg', name: 'a.jpg' }), 'jpeg file');
assert(isAllowedComposerAttachment({ type: '', name: 'spec.md' }), 'empty mime md');
assert(!isAllowedComposerAttachment({ type: 'application/pdf', name: 'a.pdf' }), 'pdf blocked');
assert(!isAllowedComposerAttachment({ type: 'text/plain', name: 'a.txt' }), 'txt blocked');

assert(composerAttachmentMime({ type: '', name: 'a.md' }) === 'text/markdown', 'normalize md mime');
assert(
  composerAttachmentMime({ type: 'image/png', name: 'a.png' }) === 'image/png',
  'keep png mime',
);
assert(
  composerAttachmentMime({ type: 'image/png', name: 'x.md' }) === 'image/png',
  'image mime wins over md ext',
);

const encoded = `data:text/markdown;base64,${Buffer.from('# 标题\n', 'utf8').toString('base64')}`;
assert(decodeDataUrlToUtf8(encoded) === '# 标题\n', 'decode utf8 markdown data url');

console.log('attachments.check ok');
