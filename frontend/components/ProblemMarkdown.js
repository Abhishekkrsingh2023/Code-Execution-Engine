"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Convert \( ... \) -> $...$ and \[ ... \] -> $$...$$ before markdown parsing
export function normalizeMath(text) {
  return (text || "")
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m}$`);
}

export default function ProblemMarkdown({ content, prob, className = "" }) {
  const text = typeof content === "string" ? content : prob?.description || "";

  return (
    <div
      className={`prose prose-invert markdown-content max-w-none prose-pre:bg-[#0d1117] prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {normalizeMath(text)}
      </ReactMarkdown>
    </div>
  );
}

export { ProblemMarkdown as ProblemDescription };
