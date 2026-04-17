import assert from 'node:assert/strict';
import test from 'node:test';

import { GenerationStateManager, ValidationStateManager } from '../state';

const expectedListenerCalls = 2;

void test('GenerationStateManager notifies listeners on state change', () => {
  let called = 0;
  const listener = () => {
    called++;
  };

  GenerationStateManager.addListener(listener);
  GenerationStateManager.setGenerating(true);
  GenerationStateManager.setGenerating(false);
  GenerationStateManager.removeListener(listener);

  assert.equal(GenerationStateManager.isGenerating, false);
  assert.equal(called, expectedListenerCalls);
});

void test('ValidationStateManager tracks provider and notifies listeners', () => {
  let called = 0;
  const listener = () => {
    called++;
  };

  ValidationStateManager.addListener(listener);
  ValidationStateManager.setValidating(true, 'openai');
  assert.equal(ValidationStateManager.isValidating, true);
  assert.equal(ValidationStateManager.validatingProvider, 'openai');

  ValidationStateManager.setValidating(false, null);
  ValidationStateManager.removeListener(listener);

  assert.equal(ValidationStateManager.isValidating, false);
  assert.equal(ValidationStateManager.validatingProvider, null);
  assert.equal(called, expectedListenerCalls);
});
