/**
 * ask_user tool — Ask the user a question and return their answer.
 *
 * Uses Pi's built-in dialogs so it works in the interactive TUI and over RPC:
 *   - options provided  -> selection list (arrow keys / click)
 *   - no options        -> single-line text input
 *
 * The tool result is returned to the model so the conversation can continue
 * with the user's answer.
 */

import type { AgentToolResult, ExtensionAPI, ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const AskUserParams = Type.Object({
	question: Type.String({ description: "The question to ask the user." }),
	options: Type.Optional(
		Type.Array(Type.String(), {
			description:
				"Optional list of choices to show the user. Empty or missing means free-text input is allowed.",
		}),
	)
});

interface AskUserParamsSchema {
	question: string;
	options?: string[];
}

interface AskUserResultSchema {
	question: string;
	options: string[];
	answer: string | null;
}

function buildReturn(params: AskUserParamsSchema, answer: string | undefined): AgentToolResult<AskUserResultSchema> {
	if (!answer) {
		return {
			content: [
				{
					type: "text",
					text: "No answer provided.",
				},
			],
			details: {
				question: params.question,
				options: params.options ?? [],
				answer: null,
			} as AskUserResultSchema,
		};
	}
	return {
		content: [
			{
				type: "text",
				text: `User answered: ${answer}`,
			},
		],
		details: {
			question: params.question,
			options: params.options ?? [],
			answer,
		} as AskUserResultSchema,
	};
}

async function executeSelect(params: AskUserParamsSchema, ctx: ExtensionToolContext): Promise<AgentToolResult<AskUserResultSchema>> {
	const answer = await ctx.ui.select(params.question, params.options ?? []);
	return buildReturn(params, answer);
}

async function executeFreeText(params: AskUserParamsSchema, ctx: ExtensionToolContext): Promise<AgentToolResult<AskUserResultSchema>> {
	const answer = await ctx.ui.input(params.question);
	return buildReturn(params, answer);
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_user",
		label: "Ask User",
		description:
			"Ask the user a question and get their answer. Provide `options` for a selection list. Use when you need user input to continue.",
		parameters: AskUserParams,

		async execute(_toolCallId: string, params: AskUserParamsSchema, _signal, _onUpdate, ctx): Promise<AgentToolResult<AskUserResultSchema>> {
			if (!ctx.hasUI) {
				return {
					content: [
						{
							type: "text",
							text: "Cannot ask the user: no interactive UI is available in this mode.",
						},
					],
					details: {
						question: params.question,
						options: params.options ?? [],
						answer: null,
					} as AskUserResultSchema,
				};
			}

			if (params.options && params.options.length > 0) {
				return await executeSelect(params, ctx);
			}
			return await executeFreeText(params, ctx);
		}
	})
}

