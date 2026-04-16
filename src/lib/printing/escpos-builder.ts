/**
 * ESC/POS ticket builder using raw byte commands.
 *
 * Builds a Uint8Array of ESC/POS commands for thermal printers (58mm / 80mm).
 * Supports: text alignment, bold, double-size text, line feeds, and paper cut.
 *
 * Validates: Requirements 10.1, 10.2
 */

import type { PaperWidth, TicketData } from '@/types/printing';
import { PAPER_WIDTH_CHARS } from '@/lib/constants';
import { buildTicketLayout } from './ticket-template';

// ─── ESC/POS Command Constants ───────────────────────────────────────────────

/** ESC/POS command bytes */
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Initialize printer */
const CMD_INIT = new Uint8Array([ESC, 0x40]);

/** Text alignment */
const CMD_ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const CMD_ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const CMD_ALIGN_RIGHT = new Uint8Array([ESC, 0x61, 0x02]);

/** Bold on/off */
const CMD_BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const CMD_BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);

/** Double-height + double-width text */
const CMD_SIZE_NORMAL = new Uint8Array([GS, 0x21, 0x00]);
const CMD_SIZE_DOUBLE = new Uint8Array([GS, 0x21, 0x11]);
const CMD_SIZE_DOUBLE_HEIGHT = new Uint8Array([GS, 0x21, 0x01]);

/** Paper cut (partial) */
const CMD_CUT = new Uint8Array([GS, 0x56, 0x41, 0x03]);

/** Line feed */
const CMD_LF = new Uint8Array([LF]);

// ─── Text Encoder ────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

// ─── Alignment type ──────────────────────────────────────────────────────────

export type TextAlign = 'left' | 'center' | 'right';
export type TextSize = 'normal' | 'double' | 'double-height';

// ─── Instruction types for the builder ───────────────────────────────────────

export interface TextInstruction {
  type: 'text';
  content: string;
  align?: TextAlign;
  bold?: boolean;
  size?: TextSize;
}

export interface LineFeedInstruction {
  type: 'feed';
  lines?: number;
}

export interface SeparatorInstruction {
  type: 'separator';
  char?: string;
}

export interface CutInstruction {
  type: 'cut';
}

export type PrintInstruction =
  | TextInstruction
  | LineFeedInstruction
  | SeparatorInstruction
  | CutInstruction;

// ─── ESC/POS Builder Class ───────────────────────────────────────────────────

/**
 * Low-level ESC/POS byte buffer builder.
 *
 * Accumulates ESC/POS commands and text into a single Uint8Array.
 */
export class ESCPOSBuilder {
  private buffers: Uint8Array[] = [];
  private readonly width: number;

  constructor(paperWidth: PaperWidth = '80mm') {
    this.width = PAPER_WIDTH_CHARS[paperWidth];
    this.buffers.push(CMD_INIT);
  }

  /** Set text alignment. */
  align(alignment: TextAlign): this {
    switch (alignment) {
      case 'left':
        this.buffers.push(CMD_ALIGN_LEFT);
        break;
      case 'center':
        this.buffers.push(CMD_ALIGN_CENTER);
        break;
      case 'right':
        this.buffers.push(CMD_ALIGN_RIGHT);
        break;
    }
    return this;
  }

  /** Toggle bold mode. */
  bold(on: boolean): this {
    this.buffers.push(on ? CMD_BOLD_ON : CMD_BOLD_OFF);
    return this;
  }

  /** Set text size. */
  size(textSize: TextSize): this {
    switch (textSize) {
      case 'normal':
        this.buffers.push(CMD_SIZE_NORMAL);
        break;
      case 'double':
        this.buffers.push(CMD_SIZE_DOUBLE);
        break;
      case 'double-height':
        this.buffers.push(CMD_SIZE_DOUBLE_HEIGHT);
        break;
    }
    return this;
  }

  /** Write text followed by a line feed. */
  writeLine(text: string): this {
    this.buffers.push(encoder.encode(text));
    this.buffers.push(CMD_LF);
    return this;
  }

  /** Write text without a line feed. */
  write(text: string): this {
    this.buffers.push(encoder.encode(text));
    return this;
  }

  /** Add line feeds. */
  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffers.push(CMD_LF);
    }
    return this;
  }

  /** Print a separator line (e.g., "--------------------------------"). */
  separator(char: string = '-'): this {
    this.buffers.push(encoder.encode(char.repeat(this.width)));
    this.buffers.push(CMD_LF);
    return this;
  }

  /** Print a two-column line (left-aligned label, right-aligned value). */
  twoColumns(left: string, right: string): this {
    const gap = this.width - left.length - right.length;
    if (gap <= 0) {
      // Truncate left side if too long
      const maxLeft = this.width - right.length - 1;
      const truncated = left.substring(0, maxLeft);
      this.writeLine(truncated + ' ' + right);
    } else {
      this.writeLine(left + ' '.repeat(gap) + right);
    }
    return this;
  }

  /** Issue a partial paper cut command. */
  cut(): this {
    this.feed(3);
    this.buffers.push(CMD_CUT);
    return this;
  }

  /** Reset formatting to defaults (left-aligned, normal size, no bold). */
  reset(): this {
    this.align('left');
    this.bold(false);
    this.size('normal');
    return this;
  }

  /** Get the character width for this builder. */
  getWidth(): number {
    return this.width;
  }

  /** Build the final byte array from all accumulated buffers. */
  build(): Uint8Array {
    const totalLength = this.buffers.reduce((sum, b) => sum + b.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of this.buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  }
}

// ─── High-level ticket builder ───────────────────────────────────────────────

/**
 * Build a complete ESC/POS ticket from TicketData.
 *
 * Uses the ticket template to generate print instructions, then converts
 * them to raw ESC/POS bytes.
 *
 * @param data - The ticket data to render
 * @param paperWidth - Paper width (default: '80mm')
 * @returns Uint8Array of ESC/POS commands ready to send to the printer
 */
export function buildTicket(
  data: TicketData,
  paperWidth: PaperWidth = '80mm',
): Uint8Array {
  const instructions = buildTicketLayout(data, paperWidth);
  const builder = new ESCPOSBuilder(paperWidth);

  for (const instr of instructions) {
    switch (instr.type) {
      case 'text':
        if (instr.size) builder.size(instr.size);
        if (instr.align) builder.align(instr.align);
        if (instr.bold) builder.bold(true);
        builder.writeLine(instr.content);
        if (instr.bold) builder.bold(false);
        if (instr.size && instr.size !== 'normal') builder.size('normal');
        break;

      case 'feed':
        builder.feed(instr.lines ?? 1);
        break;

      case 'separator':
        builder.separator(instr.char ?? '-');
        break;

      case 'cut':
        builder.cut();
        break;
    }
  }

  return builder.build();
}
