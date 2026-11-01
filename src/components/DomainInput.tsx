"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { filterDomains } from "@/lib/popular-domains";
import { getFaviconUrl } from "@/lib/favicon";

interface DomainInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
}

export function DomainInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "Domain (e.g. facebook.com)",
  className,
}: DomainInputProps) {
  const suggestions = filterDomains(value, 8);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = useCallback(
    (domain: string) => {
      onChange(domain);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      onKeyDown?.(e);
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          onKeyDown?.(e);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
      case "Tab":
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      default:
        onKeyDown?.(e);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSelectedIndex(-1);
          setShowSuggestions(e.target.value.length >= 2);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() =>
          value.length >= 2 &&
          suggestions.length > 0 &&
          setShowSuggestions(true)
        }
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          {suggestions.map((domain, index) => (
            <button
              key={domain}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${
                index === selectedIndex ? "bg-muted" : ""
              }`}
              onClick={() => selectSuggestion(domain)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <img
                src={getFaviconUrl(domain, 16)}
                alt=""
                className="w-4 h-4"
                loading="lazy"
              />
              <span>{domain}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
