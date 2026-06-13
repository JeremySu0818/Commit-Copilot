import { FINAL_COMMIT_MESSAGE_TOOL_NAME } from '../agent/tools/definitions';
import type { GitOperations } from '../git/git-operations';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  normalizeCommitOutputOptions,
} from '../models/options';

import { LOCALIZED_PROMPTS } from './prompts/index';
import type { EffectiveDisplayLanguage, LocalePromptBundle } from './types';

function getBundle(language?: EffectiveDisplayLanguage): LocalePromptBundle {
  const lang = language ?? 'en';
  return LOCALIZED_PROMPTS[lang];
}

function t(template: string, ...args: (string | number)[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const val = args.at(Number(index));
    return typeof val === 'undefined' ? match : String(val);
  });
}

const CONVENTIONAL_COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

function buildSubjectFormat(options: CommitOutputOptions): string {
  const base = options.includeScope
    ? 'type(scope): description'
    : 'type: description';
  return options.includeGitmoji ? `gitmoji ${base}` : base;
}

function getGitmojiGuide(bundle: LocalePromptBundle): string {
  return `${bundle.gitmojiGuideTitle}
${bundle.gitmojiGuideIntro}

${bundle.gitmojiTableHeader}
${bundle.gitmojiTableDivider}
| \`feat\` | ✨ | ${bundle.gitmojiUseFeat} |
| \`fix\` | 🐛 | ${bundle.gitmojiUseFix} |
| \`fix\` | 🚑️ | ${bundle.gitmojiUseHotfix} |
| \`fix\` | 🔒️ | ${bundle.gitmojiUseSecurity} |
| \`docs\` | 📝 | ${bundle.gitmojiUseDocs} |
| \`style\` | 💄 | ${bundle.gitmojiUseUiStyle} |
| \`style\` | 🎨 | ${bundle.gitmojiUseCodeStyle} |
| \`refactor\` | ♻️ | ${bundle.gitmojiUseRefactor} |
| \`perf\` | ⚡️ | ${bundle.gitmojiUsePerf} |
| \`test\` | ✅ | ${bundle.gitmojiUseTest} |
| \`build\` | 👷 | ${bundle.gitmojiUseBuild} |
| \`build\` | 📦️ | ${bundle.gitmojiUseDependency} |
| \`ci\` | 💚 | ${bundle.gitmojiUseCi} |
| \`chore\` | 🔧 | ${bundle.gitmojiUseChore} |
| \`revert\` | ⏪️ | ${bundle.gitmojiUseRevert} |`;
}

function getClassificationRules(bundle: LocalePromptBundle): string {
  return `${bundle.classificationRulesTitle}
${bundle.classificationRulesIntro}

${bundle.classificationRulesTableHeader}
${bundle.classificationRulesTableDivider}
| ${bundle.classificationRulesDocsRule} | \`docs\` |
| ${bundle.classificationRulesTestRule} | \`test\` |
| ${bundle.classificationRulesCiRule} | \`ci\` |
| ${bundle.classificationRulesBuildRule} | \`build\` |
| ${bundle.classificationRulesFeatRule} | \`feat\` |
| ${bundle.classificationRulesFixSecurityRule} | \`fix\` |
| ${bundle.classificationRulesFixBugRule} | \`fix\` |
| ${bundle.classificationRulesPerfRule} | \`perf\` |
| ${bundle.classificationRulesStyleRule} | \`style\` |
| ${bundle.classificationRulesRefactorRule} | \`refactor\` |
| ${bundle.classificationRulesChoreRule} | \`chore\` |

${bundle.criticalDistinctionsTitle}
${bundle.criticalDistinctionsChoreVsRefactor}
${bundle.criticalDistinctionsChoreVsStyle}
${bundle.criticalDistinctionsFeatVsRefactor}
${bundle.criticalDistinctionsSecurityFixes}`;
}

function buildScopeRule(
  options: CommitOutputOptions,
  bundle: LocalePromptBundle,
): string {
  const subjectFormat = buildSubjectFormat(options);
  if (options.includeScope) {
    const fallback = options.includeGitmoji
      ? 'gitmoji type: description'
      : 'type: description';
    return t(bundle.ruleScopeMandatory, subjectFormat, fallback);
  }
  const fallback = options.includeGitmoji
    ? 'gitmoji type(scope): ...'
    : 'type(scope): ...';
  return t(bundle.ruleScopeForbidden, subjectFormat, fallback);
}

function buildBodyAndFooterRule(
  options: CommitOutputOptions,
  bundle: LocalePromptBundle,
): string {
  if (options.includeBody && options.includeFooter) {
    return bundle.ruleBodyAndFooterMandatory;
  }
  if (options.includeBody && !options.includeFooter) {
    return bundle.ruleBodyMandatoryFooterForbidden;
  }
  if (!options.includeBody && options.includeFooter) {
    return bundle.ruleBodyForbiddenFooterMandatory;
  }
  return bundle.ruleBodyAndFooterForbidden;
}

function buildCommitLayout(
  options: CommitOutputOptions,
  bundle: LocalePromptBundle,
): string {
  const subject = buildSubjectFormat(options);
  const explanation = bundle.layoutExplanatoryText;
  if (options.includeScope && options.includeBody && options.includeFooter) {
    return `${subject}

${explanation}

Refs: #123`;
  }
  if (options.includeScope && options.includeBody && !options.includeFooter) {
    return `${subject}

${explanation}`;
  }
  if (options.includeScope && !options.includeBody && options.includeFooter) {
    return `${subject}

Refs: #123`;
  }
  if (options.includeScope && !options.includeBody && !options.includeFooter) {
    return subject;
  }
  if (!options.includeScope && options.includeBody && options.includeFooter) {
    return `${subject}

${explanation}

Refs: #123`;
  }
  if (!options.includeScope && options.includeBody && !options.includeFooter) {
    return `${subject}

${explanation}`;
  }
  if (!options.includeScope && !options.includeBody && options.includeFooter) {
    return `${subject}

Refs: #123`;
  }
  return subject;
}

function buildGitmojiRule(
  options: CommitOutputOptions,
  bundle: LocalePromptBundle,
): string {
  if (options.includeGitmoji) {
    return bundle.ruleGitmojiMandatory;
  }
  return bundle.ruleEmojisForbidden;
}

function buildOutputFormatRules(
  options: CommitOutputOptions,
  bundle: LocalePromptBundle,
): string {
  const commitTypes = CONVENTIONAL_COMMIT_TYPES.map(
    (type) => `\`${type}\``,
  ).join(', ');
  const strictRules = [
    options.includeGitmoji
      ? t(bundle.ruleStrictRuleFirstLineGitmoji, commitTypes)
      : t(bundle.ruleStrictRuleFirstLineCommitType, commitTypes),
    buildScopeRule(options, bundle),
    bundle.ruleStrictRuleMaxChars,
    buildBodyAndFooterRule(options, bundle),
    buildGitmojiRule(options, bundle),
    bundle.ruleStrictRuleNoMarkdownCodeBlocks,
  ];

  const gitmojiSection = options.includeGitmoji
    ? `${getGitmojiGuide(bundle)}\n\n`
    : '';
  const firstCharRule = options.includeGitmoji
    ? bundle.outputFormatFirstCharGitmoji
    : bundle.outputFormatFirstCharCommitType;

  return `${bundle.outputFormatRulesTitle}

${gitmojiSection}### ${bundle.outputFormatStrictRulesTitle}
${strictRules.map((rule, index) => `${String(index + 1)}. ${rule}`).join('\n')}

### ${bundle.outputFormatRequiredLayoutTitle}
${buildCommitLayout(options, bundle)}

### ${bundle.outputFormatCriticalConstraintTitle}
${bundle.outputFormatCriticalConstraintBody}
${bundle.outputFormatNoAnalysis}
${bundle.outputFormatNoBulletPoints}
${bundle.outputFormatNoPrecede}
${bundle.outputFormatNoFollow}
${firstCharRule}
${bundle.outputFormatParseable}

${bundle.outputFormatViolatingRule}`;
}

export function buildCommitOutputReminder(
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  language?: EffectiveDisplayLanguage,
): string {
  const bundle = getBundle(language);
  const options = normalizeCommitOutputOptions(commitOutputOptions);
  const subjectFormat = `\`${buildSubjectFormat(options)}\``;
  const scopeRule = options.includeScope
    ? bundle.reminderScopeMandatory
    : bundle.reminderScopeForbidden;
  const bodyRule = options.includeBody
    ? bundle.reminderBodyMandatory
    : bundle.reminderBodyForbidden;
  const footerRule = options.includeFooter
    ? bundle.reminderFooterMandatory
    : bundle.reminderFooterForbidden;
  const gitmojiRule = options.includeGitmoji
    ? bundle.reminderGitmojiMandatory
    : bundle.reminderEmojisForbidden;

  return `${bundle.reminderEntireOutputMessage} ${t(bundle.reminderFirstLineFormat, subjectFormat)} ${scopeRule} ${bodyRule} ${footerRule} ${gitmojiRule} ${bundle.reminderNoAnalysis}`;
}

export function buildFinalOutputReminder(
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  language?: EffectiveDisplayLanguage,
): string {
  const bundle = getBundle(language);
  return `${t(bundle.reminderExhaustedSteps, FINAL_COMMIT_MESSAGE_TOOL_NAME)} ${buildCommitOutputReminder(
    commitOutputOptions,
    language,
  )}`;
}

export function buildFinalToolRequiredReminder(
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  language?: EffectiveDisplayLanguage,
): string {
  const bundle = getBundle(language);
  return `${t(bundle.reminderFinalToolRequired, FINAL_COMMIT_MESSAGE_TOOL_NAME)} ${buildCommitOutputReminder(
    commitOutputOptions,
    language,
  )}`;
}

export function buildAgentSystemPrompt(options: {
  includeFindReferences: boolean;
  enableTools?: boolean;
  commitOutputOptions?: CommitOutputOptions;
  maxAgentSteps?: number;
  language?: EffectiveDisplayLanguage;
}): string {
  const bundle = getBundle(options.language);
  const commitOutputOptions = normalizeCommitOutputOptions(
    options.commitOutputOptions,
  );

  const maxAgentStepsLine =
    typeof options.maxAgentSteps === 'number' && options.maxAgentSteps > 0
      ? t(bundle.workflowWithToolsMaxSteps, String(options.maxAgentSteps))
      : '';

  const scopeWorkflowLine = commitOutputOptions.includeScope
    ? bundle.workflowNoToolsScopeMandatory
    : bundle.workflowNoToolsScopeForbidden;

  const outputRules = `${getClassificationRules(bundle)}

${buildOutputFormatRules(commitOutputOptions, bundle)}`;

  if (options.enableTools === false) {
    return `${bundle.systemPromptIntroNoTools}

${bundle.commitLanguagePrompt}

${bundle.promptInjectionTitle}
${bundle.promptInjectionBodyNoTools}

${bundle.workflowTitle}
${bundle.workflowNoToolsReviewDiff}
${bundle.workflowNoToolsClassify}
${scopeWorkflowLine}
${bundle.workflowNoToolsOutputOnly}

${outputRules}`;
  }

  const toolLines = [
    bundle.toolDescGetDiff,
    bundle.toolDescReadFile,
    bundle.toolDescGetFileOutline,
  ];
  if (options.includeFindReferences) {
    toolLines.push(bundle.toolDescFindReferences);
  }
  toolLines.push(
    bundle.toolDescGetRecentCommits,
    bundle.toolDescSearchCode,
    t(bundle.toolDescWriteCommitMessage, FINAL_COMMIT_MESSAGE_TOOL_NAME),
  );

  const usageLines = [bundle.toolUseReadFile, bundle.toolUseGetFileOutline];
  if (options.includeFindReferences) {
    usageLines.push(bundle.toolUseFindReferences);
  }
  usageLines.push(
    bundle.toolUseGetRecentCommits,
    bundle.toolUseSearchCode,
    bundle.toolUseCombine,
    t(bundle.toolUseSubmit, FINAL_COMMIT_MESSAGE_TOOL_NAME),
  );

  const investigationTools = options.includeFindReferences
    ? '`get_diff`, `read_file`, `get_file_outline`, `find_references`, `search_code`'
    : '`get_diff`, `read_file`, `get_file_outline`, `search_code`';

  const workflowLines = [
    t(bundle.workflowWithToolsInvestigate, investigationTools),
    ...(maxAgentStepsLine ? [`2. ${maxAgentStepsLine}`] : []),
    t(bundle.workflowWithToolsRecentCommits, maxAgentStepsLine ? '3' : '2'),
    t(bundle.workflowWithToolsClassify, maxAgentStepsLine ? '4' : '3'),
    t(
      options.commitOutputOptions?.includeScope
        ? bundle.workflowWithToolsScopeMandatory
        : bundle.workflowWithToolsScopeForbidden,
      maxAgentStepsLine ? '5' : '4',
    ),
    t(
      bundle.workflowWithToolsSubmit,
      maxAgentStepsLine ? '6' : '5',
      FINAL_COMMIT_MESSAGE_TOOL_NAME,
    ),
  ];

  return `${bundle.systemPromptIntroWithTools}

${bundle.commitLanguagePrompt}

${bundle.limitedInfoTitle}
${bundle.limitedInfoBody}

${bundle.promptInjectionTitle}
${bundle.promptInjectionBodyWithTools}

${bundle.availableToolsTitle}
${bundle.availableToolsIntro}
${toolLines.join('\n')}

${bundle.availableToolsNotLimited}
${usageLines.join('\n')}

${bundle.workflowTitle}
${workflowLines.join('\n')}

${outputRules}`;
}

export function formatDraftCommitMessageSection(
  draftCommitMessage?: string,
  language?: EffectiveDisplayLanguage,
): string {
  const bundle = getBundle(language);
  const draft = draftCommitMessage?.trim();
  if (!draft) {
    return '';
  }

  return `
${bundle.contextDraftCommitMessageHeader}

${bundle.contextDraftCommitMessageWarning}

<scm-draft-commit-message>
${draft}
</scm-draft-commit-message>`;
}

async function formatCommitHistory(
  gitOps?: GitOperations,
  language?: EffectiveDisplayLanguage,
): Promise<string> {
  const bundle = getBundle(language);
  if (!gitOps) {
    return bundle.historyCannotDetermine;
  }
  const count = await gitOps.getCommitCount();
  if (count === null) {
    return bundle.historyCannotDetermine;
  }
  if (count === 0) {
    return bundle.historyNoCommitsYet;
  }
  if (count === 1) {
    return bundle.historyHasCommitsSingular;
  }
  return t(bundle.historyHasCommitsPlural, String(count));
}

export async function buildInitialContext(
  diff: string,
  repoRoot: string,
  gitOps?: GitOperations,
  isStaged = true,
  enableTools = true,
  commitOutputOptions: CommitOutputOptions = DEFAULT_COMMIT_OUTPUT_OPTIONS,
  draftCommitMessage?: string,
  language?: EffectiveDisplayLanguage,
  projectStructureGetter?: (
    repoRoot: string,
    gitOps?: GitOperations,
    lang?: EffectiveDisplayLanguage,
  ) => Promise<string>,
  parseDiffSummaryFn?: (
    diff: string,
  ) => { path: string; type: string; added: number; removed: number }[],
): Promise<string> {
  const bundle = getBundle(language);
  const resolvedCommitOutputOptions =
    normalizeCommitOutputOptions(commitOutputOptions);

  const fileSummary = parseDiffSummaryFn ? parseDiffSummaryFn(diff) : [];
  const projectTree = projectStructureGetter
    ? await projectStructureGetter(repoRoot, gitOps, language)
    : '';
  const commitHistory = await formatCommitHistory(gitOps, language);
  const draftCommitMessageSection = formatDraftCommitMessageSection(
    draftCommitMessage,
    language,
  );

  const changedFilesSection = fileSummary
    .map(
      (f) =>
        `  [${f.type.toUpperCase()}] ${f.path}  (+${String(f.added)} / -${String(f.removed)} lines)`,
    )
    .join('\n');

  const header = isStaged
    ? bundle.contextStagedChangesSummary
    : bundle.contextUnstagedChangesSummary;

  if (!enableTools) {
    return `${header}

${bundle.contextModifiedFilesIntro}

${changedFilesSection}

${bundle.contextProjectStructureHeader}

${projectTree}

${bundle.contextCommitHistoryHeader}

${commitHistory}
${draftCommitMessageSection}

---

${bundle.contextEndGivenDiffNoTools}

${buildCommitOutputReminder(resolvedCommitOutputOptions, language)}`;
  }

  const toolList =
    '`get_diff`, `read_file`, `get_file_outline`, `find_references`, and `search_code`';

  return `${header}

${bundle.contextModifiedFilesIntro}

${changedFilesSection}

${bundle.contextProjectStructureHeader}

${projectTree}

${bundle.contextCommitHistoryHeader}

${commitHistory}
${draftCommitMessageSection}

---

${t(bundle.contextEndGivenNoDiffWithTools, toolList)}

${buildCommitOutputReminder(resolvedCommitOutputOptions, language)}`;
}

export function buildDirectDiffUserPrompt(
  diff: string,
  draftCommitMessage?: string,
  language?: EffectiveDisplayLanguage,
): string {
  const bundle = getBundle(language);
  const draftSection = formatDraftCommitMessageSection(
    draftCommitMessage,
    language,
  );
  return `${draftSection ? draftSection + '\n\n' : ''}${bundle.directDiffPromptPrefix}\n\n${diff}`;
}

export function buildOllamaEnhancedPrompt(
  initialContext: string,
  diff: string,
  language?: EffectiveDisplayLanguage,
): string {
  const bundle = getBundle(language);
  return `${initialContext}\n\n${bundle.ollamaFullDiffHeading}\n\n${diff}`;
}

export function formatProjectStructureTruncated(
  maxFiles: number,
  language?: EffectiveDisplayLanguage,
): string {
  return t(getBundle(language).projectStructureTruncated, String(maxFiles));
}
