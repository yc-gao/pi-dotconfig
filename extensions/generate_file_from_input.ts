/**
 * generate_file_from_input
 *
 * Registers a tool that asks the user for text via `ctx.ui.input()` and writes
 * the answer to a file. The model only chooses the path; the file body is
 * entirely what the human typed.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import {
    type AgentToolResult,
    type AgentToolUpdateCallback,
    type ExtensionAPI,
    type ExtensionToolContext,
    withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

const paramsSchema = Type.Object({
    path: Type.String({
        description:
            "File to write, relative to the project directory (or absolute). A leading @ is ignored.",
    }),
    placeholder: Type.Optional(
        Type.String({ description: "Placeholder text shown in the empty input field." }),
    ),
});

type Params = Static<typeof paramsSchema>;

interface Details {
    path: string;
    absolutePath?: string;
    content?: string;
    state: "ok" | "cancelled" | "error";
}

function buildOkResult(text: string, path: string, absolutePath: string, content: string): AgentToolResult<Details> {
    return {
        content: [{ type: "text", text }],
        details: {
            path,
            absolutePath,
            content,
            state: "ok"
        }
    }
}

function buildCancelledResult(text: string, path: string): AgentToolResult<Details> {
    return {
        content: [{ type: "text", text }],
        details: {
            path,
            state: "cancelled"
        }
    }
}

function buildErrorResult(text: string, path: string): AgentToolResult<Details> {
    return {
        content: [{ type: "text", text }],
        details: {
            path,
            state: "error"
        },
        isError: true
    }
}

function normalizePath(cwd: string, raw: string): string {
    const cleaned = raw.trim().replace(/^@/, "");
    const absolute = isAbsolute(cleaned) ? cleaned : resolve(cwd, cleaned);
    return absolute
}

async function execute(
    _toolCallId: string,
    params: Params,
    signal: AbortSignal | undefined,
    _onUpdate: AgentToolUpdateCallback<Details> | undefined,
    ctx: ExtensionToolContext,
): Promise<AgentToolResult<Details>> {
    if (!ctx.hasUI) {
        return buildErrorResult(
            `Error: this tool needs an interactive session to prompt, but the current mode is "${ctx.mode}".`,
            params.path
        )
    }

    const displayPath = params.path
    const absolutePath = normalizePath(ctx.cwd, displayPath);

    if (signal?.aborted) {
        return buildCancelledResult("Cancelled before asking the user.", displayPath)
    }

    const answer = await ctx.ui.input(`Content for ${displayPath}:`, params.placeholder, { signal });
    if (answer === undefined) {
        return buildCancelledResult("User cancelled the input, no file was written.", displayPath)
    }


    await withFileMutationQueue(absolutePath, async () => {
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, answer, "utf8");
    });

    return buildOkResult(`Created ${displayPath} from user input.`, displayPath, absolutePath, answer);
}

export default function generateFileFromInput(pi: ExtensionAPI) {
    pi.registerTool({
        name: "generate_file_from_input",
        label: "Generate File From Input",
        description:
            "Ask the user to type a line of text in an interactive dialog and write it to the given file. " +
            "Use when the file content must come from the human rather than from you.",
        promptSnippet:
            "Ask the user for text in a UI dialog and write it to a file (use when content must come from the human)",
        promptGuidelines: [
            "Use generate_file_from_input when the user wants a file whose content they will type themselves; do not guess or invent that content.",
            "Pass the target path in generate_file_from_input's `path` argument; the file body always comes from the user's own typed input.",
        ],
        parameters: paramsSchema,
        executionMode: "sequential",
        execute,
    });
}
