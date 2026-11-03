import type { Component, Keybinding, KeybindingsManager } from "@earendil-works/pi-tui";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

interface SelectListTheme {
    selectedItem: (text: string) => string;
    noMatch: (text: string) => string;
    dim: (text: string) => string;
}

export class SelectList implements Component {
    private options: string[];
    private theme: SelectListTheme;
    private keybindings: KeybindingsManager;

    private selectedItems: Set<number> = new Set();
    private currentIndex: number = 0;

    // 渲染缓存：按宽度缓存渲染结果，状态或主题变化时清空
    private cachedWidth: number | undefined;
    private cachedLines: string[] | undefined;
    // 影响渲染结果的状态快照，用于 handleInput 之外的变更检测
    private cachedSignature: string | undefined;

    public onSubmit: (items: string[]) => void = () => { };
    public onCancel: () => void = () => { }

    constructor(options: string[], theme: SelectListTheme, keybindings: KeybindingsManager) {
        this.options = options
        this.theme = theme
        this.keybindings = keybindings
    }

    render(width: number): string[] {
        const signature = this.getSignature();
        if (this.cachedLines && this.cachedWidth === width && this.cachedSignature === signature) {
            return this.cachedLines;
        }

        let lines: string[] = [];

        if (this.options.length === 0) {
            lines.push(truncateToWidth(this.theme.noMatch("  (no options)"), width));
        } else {
            this.options.forEach((option, index) => {
                const isCurrent = index === this.currentIndex;
                const isSelected = this.selectedItems.has(index);

                const shouldHighlight = isCurrent || isSelected;

                let prefix = isSelected ? "• " : "◦ ";
                prefix = shouldHighlight ? this.theme.selectedItem(prefix) : prefix;

                const label = shouldHighlight ? this.theme.selectedItem(option) : option;
                lines.push(truncateToWidth(prefix + label, width));
            })
        }

        lines.push("");
        lines.push(truncateToWidth(this.theme.dim(this.renderHint()), width));

        this.cachedWidth = width;
        this.cachedLines = lines;
        this.cachedSignature = signature;

        return lines;
    }
    handleInput(data: string) {
        if (this.keybindings.matches(data, "tui.select.cancel")) {
            this.onCancel();
            return;
        }
        if (this.keybindings.matches(data, "tui.select.confirm")) {
            this.onSubmit([...this.selectedItems].map(i => this.options[i]));
            return;
        }

        if (this.options.length === 0) return;

        if (this.keybindings.matches(data, "tui.select.up")) {
            this.currentIndex = (this.currentIndex - 1 + this.options.length) % this.options.length;
            this.invalidate();
            return;
        }
        if (this.keybindings.matches(data, "tui.select.down")) {
            this.currentIndex = (this.currentIndex + 1) % this.options.length;
            this.invalidate();
            return;
        }
        if (matchesKey(data, "space")) {
            if (this.selectedItems.has(this.currentIndex)) {
                this.selectedItems.delete(this.currentIndex);
            } else {
                this.selectedItems.add(this.currentIndex);
            }
            this.invalidate();
            return;
        }
    }

    /** Clear cached output, e.g. after a theme change or state mutation outside handleInput. */
    invalidate() {
        this.cachedWidth = undefined;
        this.cachedLines = undefined;
        this.cachedSignature = undefined;
    }

    private getSignature(): string {
        return `${this.currentIndex}|${[...this.selectedItems].sort((a, b) => a - b).join(",")}`;
    }


    /** Resolve a configured keybinding to its keys, falling back to a literal symbol. */
    private keyText(keybinding: Keybinding, fallback: string): string {
        const keys = this.keybindings.getKeys(keybinding);
        return keys.length > 0 ? keys.join("/") : fallback;
    }

    private renderHint(): string {
        const navigate = `${this.keyText("tui.select.up", "↑")}/${this.keyText("tui.select.down", "↓")}`;
        const confirm = this.keyText("tui.select.confirm", "enter");
        const cancel = this.keyText("tui.select.cancel", "esc");
        const hint = `${navigate} navigate • space select/deselect • ${confirm} confirm • ${cancel} cancel`;
        return `${hint}`;
    }
}