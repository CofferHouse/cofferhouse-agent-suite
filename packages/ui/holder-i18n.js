import { holderTranslations } from './holder-translations.js';

export const holderLanguages = Object.freeze([
  { id: 'en', label: 'English', locale: 'en' },
  { id: 'zh', label: '中文', locale: 'zh-CN' },
  { id: 'ja', label: '日本語', locale: 'ja' },
  { id: 'hi', label: 'हिन्दी', locale: 'hi' },
  { id: 'es', label: 'Español', locale: 'es' }
]);
export const normalizeLanguage = value => holderLanguages.some(item => item.id === value) ? value : 'en';
const clean = text => text.replace(/\s+/g, ' ').trim();
const catalog = new Map(holderTranslations.map(row => [clean(row[0]).toLowerCase(), row]));
const templates = holderTranslations.filter(row => /\{(?:n|name|path)\}/.test(row[0])).map(row => {
  const tokens = [];
  const escaped = row[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\\\{(n|name|path)\\\}/g, (_, token) => {
    tokens.push(token);
    return token === 'n' ? '([0-9.,]+)' : '(.+?)';
  });
  return { row, tokens, pattern: new RegExp(`^${pattern}$`, 'i') };
});
export function translateHolderText(text, language = 'en') {
  const lang = normalizeLanguage(language);
  if (lang === 'en' || !text.trim()) return text;
  const index = holderLanguages.findIndex(item => item.id === lang);
  const key = clean(text);
  let value = catalog.get(key.toLowerCase())?.[index];
  if (!value) {
    // Only catalogued templates are interpolated. Addresses, evidence and values are never rewritten.
    for (const { row, pattern } of templates) {
      const match = key.match(pattern);
      if (!match) continue;
      let position = 1;
      value = row[index].replace(/\{(?:n|name|path)\}/g, () => match[position++]);
      break;
    }
  }
  if (!value && key.includes('. ')) {
    // Some views join a capability description and a second sentence in one text node.
    const pieces = text.split(/(?<=[.!?])(?=\s+[A-Z])/);
    if (pieces.length > 1) return pieces.map(piece => translateHolderText(piece, lang)).join('');
  }
  if (!value) return text;
  return text.replace(/\S[\s\S]*\S|\S/, value);
}

export function createHolderI18n({ root, storage, document: doc = root.ownerDocument }) {
  let language = 'en';
  try { language = normalizeLanguage(storage.getItem('cofferhouse-language')); } catch { /* Browser storage is optional. */ }
  const originals = new WeakMap();
  const attributes = new WeakMap();
  let scheduled = false;
  const skip = element => !element || element.closest('script,style,code,pre,textarea,input,svg,.brand-name,[data-no-translate]');
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') originals.set(record.target, record.target.nodeValue);
      if (record.type === 'attributes') attributes.get(record.target)?.delete(record.attributeName);
    }
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => { scheduled = false; apply(); });
    }
  });
  function apply() {
    observer.disconnect();
    doc.documentElement.lang = holderLanguages.find(item => item.id === language).locale;
    const walker = doc.createTreeWalker(root, 4);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (skip(node.parentElement)) continue;
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      node.nodeValue = translateHolderText(originals.get(node), language);
    }
    for (const element of root.querySelectorAll('[aria-label],[placeholder],[title]')) {
      if (element.closest('script,style,code,pre,textarea,svg,.brand-name,[data-no-translate]')) continue;
      let values = attributes.get(element);
      if (!values) { values = new Map(); attributes.set(element, values); }
      for (const name of ['aria-label', 'placeholder', 'title']) {
        if (!element.hasAttribute(name)) continue;
        if (!values.has(name)) values.set(name, element.getAttribute(name));
        element.setAttribute(name, translateHolderText(values.get(name), language));
      }
    }
    const picker = root.querySelector('#holder-language');
    if (picker) picker.value = language;
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label','placeholder','title'] });
  }
  root.addEventListener('change', event => {
    if (event.target.id !== 'holder-language') return;
    language = normalizeLanguage(event.target.value);
    try { storage.setItem('cofferhouse-language', language); } catch { /* Keep selection for this session. */ }
    apply();
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true });
  return {
    apply,
    get language() { return language; },
    picker: () => `<label class="holder-language"><span>LANGUAGE</span><select id="holder-language" aria-label="Select language" data-no-translate>${holderLanguages.map(item => `<option value="${item.id}"${language === item.id ? ' selected' : ''}>${item.label}</option>`).join('')}</select></label>`
  };
}
