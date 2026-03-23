import {
  executeToolCall,
  buildInitialContext,
  toGeminiFunctionDeclarations,
} from '../agent-tools';
import { DEFAULT_MODELS } from '../models';
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  APIQuotaExceededError,
  APIRequestError,
  NoChangesError,
} from '../errors';
import { ProgressCallback } from '../llm-clients';
import { GitOperations } from '../commit-copilot';
import {
  buildAgentSystemPrompt,
  extractCommitMessage,
  formatBatchProgressMessage,
  MAX_AGENT_STEPS,
} from './shared';

async function runGeminiAgentLoop(
  apiKey: string,
  model: string | undefined,
  diff: string,
  repoRoot: string,
  onProgress?: ProgressCallback,
  isStaged: boolean = true,
  gitOps?: GitOperations,
): Promise<string> {
  if (!apiKey) {
    throw new APIKeyMissingError();
  }
  if (!diff.trim()) {
    throw new NoChangesError();
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const client = new GoogleGenerativeAI(apiKey);
    const modelName = (model || DEFAULT_MODELS.google).replace(/^models\//, '');

    const systemPrompt = buildAgentSystemPrompt({
      includeFindReferences: true,
    });
    const generativeModel = client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations: toGeminiFunctionDeclarations(isStaged) as any,
        },
      ],
    });

    const initialContext = await buildInitialContext(
      diff,
      repoRoot,
      gitOps,
      isStaged,
    );
    const chat = generativeModel.startChat({ history: [] });

    if (onProgress) {
      onProgress('Agent analyzing changes...');
    }

    let response = await chat.sendMessage(initialContext);
    let step = 0;

    while (step < MAX_AGENT_STEPS) {
      const candidate = response.response.candidates?.[0];
      if (!candidate) {
        throw new APIRequestError('Empty response from Gemini API');
      }

      const functionCalls = candidate.content?.parts?.filter(
        (p: any) => p.functionCall,
      );

      if (!functionCalls || functionCalls.length === 0) {
        const text = response.response.text();
        if (!text) {
          throw new APIRequestError('Empty text response from Gemini API');
        }
        return extractCommitMessage(text);
      }

      const toolResults: any[] = [];
      if (onProgress && functionCalls.length > 0) {
        const calls = functionCalls.map((p: any) => ({
          name: p.functionCall.name,
          args: p.functionCall.args || {},
        }));
        onProgress(formatBatchProgressMessage(step + 1, calls));
      }

      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const result = await executeToolCall(
          { name: fc.name, arguments: fc.args || {} },
          repoRoot,
          diff,
          isStaged,
          gitOps,
        );

        toolResults.push({
          functionResponse: {
            name: fc.name,
            response: { content: result.content },
          },
        });
      }

      response = await chat.sendMessage(toolResults);
      step++;
    }

    const finalResponse = await chat.sendMessage(
      'You have used all available investigation steps. Output ONLY the final commit message now in type(scope): description format. Scope parentheses are MANDATORY. Do NOT include any explanation or analysis — just the commit message.',
    );
    const text = finalResponse.response.text();
    return text ? extractCommitMessage(text) : 'chore(project): update files';
  } catch (error: any) {
    if (
      error instanceof NoChangesError ||
      error instanceof APIKeyMissingError
    ) {
      throw error;
    }
    const message = error?.message || String(error);
    if (
      message.includes('API_KEY_INVALID') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      throw new APIKeyInvalidError(message);
    } else if (message.includes('429') || message.includes('quota')) {
      throw new APIQuotaExceededError(message);
    }
    throw new APIRequestError(message);
  }
}


export { runGeminiAgentLoop };
