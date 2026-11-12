import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'commerce');
const target = path.join(root, 'shop-worker', 'public');
fs.rmSync(target, {recursive:true, force:true});
fs.mkdirSync(target, {recursive:true});

const html = fs.readFileSync(path.join(source,'index.html'),'utf8')
  .replaceAll('href="/"','href="https://dreamprotocol.ai/"')
  .replaceAll('href="/contact/"','href="https://dreamprotocol.ai/contact/"')
  .replaceAll('/commerce/shop.css','/shop.css')
  .replaceAll('/commerce/shop.js','/shop.js');
const js = fs.readFileSync(path.join(source,'shop.js'),'utf8')
  .replaceAll('/commerce/catalog.json','/catalog.json');
const catalog = JSON.parse(fs.readFileSync(path.join(source,'catalog.json'),'utf8'));
if (!Array.isArray(catalog.products) || !catalog.products.length) throw Error('Missing catalog candidates');
if (catalog.products.some(p=>p.checkoutUrl || p.supplierVerified || p.status !== 'research')) throw Error('Never publish unverified sale offers');
if (!html.includes('No products are available for checkout yet.')) throw Error('Missing honest checkout disclosure');
fs.writeFileSync(path.join(target,'index.html'),html);
fs.writeFileSync(path.join(target,'shop.js'),js);
fs.writeFileSync(path.join(target,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
fs.copyFileSync(path.join(source,'shop.css'),path.join(target,'shop.css'));
fs.copyFileSync(path.join(root,'favicon.svg'),path.join(target,'favicon.svg'));
console.log('Standalone Dream Commerce assets built safely. Checkout disabled.');
