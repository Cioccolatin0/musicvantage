import React from "react";

export function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`px-4 py-2.5 rounded-xl text-sm bg-background border border-border/50 text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50 transition-all duration-200 resize-none ${className}`}
      {...props}
    />
  );
}
