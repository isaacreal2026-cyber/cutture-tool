#!/usr/bin/env node
/** Crawlable public site — search engines must see facts, not an empty canvas. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
let failed = 0;
function check(name, cond, extra) {
  if (!cond) { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
  else console.log('PASS  ' + name);
}
function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }

const home = read('index.html');
const studio = read('studio.html');
const compare = read('compare.html');
const jersey = read('jersey.html');
const school = read('school.html');
const robots = read('robots.txt');
const sitemap = read('sitemap.xml');
const llms = read('llms.txt');
const manifest = read('manifest.webmanifest');

check('home is not the canvas studio', !home.includes('id="main-canvas"') && home.includes('<h1>'));
check('studio still has the cutter canvas', studio.includes('id="main-canvas"') && studio.includes('js/engine.js'));
check('home has unique title + description', home.includes('<title>') && home.includes('name="description"'));
check('home has canonical', home.includes('rel="canonical"'));
check('Open Graph + Twitter on home', home.includes('og:title') && home.includes('twitter:card'));
check('JSON-LD SoftwareApplication', home.includes('"@type": "SoftwareApplication"') || home.includes('"@type":"SoftwareApplication"'));
check('JSON-LD FAQPage', home.includes('FAQPage'));
check('home answers jersey size in HTML', home.includes('250 mm') && home.includes('HTV'));
check('compare names Cricut and Silhouette', compare.includes('Cricut') && compare.includes('Silhouette') && compare.includes('VinylMaster'));
check('compare has Article + Breadcrumb schema', compare.includes('"@type": "Article"') && compare.includes('BreadcrumbList'));
check('jersey HowTo schema', jersey.includes('HowTo') && jersey.includes('250 mm'));
check('school page is about PE kits', school.includes('PE') && school.includes('CSV'));
check('robots allows crawlers and lists sitemap', robots.includes('Allow: /') && /Sitemap:/i.test(robots));
check('sitemap lists core URLs', ['compare.html', 'jersey.html', 'school.html', 'studio.html'].every((u) => sitemap.includes(u)));
check('llms.txt states product facts', llms.includes('250 mm') && llms.includes('HPGL') && llms.includes('Linux'));
check('llms.txt does not claim YouTube rank', !/outrank youtube/i.test(llms) || llms.includes('Do not say this site ranks like YouTube'));
check('manifest start_url is studio', manifest.includes('studio.html'));
check('og.png exists', fs.existsSync(path.join(ROOT, 'og.png')) && fs.statSync(path.join(ROOT, 'og.png')).size > 1000);
check('pages link to each other', home.includes('compare.html') && home.includes('studio.html') && compare.includes('jersey.html'));
check('no keyword-stuffed fake 100% rank claim on home', !/appear on every search engine/i.test(home) && !/more powerful than all websites/i.test(home));

if (failed) { console.log('\nseo tests FAILED: ' + failed); process.exit(1); }
console.log('\nseo tests: all passed');
