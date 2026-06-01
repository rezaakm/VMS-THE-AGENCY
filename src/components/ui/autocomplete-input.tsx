import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  className,
  "data-testid": testId,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.trim().length > 0
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase()) &&
        s.toLowerCase() !== value.toLowerCase()
      ).slice(0, 8)
    : [];

  const showDropdown = open && filtered.length > 0;

  const select = useCallback((item: string) => {
    onChange(item);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [onChange]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={className}
        data-testid={testId}
        autoComplete="off"
      />
      {showDropdown && (
        <ul
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-card-border bg-card shadow-lg overflow-hidden"
          role="listbox"
        >
          {filtered.map((item, idx) => (
            <li
              key={item}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); select(item); }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer transition-colors",
                idx === activeIndex
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent/20"
              )}
            >
              {highlightMatch(item, value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold underline underline-offset-2">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
