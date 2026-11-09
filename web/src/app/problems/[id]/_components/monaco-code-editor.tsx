"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";

interface MonacoEditorProps {
  code: string;
  onChange: (value: string) => void;
  language: string;
}

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--background)] text-xs text-[var(--muted-foreground)]">
      <Loader2 className="mb-2 h-5 w-5 animate-spin text-[var(--brand)]" />
      <span>Loading Monaco Editor...</span>
    </div>
  ),
});

export function MonacoCodeEditor({ code, onChange, language }: MonacoEditorProps) {
  const { resolvedTheme } = useTheme();
  const editorTheme = resolvedTheme === "dark" ? "vs-dark" : "light";

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        language={language}
        theme={editorTheme}
        value={code}
        onChange={(value) => onChange(value ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 20,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          tabSize: 4,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
}

