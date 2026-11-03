import { Static, Type } from "typebox";

export const AskUserParamsSchema = Type.Object({
    question: Type.String({ description: "The question to ask the user." }),
    options: Type.Optional(
        Type.Array(Type.String(), {
            description:
                "Optional list of choices to show the user. Empty or missing means free-text input is allowed.",
        }),
    ),
    multiSelect: Type.Optional(
        Type.Boolean({
            description:
                "Optional flag to allow multiple selections. Only valid if `options` is provided and the interactive terminal UI is in use.",
        }),
    ),
});
export type AskUserParams = Static<typeof AskUserParamsSchema>;

export interface AskUserDetails {
    question: string;
    options?: string[];
    multiSelect?: boolean;
    answers?: string[];
}