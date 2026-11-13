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

async function executeFreeText(
    params: AskUserParams,
    ctx: ExtensionToolContext,
    signal: AbortSignal,
): Promise<AgentToolResult<AskUserDetails>> {
    const answer = await ctx.ui.input(params.question, undefined, { signal });
    if (answer === undefined) {
        return buildResult("User cancelled.", params)
    }
    return buildResult(`User answered: ${answer.trim()}`, params);
}

async function executeSelect(
    params: AskUserParams,
    ctx: ExtensionToolContext,
    signal: AbortSignal,
): Promise<AgentToolResult<AskUserDetails>> {
    const answer = await ctx.ui.select(params.question, params.options ?? [], { signal })
    if (answer === undefined) {
        return buildResult("User cancelled.", params)
    }
    return buildResult(`User selected: ${answer}`, params);
}

async function executeMultiSelect(
    params: AskUserParams,
    ctx: ExtensionToolContext,
    signal: AbortSignal,
): Promise<AgentToolResult<AskUserDetails>> {
    if (signal.aborted) {
        return buildResult("User cancelled.", params)
    }

    let onAbort: (() => void) | undefined;
    const answers = await ctx.ui.custom<string[] | undefined>((tui, theme, keybindings, done) => {
        let finished = false;
        const finish = (result: string[] | undefined) => {
            if (finished) return;
            finished = true;
            if (onAbort) signal.removeEventListener("abort", onAbort);
            done(result);
        }

        const container = new Container();
        container.addChild(new Text(theme.fg("accent", params.question), 0, 1));

        const selectList = new SelectList(params.options ?? [],
            {
                selectedItem: (text) => theme.fg("accent", text),
                noMatch: (text) => theme.fg("warning", text),
                dim: (text) => theme.fg("dim", text),
            },
            keybindings)
        selectList.onSubmit = (selected: string[]) => { finish(selected) }
        selectList.onCancel = () => { finish(undefined) }
        container.addChild(selectList);

        onAbort = () => { finish(undefined) };
        signal.addEventListener("abort", onAbort, { once: true });
        // 补逸漏：若在预检查之后、注册监听之前已经中止，abort 事件不会再触发
        if (signal.aborted) finish(undefined);

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

    if (onAbort) signal.removeEventListener("abort", onAbort);

    if (answers === undefined) {
        return buildResult("User cancelled.", params)
    }
    return buildResult(`User selected:\n${answers.map((answer) => `- ${answer}`).join("\n")}`, params);
}

export default function (pi: ExtensionAPI) {
    pi.registerTool({
        name: "ask_user",
        label: "Ask User",
        description:
            "Ask the user a question and return their answer. Supports free-text input (no options), single-select, and multi-select. Reports cancelled or empty answers distinctly.",
        promptSnippet:
            "Ask the user a question in the interactive UI: free-text, single-select, or multi-select",
        promptGuidelines: [
            "Use ask_user when you need a decision, missing detail, or clarification that only the user can provide and guessing would risk wasted work.",
            "Use ask_user instead of assuming between materially different options; pass `options` with short, self-explanatory labels so the user can answer with one keystroke.",
            "When calling ask_user, ask one focused question at a time and do not repeat questions the user has already answered in this conversation.",
            "Treat Ask User results starting with `User cancelled.` as the user declining to answer; do not immediately re-ask the same question.",
        ],
        executionMode: "sequential",
        parameters: AskUserParamsSchema,

        async execute(toolCallId, params: AskUserParams, signal: AbortSignal, onUpdate, ctx: ExtensionToolContext): Promise<AgentToolResult<AskUserDetails>> {
            if (!ctx.hasUI) {
                throw new Error("The 'ask_user' tool requires an interactive UI to be available.");
            }

            if (!params.options?.length) {
                return await executeFreeText(params, ctx, signal);
            }

            if (!params?.multiSelect) {
                return await executeSelect(params, ctx, signal);
            }

            if (ctx.mode !== "tui") {
                throw new Error("The 'ask_user' tool only supports multi-select when the interactive terminal UI is in use.");
            }

            return await executeMultiSelect(params, ctx, signal);
        }
    })
}