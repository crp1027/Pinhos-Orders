// Builds the single-page app from src/ into worker/app.html (Cloudflare) and dist/artifact.html (Claude version).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = f => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const ORDER = ['lib.js', 'pricing.js', 'store.js', 'ops.js', 'demo.js', 'print.js', 'ui1.js', 'ui2.js', 'ui3.js', 'ui4.js'];
const head = src('head.html');
const js = ORDER.map(f => src(f) + '\n').join('');
const boot = `
try {
  render(html\`<\${App} />\`, document.getElementById('root'));
  initStore().catch(e => { console.error(e); Store.status = 'nodb'; emit(); });
} catch (e) { console.error(e); document.getElementById('root').textContent = 'This page could not start: ' + e.message; }
`;
const lib = '<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.umd.js"></script>\n';
const appBody = '<div id="root"></div>\n' + lib + '<script>\n"use strict";\n' + js + boot + '</script>\n';
const cloud = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#FBF7F0">
${head}
</head><body>
<script>\n${src('cloud.js')}\n</script>
${appBody}</body></html>
`;
writeFileSync(new URL('./worker/app.html', import.meta.url), cloud);
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/artifact.html', import.meta.url), head + '\n' + appBody);
console.log('built worker/app.html', cloud.length, 'bytes');
