import MarkdownIt from 'markdown-it';
import { isLikelyInlineMath, markdownKatexPlugin } from './markdownKatex.ts';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const md = new MarkdownIt({ html: false, breaks: true }).use(markdownKatexPlugin);

assert(isLikelyInlineMath('x'), '$x$ should count as math');
assert(isLikelyInlineMath('F'), '$F$ should count as math');
assert(!isLikelyInlineMath('100'), '$100 stays text');
assert(!isLikelyInlineMath('HOME'), '$HOME stays text');

const display = md.render('$$SS_{A}^{marg} = |P_{A+B,\\mu},y|^2$$');
assert(display.includes('katex'), 'display math should use katex');
assert(!display.includes('<em>'), 'latex subscripts should not become markdown emphasis');

const inline = md.render('energy $E=mc^2$ holds');
assert(inline.includes('katex'), 'inline $...$ should use katex');

const money = md.render('costs $100$ today');
assert(!money.includes('katex'), '$100 should stay text');

const env = md.render('see $HOME$');
assert(!env.includes('katex'), '$HOME should stay text');

const paren = md.render('inline \\(a_{b}\\) math');
assert(paren.includes('katex'), '\\(...\\) should use katex');

const unclosed = md.render('$$not finished');
assert(!unclosed.includes('katex'), 'unclosed $$ should stay text');

const fenced = md.render('```\n$x$\n```');
assert(!fenced.includes('katex'), 'math inside fences should stay code');

console.log('markdownKatex self-check ok');
