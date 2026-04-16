import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BarcodeScanner } from '@/components/pos/BarcodeScanner'

// ─── BarcodeScanner ──────────────────────────────────────────────────────────

describe('BarcodeScanner', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onScan: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el título del diálogo cuando está abierto', () => {
    render(<BarcodeScanner {...defaultProps} />)
    expect(screen.getByText('Escanear Código de Barras')).toBeInTheDocument()
  })

  it('muestra la descripción del diálogo', () => {
    render(<BarcodeScanner {...defaultProps} />)
    expect(
      screen.getByText(
        'Apunta la cámara al código de barras del producto (EAN-13 o UPC-A).',
      ),
    ).toBeInTheDocument()
  })

  it('muestra mensaje de navegador no compatible cuando BarcodeDetector no está disponible', async () => {
    // jsdom does not have BarcodeDetector, so it should show unsupported state
    render(<BarcodeScanner {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Navegador no compatible')).toBeInTheDocument()
    })
  })

  it('muestra botón Cancelar', () => {
    render(<BarcodeScanner {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: /cancelar/i }),
    ).toBeInTheDocument()
  })

  it('llama onOpenChange(false) al hacer clic en Cancelar', () => {
    const onOpenChange = vi.fn()
    render(<BarcodeScanner {...defaultProps} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('no renderiza contenido cuando está cerrado', () => {
    render(<BarcodeScanner {...defaultProps} open={false} />)
    expect(
      screen.queryByText('Escanear Código de Barras'),
    ).not.toBeInTheDocument()
  })

  it('muestra texto de fallback con instrucciones para usar la barra de búsqueda', async () => {
    render(<BarcodeScanner {...defaultProps} />)
    await waitFor(() => {
      expect(
        screen.getByText(/escribir el código manualmente/i),
      ).toBeInTheDocument()
    })
  })
})
