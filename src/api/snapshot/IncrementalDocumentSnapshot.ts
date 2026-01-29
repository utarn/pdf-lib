import PDFRef from '../../core/objects/PDFRef';
import { DocumentSnapshot } from './DocumentSnapshot';

/**
 * Implementation of DocumentSnapshot that tracks the state of a document
 * for incremental saving. This allows appending updates to an existing PDF
 * rather than rewriting the entire document.
 */
export class IncrementalDocumentSnapshot implements DocumentSnapshot {
  private readonly originalBytes: Uint8Array;
  private readonly snapshotRefs: Set<PDFRef>;
  private readonly highestObjectNumber: number;

  constructor(
    originalBytes: Uint8Array,
    snapshotRefs: Set<PDFRef>,
    highestObjectNumber: number,
  ) {
    this.originalBytes = originalBytes;
    this.snapshotRefs = snapshotRefs;
    this.highestObjectNumber = highestObjectNumber;
  }

  /**
   * Create a snapshot from the current state of a document.
   */
  static fromDocument(
    originalBytes: Uint8Array,
    existingRefs: PDFRef[],
  ): IncrementalDocumentSnapshot {
    const snapshotRefs = new Set(existingRefs);
    const highestObjectNumber = existingRefs.reduce(
      (max, ref) => Math.max(max, ref.objectNumber),
      0,
    );

    return new IncrementalDocumentSnapshot(
      originalBytes,
      snapshotRefs,
      highestObjectNumber,
    );
  }

  getOriginalBytes(): Uint8Array {
    return this.originalBytes;
  }

  getOriginalByteLength(): number {
    return this.originalBytes.length;
  }

  getSnapshotRefs(): Set<PDFRef> {
    return new Set(this.snapshotRefs);
  }

  hasRef(ref: PDFRef): boolean {
    for (const snapshotRef of this.snapshotRefs) {
      if (
        snapshotRef.objectNumber === ref.objectNumber &&
        snapshotRef.generationNumber === ref.generationNumber
      ) {
        return true;
      }
    }
    return false;
  }

  getHighestObjectNumber(): number {
    return this.highestObjectNumber;
  }
}
