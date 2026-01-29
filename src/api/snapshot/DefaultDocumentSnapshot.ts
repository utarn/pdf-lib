import PDFRef from '../../core/objects/PDFRef';
import { DocumentSnapshot } from './DocumentSnapshot';

/**
 * Default implementation of DocumentSnapshot for newly created documents
 * or documents without incremental save support.
 */
export class DefaultDocumentSnapshot implements DocumentSnapshot {
  private readonly originalBytes: Uint8Array;
  private readonly snapshotRefs: Set<PDFRef>;
  private readonly highestObjectNumber: number;

  constructor(
    originalBytes: Uint8Array = new Uint8Array(0),
    snapshotRefs: Set<PDFRef> = new Set(),
    highestObjectNumber: number = 0,
  ) {
    this.originalBytes = originalBytes;
    this.snapshotRefs = snapshotRefs;
    this.highestObjectNumber = highestObjectNumber;
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
