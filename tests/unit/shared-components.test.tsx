import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Pagination } from "@/components/shared/Pagination"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { DataTable, type ColumnDef } from "@/components/shared/DataTable"
import { ErrorBoundary } from "@/components/ErrorBoundary"

// ─── Pagination ──────────────────────────────────────────────────────────────

describe("Pagination", () => {
  const defaultProps = {
    page: 1,
    totalPages: 5,
    totalCount: 234,
    pageSize: 50,
    onPageChange: vi.fn(),
  }

  it("muestra el rango de registros correcto", () => {
    render(<Pagination {...defaultProps} />)
    expect(screen.getByText("Mostrando 1-50 de 234 registros")).toBeInTheDocument()
  })

  it("muestra el rango correcto en la última página", () => {
    render(<Pagination {...defaultProps} page={5} />)
    expect(screen.getByText("Mostrando 201-234 de 234 registros")).toBeInTheDocument()
  })

  it("deshabilita el botón Anterior en la primera página", () => {
    render(<Pagination {...defaultProps} page={1} />)
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled()
  })

  it("deshabilita el botón Siguiente en la última página", () => {
    render(<Pagination {...defaultProps} page={5} />)
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled()
  })

  it("llama onPageChange al hacer clic en Siguiente", () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("llama onPageChange al hacer clic en Anterior", () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole("button", { name: /anterior/i }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("muestra la página actual y total de páginas", () => {
    render(<Pagination {...defaultProps} page={2} />)
    expect(screen.getByText("Página 2 de 5")).toBeInTheDocument()
  })
})

// ─── LoadingSpinner ──────────────────────────────────────────────────────────

describe("LoadingSpinner", () => {
  it("renderiza con texto accesible", () => {
    render(<LoadingSpinner />)
    expect(screen.getByText("Cargando…")).toBeInTheDocument()
  })

  it("aplica la clase de tamaño sm", () => {
    const { container } = render(<LoadingSpinner size="sm" />)
    const spinner = container.querySelector("output")
    expect(spinner?.className).toContain("size-4")
  })

  it("aplica la clase de tamaño lg", () => {
    const { container } = render(<LoadingSpinner size="lg" />)
    const spinner = container.querySelector("output")
    expect(spinner?.className).toContain("size-12")
  })

  it("acepta className adicional", () => {
    const { container } = render(<LoadingSpinner className="mt-4" />)
    const spinner = container.querySelector("output")
    expect(spinner?.className).toContain("mt-4")
  })
})

// ─── DataTable ───────────────────────────────────────────────────────────────

type TestRow = { id: number; name: string; price: number }

const testColumns: ColumnDef<TestRow>[] = [
  { header: "ID", accessor: "id", sortable: true },
  { header: "Nombre", accessor: "name", sortable: true },
  { header: "Precio", accessor: "price", sortable: true },
]

const testData: TestRow[] = [
  { id: 1, name: "Zapato Oxford", price: 1200 },
  { id: 2, name: "Tenis Sport", price: 890 },
  { id: 3, name: "Sandalia Verano", price: 450 },
]

describe("DataTable", () => {
  it("renderiza los encabezados de columna", () => {
    render(<DataTable columns={testColumns} data={testData} />)
    expect(screen.getByText("ID")).toBeInTheDocument()
    expect(screen.getByText("Nombre")).toBeInTheDocument()
    expect(screen.getByText("Precio")).toBeInTheDocument()
  })

  it("renderiza las filas de datos", () => {
    render(<DataTable columns={testColumns} data={testData} />)
    expect(screen.getByText("Zapato Oxford")).toBeInTheDocument()
    expect(screen.getByText("Tenis Sport")).toBeInTheDocument()
    expect(screen.getByText("Sandalia Verano")).toBeInTheDocument()
  })

  it("muestra mensaje vacío cuando no hay datos", () => {
    render(<DataTable columns={testColumns} data={[]} />)
    expect(screen.getByText("No se encontraron registros.")).toBeInTheDocument()
  })

  it("muestra mensaje vacío personalizado", () => {
    render(
      <DataTable
        columns={testColumns}
        data={[]}
        emptyMessage="Sin productos"
      />
    )
    expect(screen.getByText("Sin productos")).toBeInTheDocument()
  })

  it("muestra skeleton cuando isLoading es true", () => {
    const { container } = render(
      <DataTable columns={testColumns} data={[]} isLoading />
    )
    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("ordena por columna al hacer clic en el encabezado", () => {
    render(<DataTable columns={testColumns} data={testData} />)

    // Click on "Precio" header to sort ascending
    fireEvent.click(screen.getByText("Precio"))

    const cells = screen.getAllByRole("cell")
    // After sorting by price asc: 450, 890, 1200
    // First row cells: id, name, price
    const priceCells = cells.filter((_, i) => i % 3 === 2)
    expect(priceCells[0].textContent).toBe("450")
    expect(priceCells[1].textContent).toBe("890")
    expect(priceCells[2].textContent).toBe("1200")
  })

  it("invierte el orden al hacer clic dos veces", () => {
    render(<DataTable columns={testColumns} data={testData} />)

    // Click twice on "Precio" for descending
    fireEvent.click(screen.getByText("Precio"))
    fireEvent.click(screen.getByText("Precio"))

    const cells = screen.getAllByRole("cell")
    const priceCells = cells.filter((_, i) => i % 3 === 2)
    expect(priceCells[0].textContent).toBe("1200")
    expect(priceCells[1].textContent).toBe("890")
    expect(priceCells[2].textContent).toBe("450")
  })

  it("soporta función de acceso personalizada", () => {
    const columns: ColumnDef<TestRow>[] = [
      { header: "Etiqueta", accessor: (row) => `${row.name} ($${row.price})` },
    ]
    render(<DataTable columns={columns} data={[testData[0]]} />)
    expect(screen.getByText("Zapato Oxford ($1200)")).toBeInTheDocument()
  })

  it("soporta renderizado personalizado de celda", () => {
    const columns: ColumnDef<TestRow>[] = [
      {
        header: "Precio",
        accessor: "price",
        cell: (row) => <strong>${row.price}</strong>,
      },
    ]
    render(<DataTable columns={columns} data={[testData[0]]} />)
    expect(screen.getByText("$1200")).toBeInTheDocument()
  })
})

// ─── ErrorBoundary ───────────────────────────────────────────────────────────

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error message")
  return <div>Contenido normal</div>
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it("renderiza los hijos cuando no hay error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText("Contenido normal")).toBeInTheDocument()
  })

  it("muestra UI de fallback cuando hay un error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument()
    expect(screen.getByText("Test error message")).toBeInTheDocument()
  })

  it("muestra botón Reintentar", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument()
  })

  it("renderiza fallback personalizado si se proporciona", () => {
    render(
      <ErrorBoundary fallback={<div>Error personalizado</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText("Error personalizado")).toBeInTheDocument()
  })
})
