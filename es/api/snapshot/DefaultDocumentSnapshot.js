/**
 * Default implementation of DocumentSnapshot for newly created documents
 * or documents without incremental save support.
 */
export class DefaultDocumentSnapshot {
    constructor(originalBytes = new Uint8Array(0), snapshotRefs = new Set(), highestObjectNumber = 0) {
        this.originalBytes = originalBytes;
        this.snapshotRefs = snapshotRefs;
        this.highestObjectNumber = highestObjectNumber;
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
//# sourceMappingURL=DefaultDocumentSnapshot.js.map