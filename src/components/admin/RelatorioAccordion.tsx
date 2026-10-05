import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function RelatorioAccordion({
  title,
  open,
  onToggle,
  extraHeader,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  extraHeader?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className={`flex items-center gap-2 bg-stone-50 ${open ? 'border-b border-stone-200' : ''}`}>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left font-medium text-stone-800 hover:bg-stone-100"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
          )}
          {title}
        </button>
        {extraHeader && <div className="shrink-0 pr-3">{extraHeader}</div>}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}
