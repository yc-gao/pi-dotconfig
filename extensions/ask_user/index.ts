import type { AgentToolResult, ExtensionAPI, ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";

import { AskUserParamsSchema, type AskUserParams, AskUserDetails } from "./types";
import { SelectList } from "./SelectList.ts"

function buildResult(text: string, details: AskUserDetails): AgentToolResult<AskUserDetails> {
    return {
        content: [
            { type: 'text', text },
        ],
        details
    }
}

function buildOkResult(text: string, params: AskUserParams, answers: string[]) {
    return buildResult(text, { params, state: 'ok', answers });
}

function buildCancelledResult(params: AskUserParams) {
    return buildResult("User cancelled.", { params, state: 'cancelled' })
}

async function executeFreeText(
    params: AskUserParams,
    ctx: ExtensionToolContext,
    signal?: AbortSignal,
): Promise<AgentToolResult<AskUserDetails>> {
    const answer = await ctx.ui.input(params.question, undefined, { signal });
    if (answer === undefined) {
        return buildCancelledResult(params);
    }
    return buildOkResult(`User answered: ${answer.trim()}`, params, [answer])
}

async function executeSelect(
    params: AskUserParams,
    ctx: ExtensionToolContext,
    signal?: AbortSignal,
): Promise<AgentToolResult<AskUserDetails>> {
    const answer = await ctx.ui.select(params.question, params.options as string[], { signal })
    if (answer === undefined) {
        return buildCancelledResult(params);
    }
    return buildOkResult(`User selected: ${answer}`, params, [answer]);
}

async function executeMultiSelect(
    params: AskUserParams,
    ctx: ExtensionToolContext,
    signal?: AbortSignal,
): Promise<AgentToolResult<AskUserDetails>> {
    // TODO: support signal
    const answers = await ctx.ui.custom<string[] | undefined>((tui, theme, keybindings, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("accent", params.question), 0, 1));
        const selectList = new SelectList(params.options ?? [],
            {
                selectedItem: (text) => theme.fg("accent", text),
                noMatch: (text) => theme.fg("warning", text),
                dim: (text) => theme.fg("dim", text),
            },
            keybindings)
        selectList.onSubmit = (selected: string[]) => { done(selected) }
        selectList.onCancel = () => { done(undefined) }
        container.addChild(selectList);

        return {
            render(width: number): string[] {
                return container.render(width);
            },
            handleInput(data: string) {
                selectList.handleInput(data);
                tui.requestRender();
            },
            invalidate() { return container.invalidate(); }
        }
    });

    if (answers === undefined) {
        return buildCancelledResult(params);
    }
    return buildOkResult(`User selected:\n${answers.map((answer) => `- ${answer}`).join("\n")}`, params, answers);
}

export default function (pi: ExtensionAPI) {
    pi.registerTool({
        name: "ask_user",
        label: "Ask User",
        executionMode: "sequential",
        description:
            "Ask the user a question and wait for their answer. Supports `text` free-text input, `single` one choice from `options`, and `multi` multiple choices from `options` (terminal UI only). Returns a cancelled state when the user dismisses the prompt.",
        promptSnippet:
            "Ask the user a question (free-text, single-select, or multi-select) and wait for the answer",
        promptGuidelines: [
            "Use ask_user when a decision, preference, or missing detail must come from the human and cannot be inferred from the repository or the conversation.",
            "When calling ask_user, pass `type: \"single\"` or `type: \"multi\"` with an `options` list instead of asking a numbered-options question in plain text.",
            "Use ask_user with `type: \"single\"` or `type: \"multi\"` rather than guessing when a command would be destructive or ambiguous; ask_user results report `state` as `ok`, `cancelled`, or `error` separately, so handle cancellation instead of assuming an answer.",
            "Use generate_file_from_input instead of ask_user when the user wants a file whose content they will type themselves; do not guess or invent that content.",
        ],
        parameters: AskUserParamsSchema,

        async execute(_toolCallId, params: AskUserParams, signal: AbortSignal | undefined, _onUpdate, ctx: ExtensionToolContext): Promise<AgentToolResult<AskUserDetails>> {
            if (!ctx.hasUI) {
                throw new Error("The 'ask_user' tool requires an interactive UI to be available.")
            }
            if (params.type === "multi" && ctx.mode !== "tui") {
                throw new Error("The 'ask_user' tool only supports multi-select when the interactive terminal UI is in use.")
            }
            if (params.type !== "text" && !params.options?.length) {
                throw new Error("The 'ask_user' tool requires `options` when `type` is `single` or `multi`.")
            }

            if (signal?.aborted) {
                return buildResult("User cancelled.", { params, state: 'cancelled' })
            }


            if (params.type === "text") {
                return await executeFreeText(params, ctx, signal);
            }
            if (params.type === "single") {
                return await executeSelect(params, ctx, signal);
            }
            return await executeMultiSelect(params, ctx, signal);
        }
    })
}