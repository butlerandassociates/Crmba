import * as React from "react";
import ReactDOM from "react-dom";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRect: DOMRect | null;
  setTriggerRect: (rect: DOMRect | null) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
  triggerRect: null,
  setTriggerRect: () => {},
});

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRect, setTriggerRect }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { open, setOpen, setTriggerRect } = React.useContext(DropdownMenuContext);
  const ref = React.useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (ref.current) setTriggerRect(ref.current.getBoundingClientRect());
    setOpen(!open);
  };

  return (
    <div ref={ref} onClick={handleClick}>
      {children}
    </div>
  );
}

export function DropdownMenuContent({
  children,
  align = "start",
  className = "",
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const { open, setOpen, triggerRect } = React.useContext(DropdownMenuContext);

  if (!open || !triggerRect) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: triggerRect.bottom + 4,
    zIndex: 9999,
  };

  if (align === "end") {
    style.right = window.innerWidth - triggerRect.right;
  } else if (align === "center") {
    style.left = triggerRect.left + triggerRect.width / 2;
    style.transform = "translateX(-50%)";
  } else {
    style.left = triggerRect.left;
  }

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
      <div
        style={style}
        className={`min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${className}`}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  asChild?: boolean;
  disabled?: boolean;
}

export function DropdownMenuItem({
  children,
  onClick,
  className = "",
  asChild,
  disabled,
}: DropdownMenuItemProps) {
  const { setOpen } = React.useContext(DropdownMenuContext);
  const base =
    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground";
  const disabledClass = disabled ? "pointer-events-none opacity-40 cursor-not-allowed" : "";

  const handleClick = () => {
    if (!disabled) {
      onClick?.();
      setOpen(false);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return (
      <div className={`${base} ${disabledClass} ${className}`} onClick={handleClick}>
        {children}
      </div>
    );
  }

  return (
    <div className={`${base} ${disabledClass} ${className}`} onClick={handleClick}>
      {children}
    </div>
  );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{children}</div>
  );
}

export function DropdownMenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-muted" />;
}
