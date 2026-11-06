"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Normalizes LaTeX math syntax:
 *   \( ... \) -> $...$   (inline math)
 *   \[ ... \] -> $$...$$ (block/display math)
 */
export function normalizeMath(text) {
  return (text || "")
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m}$`);
}

/**
 * MarkdownPreview — rich markdown previewer matching MarkdownRenderer.
 *
 * Supports:
 *  - Full GitHub-Flavored Markdown (GFM tables, strikethrough, task lists)
 *  - LaTeX Math rendering via KaTeX ($inline$ and $$block$$)
 *  - Syntax-styled codeblocks and inline code
 */
export default function MarkdownPreview({ content, prob, className = "" }) {
  const text = typeof content === "string" ? content : prob?.description || "";

  if (!text || !text.trim()) {
    return (
      <div className={`markdown-preview-pane ${className}`}>
        <div style={{ color: "var(--text-dim)", fontStyle: "italic", fontSize: "0.875rem" }}>
          No content provided for preview.
        </div>
      </div>
    );
  }

  return (
    <div className={`markdown-preview-pane markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {normalizeMath(text)}
      </ReactMarkdown>
    </div>
  );
}

export { MarkdownPreview as MarkdownRenderer };
