import { useEffect, useRef, useState } from "react";

const TOOLBAR_BUTTON_CLASS =
    "w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-[#124757] dark:hover:text-yellow-400 transition-all";

const TOOLBAR_BUTTON_ACTIVE_CLASS =
    "bg-white dark:bg-slate-800 text-[#124757] dark:text-yellow-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700";

// Tailwind preflight xoá list-style/margin mặc định của các thẻ này, nên cần khai báo lại
// cho vùng contentEditable thì bullet/số thứ tự/heading/quote mới hiển thị được.
const RICH_CONTENT_CLASS =
    "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 " +
    "[&_h2]:text-base [&_h2]:font-black [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[#124757] dark:[&_h2]:text-yellow-400 " +
    "[&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2 [&_blockquote]:text-slate-500 dark:[&_blockquote]:text-slate-400 " +
    "[&_a]:text-[#124757] dark:[&_a]:text-yellow-400 [&_a]:underline";

export function RichTextEditor({ value, onChange, placeholder, className = "", minHeightClassName = "min-h-64" }) {
    const editorRef = useRef(null);
    const [, setToolbarTick] = useState(0);

    useEffect(() => {
        const el = editorRef.current;
        if (el && el.innerHTML !== (value || "")) {
            el.innerHTML = value || "";
        }
        // Chỉ đồng bộ khi value đổi từ bên ngoài (vd load dữ liệu edit), không phải mỗi lần gõ. eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const refreshToolbarState = () => setToolbarTick((t) => t + 1);

    useEffect(() => {
        const handleSelectionChange = () => {
            const el = editorRef.current;
            const sel = window.getSelection();
            if (el && sel && sel.anchorNode && el.contains(sel.anchorNode)) {
                refreshToolbarState();
            }
        };
        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, []);

    const emitChange = () => {
        onChange?.(editorRef.current?.innerHTML || "");
        refreshToolbarState();
    };

    const exec = (command, arg) => {
        editorRef.current?.focus();
        document.execCommand(command, false, arg);
        emitChange();
    };

    const handleInsertLink = () => {
        const url = window.prompt("URL:");
        if (!url) return;
        exec("createLink", url);
    };

    const isEmpty = !value || value === "<br>" || value.trim() === "";

    const isButtonActive = (btn) => {
        if (!btn.command) return false;
        try {
            if (btn.command === "formatBlock") {
                const current = document.queryCommandValue("formatBlock");
                return Boolean(current) && current.toLowerCase() === btn.value.toLowerCase();
            }
            return document.queryCommandState(btn.command);
        } catch {
            return false;
        }
    };

    const buttons = [
        { icon: "format_bold", title: "Bold", command: "bold", action: () => exec("bold") },
        { icon: "format_italic", title: "Italic", command: "italic", action: () => exec("italic") },
        { icon: "format_underlined", title: "Underline", command: "underline", action: () => exec("underline") },
        { icon: "format_strikethrough", title: "Strikethrough", command: "strikeThrough", action: () => exec("strikeThrough") },
        { icon: "format_h2", title: "Heading", command: "formatBlock", value: "H2", action: () => exec("formatBlock", "H2") },
        { icon: "format_quote", title: "Quote", command: "formatBlock", value: "BLOCKQUOTE", action: () => exec("formatBlock", "BLOCKQUOTE") },
        { icon: "format_list_bulleted", title: "Bullet list", command: "insertUnorderedList", action: () => exec("insertUnorderedList") },
        { icon: "format_list_numbered", title: "Numbered list", command: "insertOrderedList", action: () => exec("insertOrderedList") },
        { icon: "link", title: "Insert link", action: handleInsertLink },
        { icon: "format_clear", title: "Clear formatting", action: () => exec("removeFormat") },
        { icon: "undo", title: "Undo", action: () => exec("undo") },
        { icon: "redo", title: "Redo", action: () => exec("redo") },
    ];

    return (
        <div className={className}>
            <div className="flex flex-wrap items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl p-1.5 mb-2">
                {buttons.map((btn) => {
                    const active = isButtonActive(btn);
                    return (
                        <button
                            key={btn.icon}
                            type="button"
                            title={btn.title}
                            aria-pressed={active}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={btn.action}
                            className={`${TOOLBAR_BUTTON_CLASS} ${active ? TOOLBAR_BUTTON_ACTIVE_CLASS : ""}`}
                        >
                            <span className="material-symbols-outlined text-lg">{btn.icon}</span>
                        </button>
                    );
                })}
            </div>
            <div className="relative">
                {isEmpty && placeholder && (
                    <p className="absolute top-2.5 left-4 text-xs text-slate-400 font-bold pointer-events-none select-none">
                        {placeholder}
                    </p>
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={emitChange}
                    onBlur={emitChange}
                    onKeyUp={refreshToolbarState}
                    onMouseUp={refreshToolbarState}
                    suppressContentEditableWarning
                    className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-normal text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all leading-relaxed overflow-y-auto ${RICH_CONTENT_CLASS} ${minHeightClassName}`}
                />
            </div>
        </div>
    );
}
