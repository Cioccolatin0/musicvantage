import React, { useState } from "react";
import { X } from "lucide-react";

type DialogContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DialogContext = React.createContext<DialogContextType | null>(null);

export function Dialog({ children, open: controlledOpen, onOpenChange }: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ children, asChild }: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const ctx = React.useContext(DialogContext);
  const handleClick = () => ctx?.setOpen(true);
  if (asChild && React.isValidElement(children)) {
    const existingOnClick = (children as React.ReactElement & { props: { onClick?: (e: React.MouseEvent) => void } }).props.onClick;
    return React.cloneElement(children as React.ReactElement, {
      onClick: (e: React.MouseEvent) => {
        existingOnClick?.(e);
        ctx?.setOpen(true);
      },
    });
  }
  return <button onClick={handleClick}>{children}</button>;
}

export function DialogContent({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(DialogContext);
  if (!ctx?.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => ctx.setOpen(false)}>
      <div className="bg-card border border-border/50 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl scale-in" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => ctx.setOpen(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-5">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-foreground">{children}</h2>;
}
