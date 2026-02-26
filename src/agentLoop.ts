import {
    executeToolCall,
    buildInitialContext,
    toGeminiFunctionDeclarations,
    toOpenAITools,
    toAnthropicTools,
} from "./agentTools";
import { APIProvider, DEFAULT_MODELS, OLLAMA_DEFAULT_HOST } from "./models";
import {
    APIKeyMissingError,
    APIKeyInvalidError,
    APIQuotaExceededError,
    APIRequestError,
    NoChangesError,
} from "./errors";
import { ProgressCallback } from "./llmClients";

const MAX_AGENT_STEPS = Infinity;

const AGENT_SYSTEM_PROMPT = `You are a senior software engineer acting as an autonomous commit message agent.
You have access to tools that let you inspect the repository to make informed decisions.

## IMPORTANT: You receive LIMITED information initially
You are given ONLY the names of changed files, line counts, and the project structure.
You do NOT see the actual changes. You MUST use your tools to investigate before classifying.

## Required Workflow
1. **First**: Call \`get_diff\` with a specific file path for each changed file you want to investigate.
   You MUST provide the \`path\` argument — calling \`get_diff\` without a path is NOT allowed.
   Prioritize the most important or ambiguous files. You do NOT need to inspect every file if the changes are clearly related.
2. **Then**: If the diff is ambiguous (e.g., lines removed but unclear if comments or logic),
   call \`read_file\` to see the full file context around the changes.
3. **Optionally**: Call \`get_file_outline\` to understand a file's role in the project.
4. **Finally**: Only after sufficient investigation, output the commit message.

## Classification Rules (STRICT)
Apply these rules IN ORDER. The first matching rule wins:

| Condition | Type |
|-----------|------|
| Only adds/updates \`.md\`, \`.txt\`, JSDoc/docstrings, or documentation files | \`docs\` |
| Only adds/modifies test files (\`*.test.*\`, \`*.spec.*\`, \`__tests__/\`) | \`test\` |
| Only changes CI config (\`.github/workflows\`, \`.gitlab-ci.yml\`, Jenkinsfile) | \`ci\` |
| Only changes build config (\`webpack\`, \`esbuild\`, \`tsconfig\`, \`Dockerfile\`, \`Makefile\`) | \`build\` |
| Adds a new user-facing feature or capability | \`feat\` |
| Fixes a bug (corrects incorrect behavior) | \`fix\` |
| Improves performance without changing behavior | \`perf\` |
| Changes ONLY whitespace, formatting, semicolons, trailing commas (no logic change) | \`style\` |
| Restructures existing code logic WITHOUT changing external behavior | \`refactor\` |
| Everything else: deleting comments, removing dead code, removing console.log, updating dependencies, renaming without logic change, housekeeping | \`chore\` |

### Critical Distinctions
- **chore vs refactor**: If the ONLY change is removing comments, TODO notes, console.logs, unused imports, or deprecated dead code — this is \`chore\`, NOT \`refactor\`. \`refactor\` requires restructuring of actual program logic (e.g., extracting functions, reorganizing class hierarchy).
- **chore vs style**: Removing comments is \`chore\`. Reformatting existing code (indentation, bracket style) is \`style\`.
- **feat vs refactor**: If the change exposes new functionality to the user/API, it's \`feat\`. If it only reorganizes internals, it's \`refactor\`.

## Output Format
- Conventional Commits: \`type(scope): description\`
- First line max 72 characters, ideally under 50
- Optional body and footer
- English only, no emojis
- Do NOT wrap in markdown code blocks
- Do NOT output explanations — ONLY the commit message`;


interface AgentLoopOptions {
    provider: APIProvider;
    apiKey: string;
    model?: string;
    diff: string;
    repoRoot: string;
    onProgress?: ProgressCallback;
}

export async function runAgentLoop(
    options: AgentLoopOptions,
): Promise<string> {
    const { provider, apiKey, model, diff, repoRoot, onProgress } = options;

    switch (provider) {
        case "google":
            return runGeminiAgentLoop(apiKey, model, diff, repoRoot, onProgress);
        case "openai":
            return runOpenAIAgentLoop(apiKey, model, diff, repoRoot, onProgress);
        case "anthropic":
            return runAnthropicAgentLoop(apiKey, model, diff, repoRoot, onProgress);
        case "ollama":
            return runOllamaAgentLoop(model, diff, repoRoot, onProgress);
        default:
            throw new Error(`Unsupported provider for agent loop: ${provider}`);
    }
}

async function runGeminiAgentLoop(
    apiKey: string,
    model: string | undefined,
    diff: string,
    repoRoot: string,
    onProgress?: ProgressCallback,
): Promise<string> {
    if (!apiKey) {
        throw new APIKeyMissingError();
    }
    if (!diff.trim()) {
        throw new NoChangesError();
    }

    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const client = new GoogleGenerativeAI(apiKey);
        const modelName = (model || DEFAULT_MODELS.google).replace(
            /^models\//,
            "",
        );

        const generativeModel = client.getGenerativeModel({
            model: modelName,
            systemInstruction: AGENT_SYSTEM_PROMPT,
            tools: [
                {
                    functionDeclarations:
                        toGeminiFunctionDeclarations() as any,
                },
            ],
        });

        const initialContext = buildInitialContext(diff, repoRoot);
        const chat = generativeModel.startChat({ history: [] });

        if (onProgress) {
            onProgress("🧠 Agent analyzing changes...");
        }

        let response = await chat.sendMessage(initialContext);
        let step = 0;

        while (step < MAX_AGENT_STEPS) {
            const candidate = response.response.candidates?.[0];
            if (!candidate) {
                throw new APIRequestError("Empty response from Gemini API");
            }

            const functionCalls = candidate.content?.parts?.filter(
                (p: any) => p.functionCall,
            );

            if (!functionCalls || functionCalls.length === 0) {
                const text = response.response.text();
                if (!text) {
                    throw new APIRequestError("Empty text response from Gemini API");
                }
                return text.trim();
            }

            const toolResults: any[] = [];
            for (const part of functionCalls) {
                const fc = (part as any).functionCall;
                if (onProgress) {
                    onProgress(`🔍 [Step ${step + 1}] ${fc.name}(${JSON.stringify(fc.args || {}).substring(0, 80)})`);
                }

                const result = executeToolCall(
                    { name: fc.name, arguments: fc.args || {} },
                    repoRoot,
                    diff,
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
            "You have used all available investigation steps. Based on what you've gathered, output the final commit message now.",
        );
        const text = finalResponse.response.text();
        return text?.trim() || "chore: update files";
    } catch (error: any) {
        if (
            error instanceof NoChangesError ||
            error instanceof APIKeyMissingError
        ) {
            throw error;
        }
        const message = error?.message || String(error);
        if (
            message.includes("API_KEY_INVALID") ||
            message.includes("401") ||
            message.includes("403")
        ) {
            throw new APIKeyInvalidError(message);
        } else if (message.includes("429") || message.includes("quota")) {
            throw new APIQuotaExceededError(message);
        }
        throw new APIRequestError(message);
    }
}

async function runOpenAIAgentLoop(
    apiKey: string,
    model: string | undefined,
    diff: string,
    repoRoot: string,
    onProgress?: ProgressCallback,
): Promise<string> {
    if (!apiKey) {
        throw new APIKeyMissingError();
    }
    if (!diff.trim()) {
        throw new NoChangesError();
    }

    try {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey });
        const modelName = model || DEFAULT_MODELS.openai;

        const initialContext = buildInitialContext(diff, repoRoot);

        const messages: any[] = [
            { role: "system", content: AGENT_SYSTEM_PROMPT },
            { role: "user", content: initialContext },
        ];

        if (onProgress) {
            onProgress("🧠 Agent analyzing changes...");
        }

        let step = 0;

        while (step < MAX_AGENT_STEPS) {
            const completion = await client.chat.completions.create({
                model: modelName,
                messages,
                tools: toOpenAITools() as any,
                tool_choice: "auto",
            });

            const choice = completion.choices[0];
            if (!choice) {
                throw new APIRequestError("Empty response from OpenAI API");
            }

            const assistantMessage = choice.message;
            messages.push(assistantMessage);

            if (
                choice.finish_reason === "tool_calls" &&
                assistantMessage.tool_calls &&
                assistantMessage.tool_calls.length > 0
            ) {
                for (const toolCall of assistantMessage.tool_calls) {
                    const args = JSON.parse(toolCall.function.arguments || "{}");
                    if (onProgress) {
                        onProgress(`🔍 [Step ${step + 1}] ${toolCall.function.name}(${JSON.stringify(args).substring(0, 80)})`);
                    }

                    const result = executeToolCall(
                        { name: toolCall.function.name, arguments: args },
                        repoRoot,
                        diff,
                    );

                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: result.content,
                    });
                }
                step++;
            } else {
                const text = assistantMessage.content;
                if (!text) {
                    throw new APIRequestError("Empty text response from OpenAI API");
                }
                return text.trim();
            }
        }

        messages.push({
            role: "user",
            content:
                "You have used all available investigation steps. Output the final commit message now.",
        });
        const finalCompletion = await client.chat.completions.create({
            model: modelName,
            messages,
        });
        const text = finalCompletion.choices[0]?.message?.content;
        return text?.trim() || "chore: update files";
    } catch (error: any) {
        if (
            error instanceof NoChangesError ||
            error instanceof APIKeyMissingError
        ) {
            throw error;
        }
        const message = error?.message || String(error);
        const status = error?.status;
        if (
            status === 401 ||
            status === 403 ||
            message.includes("Invalid API Key")
        ) {
            throw new APIKeyInvalidError(message);
        } else if (status === 429 || message.includes("rate limit")) {
            throw new APIQuotaExceededError(message);
        }
        throw new APIRequestError(message);
    }
}


async function runAnthropicAgentLoop(
    apiKey: string,
    model: string | undefined,
    diff: string,
    repoRoot: string,
    onProgress?: ProgressCallback,
): Promise<string> {
    if (!apiKey) {
        throw new APIKeyMissingError();
    }
    if (!diff.trim()) {
        throw new NoChangesError();
    }

    try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });
        const modelName = model || DEFAULT_MODELS.anthropic;

        const initialContext = buildInitialContext(diff, repoRoot);

        const messages: any[] = [
            { role: "user", content: initialContext },
        ];

        if (onProgress) {
            onProgress("🧠 Agent analyzing changes...");
        }

        let step = 0;

        while (step < MAX_AGENT_STEPS) {
            const response = await client.messages.create({
                model: modelName,
                max_tokens: 4096,
                system: AGENT_SYSTEM_PROMPT,
                messages,
                tools: toAnthropicTools() as any,
            });

            const textBlocks = response.content.filter(
                (b: any) => b.type === "text",
            );
            const toolUseBlocks = response.content.filter(
                (b: any) => b.type === "tool_use",
            );

            if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
                const text = textBlocks.map((b: any) => b.text).join("");
                if (!text) {
                    throw new APIRequestError("Empty response from Anthropic API");
                }
                return text.trim();
            }

            messages.push({ role: "assistant", content: response.content });

            const toolResults: any[] = [];
            for (const block of toolUseBlocks) {
                const toolUse = block as any;
                if (onProgress) {
                    onProgress(`🔍 [Step ${step + 1}] ${toolUse.name}(${JSON.stringify(toolUse.input || {}).substring(0, 80)})`);
                }

                const result = executeToolCall(
                    { name: toolUse.name, arguments: toolUse.input || {} },
                    repoRoot,
                    diff,
                );

                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: result.content,
                });
            }

            messages.push({ role: "user", content: toolResults });
            step++;
        }

        messages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: "You have used all available investigation steps. Output the final commit message now.",
                },
            ],
        });
        const finalResponse = await client.messages.create({
            model: modelName,
            max_tokens: 4096,
            system: AGENT_SYSTEM_PROMPT,
            messages,
        });
        const text = finalResponse.content
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
        return text?.trim() || "chore: update files";
    } catch (error: any) {
        if (
            error instanceof NoChangesError ||
            error instanceof APIKeyMissingError
        ) {
            throw error;
        }
        const message = error?.message || String(error);
        const status = error?.status;
        if (
            status === 401 ||
            status === 403 ||
            message.includes("invalid_api_key")
        ) {
            throw new APIKeyInvalidError(message);
        } else if (status === 429 || message.includes("rate_limit")) {
            throw new APIQuotaExceededError(message);
        }
        throw new APIRequestError(message);
    }
}

async function runOllamaAgentLoop(
    model: string | undefined,
    diff: string,
    repoRoot: string,
    onProgress?: ProgressCallback,
): Promise<string> {
    if (!diff.trim()) {
        throw new NoChangesError();
    }

    try {
        const { Ollama } = await import("ollama");
        const client = new Ollama({ host: OLLAMA_DEFAULT_HOST });
        const modelName = model || DEFAULT_MODELS.ollama;

        const pullStream = await client.pull({ model: modelName, stream: true });
        let lastPercent = 0;
        for await (const part of pullStream) {
            if (part.total && part.completed) {
                const percent = Math.round((part.completed / part.total) * 100);
                if (percent > lastPercent) {
                    const increment = percent - lastPercent;
                    lastPercent = percent;
                    if (onProgress) {
                        onProgress(
                            `Pulling ${modelName}: ${part.status} (${percent}%)`,
                            increment,
                        );
                    }
                }
            } else if (part.status && onProgress) {
                onProgress(`Pulling ${modelName}: ${part.status}`);
            }
        }

        if (onProgress) {
            onProgress("Generating commit message...", 0);
        }

        const initialContext = buildInitialContext(diff, repoRoot);
        const enhancedPrompt = `${initialContext}\n\n## Full Diff (provided inline for local model)\n\n${diff}`;

        const response = await client.chat({
            model: modelName,
            messages: [
                { role: "system", content: AGENT_SYSTEM_PROMPT },
                { role: "user", content: enhancedPrompt },
            ],
            options: {
                temperature: 0.7,
                top_p: 0.95,
            },
        });

        const text = response.message?.content;
        if (!text) {
            throw new APIRequestError("Empty response from Ollama");
        }
        return text.trim();
    } catch (error: any) {
        if (error instanceof NoChangesError) {
            throw error;
        }
        const message = error?.message || String(error);
        if (message.includes("ECONNREFUSED") || message.includes("connect")) {
            throw new APIRequestError(
                `Cannot connect to Ollama. Make sure Ollama is running at ${OLLAMA_DEFAULT_HOST}`,
            );
        } else if (message.includes("model") && message.includes("not found")) {
            throw new APIRequestError(
                `Model "${model || DEFAULT_MODELS.ollama}" not found. Please pull it first.`,
            );
        }
        throw new APIRequestError(message);
    }
}