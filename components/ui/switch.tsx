"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "inline-flex h-5 w-9 items-center rounded-full border border-input bg-muted transition-colors",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "ml-0.5 inline-block h-4 w-4 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  )
}

