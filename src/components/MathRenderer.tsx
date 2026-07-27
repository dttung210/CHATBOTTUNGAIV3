import React from "react";
import katex from "katex";

// Ensure Katex CSS is loaded. Since we'll import it in index.css, this will be correctly styled.
interface MathRendererProps {
  content: string;
  className?: string;
}

export default function MathRenderer({ content, className = "" }: MathRendererProps) {
  // Parses a single line's content for display math ($$...$$) or inline math ($...$)
  const parseLine = (text: string) => {
    if (!text) return [];

    // Replace standard bracket markers with dollar signs for easier parsing
    let normalized = text
      .replace(/\\\[/g, "$$")
      .replace(/\\\]/g, "$$")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$");

    // Regex to capture display math ($$...$$) or inline math ($...$)
    const regex = /(\$\$.*?\$\$|\$.*?\$)/g;
    const parts = normalized.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const formula = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(formula, {
            displayMode: true,
            throwOnError: true,
          });
          return (
            <div
              key={index}
              className="w-full my-2.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-teal-100"
              dangerouslySetInnerHTML={{ __html: html }}
              aria-label={`Công thức toán học độc lập: ${formula}`}
            />
          );
        } catch (err) {
          console.error("KaTeX Display Render Error:", err);
          return (
            <div
              key={index}
              className="text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm my-2 text-center"
            >
              Công thức này chưa hiển thị được. Em hãy kiểm tra lại ký hiệu.
            </div>
          );
        }
      } else if (part.startsWith("$") && part.endsWith("$")) {
        const formula = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(formula, {
            displayMode: false,
            throwOnError: true,
          });
          return (
            <span
              key={index}
              className="inline-block px-1 overflow-x-auto align-middle max-w-full"
              dangerouslySetInnerHTML={{ __html: html }}
              aria-label={`Công thức toán học: ${formula}`}
            />
          );
        } catch (err) {
          console.error("KaTeX Inline Render Error:", err);
          return (
            <span
              key={index}
              className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-xs border border-amber-200"
            >
              [Lỗi hiển thị công thức]
            </span>
          );
        }
      }

      return <span key={index}>{part}</span>;
    });
  };

  // Split by newlines to show visual steps and lines (like real test papers)
  const lines = (content || "").split("\n");

  return (
    <div className={`text-base leading-relaxed break-words space-y-2.5 ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-2" />; // Spacer for empty lines
        }

        // Custom check for list items/bullets/numbered lines
        const isBullet = trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("+");
        const isNumbered = /^\d+(\.|\))/g.test(trimmed);

        let contentStr = line;
        let bulletMarker = null;

        if (isBullet) {
          contentStr = trimmed.substring(1).trim();
          bulletMarker = "•";
        }

        return (
          <div
            key={idx}
            className={`
              relative leading-relaxed text-[#163A3A] text-[14px] sm:text-[15px] md:text-[16px]
              ${isBullet ? "pl-5" : ""}
              ${isNumbered ? "pl-1 font-semibold text-[#0F9D8A]" : ""}
            `}
          >
            {isBullet && (
              <span className="absolute left-0 top-0 text-[#0F9D8A] font-extrabold select-none">
                {bulletMarker}
              </span>
            )}
            {parseLine(contentStr)}
          </div>
        );
      })}
    </div>
  );
}
