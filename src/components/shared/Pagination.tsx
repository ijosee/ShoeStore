"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"

export type PaginationProps = {
  page: number
  totalPages: number
  totalCount: number
  pageSize?: number
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
}: PaginationProps) {
  const start = Math.min((page - 1) * pageSize + 1, totalCount)
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {start}-{end} de {totalCount} registros
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft data-icon="inline-start" />
          Anterior
        </Button>

        <span className="text-sm text-muted-foreground tabular-nums">
          Página {page} de {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          Siguiente
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}
