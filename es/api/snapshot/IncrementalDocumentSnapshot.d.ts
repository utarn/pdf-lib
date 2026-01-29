import PDFRef from '../../core/objects/PDFRef';
import { DocumentSnapshot } from './DocumentSnapshot';
/**
 * Implementation of DocumentSnapshot that tracks the state of a document
 * for incremental saving. This allows appending updates to an existing PDF
 * rather than rewriting the entire document.
 */
export declare class IncrementalDocumentSnapshot implements DocumentSnapshot {
    private readonly originalBytes;
    private readonly snapshotRefs;
    private readonly highestObjectNumber;
    constructor(originalBytes: Uint8Array, snapshotRefs: Set<PDFRef>, highestObjectNumber: number);
    /**
     * Create a snapshot from the current state of a document.
     */
    static fromDocument(originalBytes: Uint8Array, existingRefs: PDFRef[]): IncrementalDocumentSnapshot;
    getOriginalBytes(): Uint8Array;
    getOriginalByteLength(): number;
    getSnapshotRefs(): Set<PDFRef>;
    hasRef(ref: PDFRef): boolean;
    getHighestObjectNumber(): number;
}
//# sourceMappingURL=IncrementalDocumentSnapshot.d.ts.map