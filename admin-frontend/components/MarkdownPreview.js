"use client";

export default function MarkdownPreview({ content }) {
  if (!content) {
    return (
      <div style={{ color: "var(--text-dim)", fontStyle: "italic" }}>
        No content provided for preview.
      </div>
    );
  }

  // Basic lightweight parser for formatting markdown without heavy external deps
  const formatText = (text) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith("### ")) {
        return (
          <h3 key={idx} style={{ fontSize: "1.1rem", margin: "1rem 0 0.4rem", color: "#f8fafc" }}>
            {line.replace("### ", "")}
          </h3>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={idx} style={{ fontSize: "1.3rem", margin: "1.25rem 0 0.5rem", color: "#ffffff" }}>
            {line.replace("## ", "")}
          </h2>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h1 key={idx} style={{ fontSize: "1.5rem", margin: "1.5rem 0 0.75rem", color: "#ffffff" }}>
            {line.replace("# ", "")}
          </h1>
        );
      }

      // Code blocks line
      if (line.startsWith("```")) {
        return null;
      }

      // Bullet points
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={idx} style={{ marginLeft: "1.5rem", marginBottom: "0.25rem" }}>
            {line.substring(2)}
          </li>
        );
      }

      // Empty line
      if (!line.trim()) {
        return <div key={idx} style={{ height: "0.6rem" }} />;
      }

      // Normal paragraph
      return (
        <p key={idx} style={{ marginBottom: "0.5rem", color: "#cbd5e1" }}>
          {line}
        </p>
      );
    });
  };

  return (
    <div className="markdown-preview-pane">
      {formatText(content)}
    </div>
  );
}
