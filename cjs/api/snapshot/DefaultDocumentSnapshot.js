"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultDocumentSnapshot = void 0;
/**
 * Default implementation of DocumentSnapshot for newly created documents
 * or documents without incremental save support.
 */
class DefaultDocumentSnapshot {
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
exports.DefaultDocumentSnapshot = DefaultDocumentSnapshot;
//# sourceMappingURL=DefaultDocumentSnapshot.js.map