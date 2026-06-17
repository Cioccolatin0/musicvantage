import React, { useState } from "react";

type TabsProps = {
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
};

type TabsContextType = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextType | null>(null);

export function Tabs({ defaultValue, className, children }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className || "flex gap-1 p-1 bg-surface-1 rounded-xl"}>{children}</div>;
}

export function TabsTrigger({
  value: tabValue,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx?.value === tabValue;
  return (
    <button
      className={className || `px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
        isActive ? "bg-spotify-green text-black shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={() => ctx?.setValue(tabValue)}
      data-state={isActive ? "active" : "inactive"}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value: tabValue,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== tabValue) return null;
  return <div className={className}>{children}</div>;
}
