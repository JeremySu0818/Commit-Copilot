import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentSystemPrompt,
  buildCommitOutputReminder,
  buildFinalOutputReminder,
} from '../../agent-loop/shared';

test('buildAgentSystemPrompt requires scope and body by default', () => {
  const prompt = buildAgentSystemPrompt({
    includeFindReferences: false,
    enableTools: false,
  });

  assert.match(prompt, /type\(scope\): description/);
  assert.match(prompt, /Scope is MANDATORY/);
  assert.match(prompt, /Body is MANDATORY/);
  assert.match(prompt, /Footer is FORBIDDEN/);
});

test('buildAgentSystemPrompt forbids scope when includeScope is false', () => {
  const prompt = buildAgentSystemPrompt({
    includeFindReferences: false,
    enableTools: false,
    commitOutputOptions: {
      includeScope: false,
      includeBody: true,
      includeFooter: false,
    },
  });

  assert.match(prompt, /type: description/);
  assert.match(prompt, /Scope is FORBIDDEN/);
  assert.match(
    prompt,
    /Do NOT choose a scope\. The subject line must omit scope parentheses\./,
  );
});

test('buildAgentSystemPrompt enforces footer-only layout when body is disabled', () => {
  const prompt = buildAgentSystemPrompt({
    includeFindReferences: true,
    commitOutputOptions: {
      includeScope: true,
      includeBody: false,
      includeFooter: true,
    },
  });

  assert.match(prompt, /Body is FORBIDDEN and footer is MANDATORY/);
  assert.match(prompt, /type\(scope\): description\n\nRefs: #123/);
});

test('reminder builders reflect selected commit output options', () => {
  const options = {
    includeScope: false,
    includeBody: false,
    includeFooter: false,
  };
  const reminder = buildCommitOutputReminder(options);
  const finalReminder = buildFinalOutputReminder(options);

  assert.match(reminder, /First-line format: `type: description`/);
  assert.match(reminder, /Scope parentheses are FORBIDDEN/);
  assert.match(reminder, /A body section is FORBIDDEN/);
  assert.match(reminder, /Footer lines are FORBIDDEN/);
  assert.match(finalReminder, /Output ONLY the final commit message now\./);
});
