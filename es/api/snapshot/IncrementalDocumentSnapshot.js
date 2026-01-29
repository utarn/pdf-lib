/**
 * Implementation of DocumentSnapshot that tracks the state of a document
 * for incremental saving. This allows appending updates to an existing PDF
 * rather than rewriting the entire document.
 */
export class IncrementalDocumentSnapshot {
    constructor(originalBytes, snapshotRefs, highestObjectNumber) {
        this.originalBytes = originalBytes;
        this.snapshotRefs = snapshotRefs;
        this.highestObjectNumber = highestObjectNumber;
    }
    /**
     * Create a snapshot from the current state of a document.
     */
    static fromDocument(originalBytes, existingRefs) {
        const snapshotRefs = new Set(existingRefs);
        const highestObjectNumber = existingRefs.reduce((max, ref) => Math.max(max, ref.objectNumber), 0);
        return new IncrementalDocumentSnapshot(originalBytes, snapshotRefs, highestObjectNumber);
    }
    getOriginalBytes() {
        return this.originalBytes;
    }
    getOriginalByteLength() {
        return this.originalBytes.length;
    }
    getSnapshotRefs() {
        return new Set(this.snapshotRefs);
    }
    hasRef(ref) {
        for (const snapshotRef of this.snapshotRefs) {
            if (snapshotRef.objectNumber === ref.objectNumber &&
                snapshotRef.generationNumber === ref.generationNumber) {
                return true;
            }
        }
        return false;
    }
    getHighestObjectNumber() {
        return this.highestObjectNumber;
    }
}
//# sourceMappingURL=IncrementalDocumentSnapshot.js.map