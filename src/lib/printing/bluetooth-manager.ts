/**
 * Bluetooth printer connection manager using the Web Bluetooth API.
 *
 * Handles discovery, connection, data transmission, and disconnection
 * for ESC/POS thermal printers over Bluetooth.
 *
 * Validates: Requirements 10.3, 10.4
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Common Bluetooth service UUID for serial port profile (SPP).
 * Most ESC/POS thermal printers expose this service.
 */
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';

/**
 * Common characteristic UUID for writing data to the printer.
 */
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

/**
 * Maximum bytes per write chunk.
 * BLE has a typical MTU of ~512 bytes; we use a safe chunk size.
 */
const CHUNK_SIZE = 512;

/**
 * Delay between chunks in milliseconds to avoid overwhelming the printer buffer.
 */
const CHUNK_DELAY_MS = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BluetoothPrinterInfo {
  id: string;
  name: string;
}

export type ConnectionEventHandler = (
  event: 'connected' | 'disconnected' | 'error',
  detail?: string,
) => void;

// ─── Helper ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── BluetoothPrinterManager ─────────────────────────────────────────────────

/**
 * Manages a single Bluetooth printer connection.
 *
 * Usage:
 * ```ts
 * const manager = new BluetoothPrinterManager();
 * await manager.connect();
 * await manager.print(ticketBytes);
 * manager.disconnect();
 * ```
 */
export class BluetoothPrinterManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private eventHandler: ConnectionEventHandler | null = null;

  /**
   * Register an event handler for connection state changes.
   */
  onEvent(handler: ConnectionEventHandler): void {
    this.eventHandler = handler;
  }

  private emit(
    event: 'connected' | 'disconnected' | 'error',
    detail?: string,
  ): void {
    this.eventHandler?.(event, detail);
  }

  /**
   * Check if Web Bluetooth API is available in the current browser.
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Check if the printer is currently connected.
   */
  isConnected(): boolean {
    return this.server?.connected === true;
  }

  /**
   * Get info about the currently connected device.
   */
  getDeviceInfo(): BluetoothPrinterInfo | null {
    if (!this.device) return null;
    return {
      id: this.device.id,
      name: this.device.name ?? 'Impresora desconocida',
    };
  }

  /**
   * Request a Bluetooth printer and establish a connection.
   *
   * Opens the browser's Bluetooth device picker dialog.
   * The user must select a printer to proceed.
   *
   * @throws Error if Bluetooth is not supported or connection fails
   */
  async connect(): Promise<BluetoothPrinterInfo> {
    if (!BluetoothPrinterManager.isSupported()) {
      throw new Error(
        'Bluetooth no está disponible en este navegador. ' +
          'Usa Chrome o Edge en un dispositivo compatible.',
      );
    }

    try {
      // Request device with printer service filter
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [PRINTER_SERVICE_UUID] }],
        optionalServices: [PRINTER_SERVICE_UUID],
      });

      // Listen for disconnection
      this.device.addEventListener(
        'gattserverdisconnected',
        this.handleDisconnect,
      );

      // Connect to GATT server
      if (!this.device.gatt) {
        throw new Error('El dispositivo no soporta GATT.');
      }

      this.server = await this.device.gatt.connect();

      // Get the printer service and characteristic
      const service = await this.server.getPrimaryService(PRINTER_SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(
        PRINTER_CHARACTERISTIC_UUID,
      );

      const info = this.getDeviceInfo()!;
      this.emit('connected', info.name);
      return info;
    } catch (err) {
      this.cleanup();

      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw new Error(
          'No se seleccionó ninguna impresora. ' +
            'Asegúrate de que la impresora esté encendida y emparejada.',
        );
      }

      if (err instanceof DOMException && err.name === 'SecurityError') {
        throw new Error(
          'Permiso de Bluetooth denegado. ' +
            'Permite el acceso a Bluetooth en la configuración del navegador.',
        );
      }

      throw new Error(
        `Error al conectar con la impresora: ${err instanceof Error ? err.message : 'Error desconocido'}`,
      );
    }
  }

  /**
   * Connect to a previously paired device by ID (auto-reconnect).
   *
   * Note: Web Bluetooth API doesn't support connecting by ID directly
   * without user gesture. This attempts to reconnect if the device
   * reference is still available.
   */
  async reconnect(): Promise<boolean> {
    if (!this.device?.gatt) return false;

    try {
      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(PRINTER_SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(
        PRINTER_CHARACTERISTIC_UUID,
      );
      this.emit('connected', this.device.name ?? 'Impresora');
      return true;
    } catch {
      this.emit('error', 'No se pudo reconectar con la impresora.');
      return false;
    }
  }

  /**
   * Send data to the connected printer.
   *
   * Splits the data into chunks to avoid exceeding the BLE MTU.
   *
   * @param data - Raw ESC/POS bytes to send
   * @throws Error if not connected or write fails
   */
  async print(data: Uint8Array): Promise<void> {
    if (!this.isConnected() || !this.characteristic) {
      throw new Error(
        'Impresora no conectada. Conecta una impresora antes de imprimir.',
      );
    }

    try {
      // Send data in chunks
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        await this.characteristic.writeValueWithoutResponse(chunk);

        // Small delay between chunks to let the printer process
        if (offset + CHUNK_SIZE < data.length) {
          await delay(CHUNK_DELAY_MS);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido';
      this.emit('error', `Error al imprimir: ${message}`);
      throw new Error(`Error al enviar datos a la impresora: ${message}`);
    }
  }

  /**
   * Disconnect from the current printer.
   */
  disconnect(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.cleanup();
    this.emit('disconnected');
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private handleDisconnect = (): void => {
    this.server = null;
    this.characteristic = null;
    this.emit('disconnected');
  };

  private cleanup(): void {
    if (this.device) {
      this.device.removeEventListener(
        'gattserverdisconnected',
        this.handleDisconnect,
      );
    }
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }
}
