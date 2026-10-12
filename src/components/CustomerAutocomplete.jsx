import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

export default function CustomerAutocomplete({
  testId,
  value = "",
  customers = [],
  mode = "name",
  placeholder = "",
  onChange,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = customers.filter((c) => {
    if (!value || value.length < 1) return false;
    const target = mode === "name" ? c.name : c.phone;
    return target && target.toLowerCase().includes(value.toLowerCase());
  }).slice(0, 5);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <Input
        data-testid={testId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value) setOpen(true);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-md shadow-lg overflow-hidden py-1">
          {filtered.map((c) => (
            <button
              key={c.id || c.phone || c.name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex flex-col transition-colors"
              onClick={() => {
                onSelect?.(c);
                setOpen(false);
              }}
            >
              <span className="font-medium text-stone-800">{c.name}</span>
              <span className="text-xs text-stone-500">
                {c.phone} {c.address ? `• ${c.address}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
