import test from 'node:test';
import assert from 'node:assert/strict';
import { holderLanguages, normalizeLanguage, translateHolderText } from '../packages/ui/holder-i18n.js';
import { holderTranslations } from '../packages/ui/holder-translations.js';

test('Holder Center supports the five House languages with complete catalog rows', () => {
  assert.deepEqual(holderLanguages.map(item => item.id), ['en','zh','ja','hi','es']);
  for (const row of holderTranslations) {
    assert.equal(row.length, 5, row[0]);
    assert.ok(row.every(value => typeof value === 'string' && value.length > 0), row[0]);
    for (const value of row) assert.equal((value.match(/\{n\}/g) || []).length, (row[0].match(/\{n\}/g) || []).length, row[0]);
  }
});
test('invalid language falls back to English and original text is preserved', () => {
  assert.equal(normalizeLanguage('xx'), 'en');
  assert.equal(translateHolderText('Holder Center', 'xx'), 'Holder Center');
  assert.equal(translateHolderText('  WALLET STATUS\n', 'es'), '  ESTADO DE LA CARTERA\n');
});
test('each non-English language translates holder and bot interface independently', () => {
  for (const language of ['zh','ja','hi','es']) {
    assert.notEqual(translateHolderText('Holder Command Center.', language), 'Holder Command Center.');
    assert.notEqual(translateHolderText('RUN SIMULATION', language), 'RUN SIMULATION');
    assert.notEqual(translateHolderText('SIMULATED RESULT', language), 'SIMULATED RESULT');
  }
});
test('translated ascension templates preserve amounts and token symbols exactly', () => {
  for (const language of ['zh','ja','hi','es']) {
    const text = translateHolderText('80,000 $COFFERS threshold · contract verification required', language);
    assert.ok(text.includes('80,000 $COFFERS'));
    assert.notEqual(text, '80,000 $COFFERS threshold · contract verification required');
  }
});
test('contract addresses, protocol names and machine evidence remain unchanged', () => {
  for (const value of ['0x1234567890abcdef1234567890abcdef12345678','USDC','Morpho','Member','Builder','{"action":"DISCONNECT"}']) {
    for (const language of ['zh','ja','hi','es']) assert.equal(translateHolderText(value, language), value);
  }
});
