"use client";

import React, { createContext, useContext, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PreContext = createContext(false);

function PreBlock({ node, children, ...props }) {
  const [copied, setCopied] = useState(false);

  const extractText = (element) => {
    if (!element) return "";
    if (typeof element === "string") return element;
    if (Array.isArray(element)) return element.map(extractText).join("");
    if (element.props && element.props.children) {
      return extractText(element.props.children);
    }
    return "";
  };

  const handleCopy = () => {
    const text = extractText(children);
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-1.5 rounded-lg bg-[#090d16] border border-white/[0.08] shadow-sm shadow-black/30 overflow-hidden transition-all hover:border-indigo-500/30">
      {/* Top Header Bar */}
      <div className="h-5.5 px-2 bg-[#0d121f] border-b border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400 select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
          <span className="ml-1 text-[9px] text-slate-400 font-sans uppercase tracking-wider font-semibold">
            Console
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code block"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-sans font-medium text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400 font-medium text-[9px]">Copied</span>
            </>
          ) : (
            <>
              <svg className="w-2.5 h-2.5 text-slate-400 group-hover:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-[9px]">Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code Content */}
      <pre
        className="p-2 text-xs font-mono text-indigo-200 leading-relaxed overflow-x-auto selection:bg-indigo-600/40"
        {...props}
      >
        <PreContext.Provider value={true}>{children}</PreContext.Provider>
      </pre>
    </div>
  );
}

function CodeElement({ node, children, className, ...props }) {
  const isInsidePre = useContext(PreContext);
  if (isInsidePre) {
    return (
      <code
        className={`font-mono text-xs text-indigo-200 block ${className || ""}`}
        {...props}
      >
        {children}
      </code>
    );
  }
  return (
    <code
      className="px-1.5 py-0.5 mx-0.5 rounded-md bg-indigo-950/60 text-indigo-300 font-mono text-[11px] sm:text-[12px] border border-indigo-500/30 shadow-xs font-medium inline-block align-baseline"
      {...props}
    >
      {children}
    </code>
  );
}

const markdownComponents = {
  h1: ({ node, ...props }) => (
    <div className="pb-1.5 border-b border-white/[0.08] mb-2 mt-0.5 first:mt-0">
      <h1
        className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200 tracking-tight"
        {...props}
      />
    </div>
  ),
  h2: ({ node, children, ...props }) => {
    const text = typeof children === "string" ? children.toLowerCase() : "";
    let accentGradient = "from-indigo-500 to-purple-500";
    let glowColor = "shadow-indigo-500/30";

    if (text.includes("example")) {
      accentGradient = "from-amber-400 to-orange-500";
      glowColor = "shadow-amber-500/30";
    } else if (text.includes("constraint")) {
      accentGradient = "from-rose-400 to-red-500";
      glowColor = "shadow-rose-500/30";
    } else if (text.includes("input") || text.includes("output")) {
      accentGradient = "from-cyan-400 to-blue-500";
      glowColor = "shadow-cyan-500/30";
    }

    return (
      <div className="flex items-center gap-1.5 mt-3 mb-1.5 pb-1 border-b border-white/[0.08] first:mt-0.5">
        <span className={`w-1 h-3 rounded-full bg-gradient-to-b ${accentGradient} shadow-sm ${glowColor} shrink-0`} />
        <h2
          className="text-xs sm:text-[12px] font-bold text-white uppercase tracking-wider font-sans"
          {...props}
        >
          {children}
        </h2>
      </div>
    );
  },
  h3: ({ node, children, ...props }) => {
    const str = typeof children === "string" ? children : "";
    const isExample = str.toLowerCase().includes("example");

    if (isExample) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold tracking-wide mt-2 mb-1 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <h3 className="font-semibold text-indigo-200 text-[10px]" {...props}>
            {children}
          </h3>
        </div>
      );
    }

    return (
      <h3
        className="text-xs font-bold text-slate-200 mt-2 mb-1 tracking-wide uppercase flex items-center gap-1.5"
        {...props}
      >
        <span className="w-1 h-2 rounded-full bg-indigo-500/60" />
        {children}
      </h3>
    );
  },
  h4: ({ node, ...props }) => (
    <h4
      className="text-[10px] font-semibold text-slate-300 mt-1.5 mb-0.5 uppercase tracking-wide"
      {...props}
    />
  ),
  p: ({ node, ...props }) => (
    <p
      className="text-xs sm:text-[13px] text-slate-300 leading-relaxed font-normal mb-1.5 last:mb-0"
      {...props}
    />
  ),
  ul: ({ node, ...props }) => (
    <ul className="space-y-1 my-1.5" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal list-inside space-y-1 my-1.5 text-xs sm:text-[13px] text-slate-300 pl-1" {...props} />
  ),
  li: ({ node, children, ...props }) => (
    <li
      className="flex items-start gap-1.5 text-xs sm:text-[13px] text-slate-300 leading-relaxed font-sans"
      {...props}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0 shadow-sm shadow-indigo-400/40" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ node, children, ...props }) => {
    const str = typeof children === "string" ? children.trim().toLowerCase() : "";
    if (str === "input" || str === "input:") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300 uppercase tracking-wide mt-1 mb-0.5 block">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50" />
          <span>Input</span>
        </span>
      );
    }
    if (str === "output" || str === "output:") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300 uppercase tracking-wide mt-1 mb-0.5 block">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          <span>Output</span>
        </span>
      );
    }
    return <strong className="font-semibold text-white" {...props}>{children}</strong>;
  },
  b: ({ node, ...props }) => (
    <strong className="font-semibold text-white" {...props} />
  ),
  em: ({ node, ...props }) => (
    <em className="italic text-slate-200" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a
      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors font-medium"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ node, children, ...props }) => (
    <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-950/30 to-purple-950/20 p-3 my-2.5 flex items-start gap-2.5 shadow-sm">
      <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-xs text-slate-300 leading-relaxed italic" {...props}>
        {children}
      </div>
    </div>
  ),
  pre: PreBlock,
  code: CodeElement,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-2.5 rounded-xl border border-white/[0.08] shadow-md bg-[#090d16]">
      <table
        className="w-full border-collapse text-left text-xs text-slate-300"
        {...props}
      />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead
      className="bg-[#0e1322] border-b border-white/[0.08] text-slate-200 font-semibold uppercase text-[10px] tracking-wider"
      {...props}
    />
  ),
  th: ({ node, ...props }) => (
    <th
      className="px-3 py-2 font-semibold text-slate-200 border-r border-white/[0.06] last:border-r-0"
      {...props}
    />
  ),
  tr: ({ node, ...props }) => (
    <tr
      className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.03] transition-colors"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td
      className="px-3 py-2 text-slate-300 border-r border-white/[0.06] last:border-r-0 font-mono text-xs"
      {...props}
    />
  ),
  hr: ({ node, ...props }) => (
    <hr className="border-white/[0.08] my-3.5" {...props} />
  ),
  input: ({ node, ...props }) => (
    <input
      type="checkbox"
      disabled
      className="mr-2 rounded border-white/20 bg-[#101524] text-indigo-500 accent-indigo-500"
      {...props}
    />
  ),
  img: ({ node, alt, ...props }) => (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      className="max-w-full h-auto rounded-xl border border-white/[0.08] my-2 shadow-md"
      alt={alt || ""}
      {...props}
    />
  ),
};

export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  return (
    <div className={`markdown-content text-slate-300 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
