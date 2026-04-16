"use client"

import { cn } from "@/lib/utils"

const sizeClasses = {
  sm: "size-4 border-2",
  md: "size-8 border-2",
  lg: "size-12 border-3",
} as const

export type LoadingSpinnerProps = {
  size?: keyof typeof sizeClasses
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <output
      aria-label="Cargando"
      className={cn(
        "animate-spin rounded-full border-muted-foreground/25 border-t-primary",
        sizeClasses[size],
        className
      )}
    >
      <span className="sr-only">Cargando…</span>
    </output>
  )
}
