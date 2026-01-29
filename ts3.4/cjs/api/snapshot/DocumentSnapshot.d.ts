import PDFRef from '../../core/objects/PDFRef';
/**
 * Interface representing a snapshot of a PDF document's state.
 * Used for incremental saving to track which objects have changed.
 */
export interface DocumentSnapshot {
    /**
     * Get the original PDF bytes when the snapshot was taken.
     * For new documents, this will be empty.
     */
    getOriginalBytes(): Uint8Array;
    /**
     * Get the byte offset where the original document ends.
     * This is where incremental updates should begin.
     */
    getOriginalByteLength(): number;
    /**
     * Get the set of object references that existed when the snapshot was taken.
     */
    getSnapshotRefs(): Set<PDFRef>;
    /**
     * Check if a reference existed in the snapshot.
     */
    hasRef(ref: PDFRef): boolean;
    /**
     * Get the highest object number that existed in the snapshot.
     */
    getHighestObjectNumber(): number;
}
//# sourceMappingURL=DocumentSnapshot.d.ts.map
