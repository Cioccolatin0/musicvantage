import React from "react";

type TooltipProviderProps = {
  children: React.ReactNode;
  delayDuration?: number;
};

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}
