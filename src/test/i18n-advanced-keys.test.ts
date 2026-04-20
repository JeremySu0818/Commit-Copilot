import assert from 'node:assert/strict';
import test from 'node:test';

import { LOCALES } from '../i18n/locales';

void test('all locales include advanced feature i18n keys', () => {
  for (const [localeCode, bundle] of Object.entries(LOCALES)) {
    assert.equal(
      typeof bundle.webviewLanguagePack.sections.advancedFeatures,
      'string',
      `${localeCode}: sections.advancedFeatures`,
    );
    assert.equal(
      typeof bundle.webviewLanguagePack.buttons.openAdvancedFeatures,
      'string',
      `${localeCode}: buttons.openAdvancedFeatures`,
    );
    assert.equal(
      typeof bundle.webviewLanguagePack.descriptions
        .advancedFeaturesDescription,
      'string',
      `${localeCode}: descriptions.advancedFeaturesDescription`,
    );
    assert.equal(
      typeof bundle.webviewLanguagePack.descriptions.rewriteWorkflowDescription,
      'string',
      `${localeCode}: descriptions.rewriteWorkflowDescription`,
    );
  }
});

void test('rewrite recovery commands do not depend on leading whitespace indentation', () => {
  for (const [localeCode, bundle] of Object.entries(LOCALES)) {
    const rendered = bundle.extensionText.output.rewriteRecoveryCommand(
      'git push --force-with-lease',
    );
    assert.doesNotMatch(rendered, /^\s/, `${localeCode}: leading whitespace`);
    assert.match(rendered, /^• /, `${localeCode}: bullet prefix`);
  }
});
