import PDFRef from '../../core/objects/PDFRef';
import { DocumentSnapshot } from './DocumentSnapshot';
/**
 * Default implementation of DocumentSnapshot for newly created documents
 * or documents without incremental save support.
 */
export declare class DefaultDocumentSnapshot implements DocumentSnapshot {
    private readonly originalBytes;
    private readonly snapshotRefs;
    private readonly highestObjectNumber;
    constructor(originalBytes?: Uint8Array, snapshotRefs?: Set<PDFRef>, highestObjectNumber?: number);
    getOriginalBytes(): Uint8Array;
    getOriginalByteLength(): number;
    getSnapshotRefs(): Set<PDFRef>;
    hasRef(ref: PDFRef): boolean;
    getHighestObjectNumber(): number;
}
//# sourceMappingURL=DefaultDocumentSnapshot.d.ts.map