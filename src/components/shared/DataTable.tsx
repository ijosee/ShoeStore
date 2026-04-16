"use client"

import { useState, useCallback, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc"

export type ColumnDef<T> = {
  /** Texto del encabezado de la columna */
  header: string
  /** Clave del objeto para acceder al valor, o función de acceso */
  accessor: keyof T | ((row: T) => unknown)
  /** Si la columna es ordenable */
  sortable?: boolean
  /** Función de renderizado personalizado para la celda */
  cell?: (row: T) => React.ReactNode
  /** Clase CSS adicional para la celda */
  className?: string
}

export type DataTableProps<T> = {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  /** Clave única para cada fila */
  rowKey?: keyof T | ((row: T) => string)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCellValue<T>(row: T, accessor: ColumnDef<T>["accessor"]): unknown {
  if (typeof accessor === "function") {
    return accessor(row)
  }
  return row[accessor]
}

function getRowKey<T>(row: T, index: number, rowKey?: DataTableProps<T>["rowKey"]): string {
  if (!rowKey) return String(index)
  if (typeof rowKey === "function") return rowKey(row)
  return String(row[rowKey])
}

// ─── Skeleton rows ───────────────────────────────────────────────────────────

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ─── Sort icon ───────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction?: SortDirection }) {
  if (direction === "asc") return <ArrowUp className="size-3.5" />
  if (direction === "desc") return <ArrowDown className="size-3.5" />
  return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No se encontraron registros.",
  rowKey,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const handleSort = useCallback(
    (colIndex: number) => {
      if (sortColumn === colIndex) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortColumn(colIndex)
        setSortDirection("asc")
      }
    },
    [sortColumn]
  )

  const sortedData = useMemo(() => {
    if (sortColumn === null) return data

    const col = columns[sortColumn]
    if (!col) return data

    return [...data].sort((a, b) => {
      const aVal = getCellValue(a, col.accessor)
      const bVal = getCellValue(b, col.accessor)

      let comparison = 0
      if (aVal == null && bVal == null) { /* keep 0 */ }
      else if (aVal == null) comparison = -1
      else if (bVal == null) comparison = 1
      else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal), "es")
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [data, columns, sortColumn, sortDirection])

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead
                key={idx}
                className={cn(
                  col.sortable && "cursor-pointer select-none",
                  col.className
                )}
                onClick={col.sortable ? () => handleSort(idx) : undefined}
                aria-sort={
                  col.sortable && sortColumn === idx
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <SortIcon
                      direction={sortColumn === idx ? sortDirection : undefined}
                    />
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <SkeletonRows columns={columns.length} />
          ) : sortedData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, rowIdx) => (
              <TableRow key={getRowKey(row, rowIdx, rowKey)}>
                {columns.map((col, colIdx) => (
                  <TableCell key={colIdx} className={col.className}>
                    {col.cell
                      ? col.cell(row)
                      : String(getCellValue(row, col.accessor) ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
