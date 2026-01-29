"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const PDFHeader_1 = tslib_1.__importDefault(require("../document/PDFHeader"));
const PDFTrailer_1 = tslib_1.__importDefault(require("../document/PDFTrailer"));
const PDFInvalidObject_1 = tslib_1.__importDefault(require("../objects/PDFInvalidObject"));
const PDFName_1 = tslib_1.__importDefault(require("../objects/PDFName"));
const PDFNumber_1 = tslib_1.__importDefault(require("../objects/PDFNumber"));
const PDFRef_1 = tslib_1.__importDefault(require("../objects/PDFRef"));
const PDFStream_1 = tslib_1.__importDefault(require("../objects/PDFStream"));
const PDFCatalog_1 = tslib_1.__importDefault(require("../structures/PDFCatalog"));
const PDFPageTree_1 = tslib_1.__importDefault(require("../structures/PDFPageTree"));
const PDFPageLeaf_1 = tslib_1.__importDefault(require("../structures/PDFPageLeaf"));
const PDFCrossRefStream_1 = tslib_1.__importDefault(require("../structures/PDFCrossRefStream"));
const PDFObjectStream_1 = tslib_1.__importDefault(require("../structures/PDFObjectStream"));
const PDFWriter_1 = tslib_1.__importDefault(require("./PDFWriter"));
const utils_1 = require("../../utils");
const CharCodes_1 = tslib_1.__importDefault(require("../syntax/CharCodes"));
class PDFStreamWriter extends PDFWriter_1.default {
    constructor(context, objectsPerTick, encodeStreams, objectsPerStream) {
        super(context, objectsPerTick);
        this.encodeStreams = encodeStreams;
        this.objectsPerStream = objectsPerStream;
    }
    computeBufferSize() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let objectNumber = this.context.largestObjectNumber + 1;
            const header = PDFHeader_1.default.forVersion(1, 7);
            let size = header.sizeInBytes() + 2;
            const xrefStream = PDFCrossRefStream_1.default.create(this.createTrailerDict(), this.encodeStreams);
            const uncompressedObjects = [];
            const compressedObjects = [];
            const objectStreamRefs = [];
            const security = this.context.security;
            const indirectObjects = this.context.enumerateIndirectObjects();
            for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
                const indirectObject = indirectObjects[idx];
                const [ref, object] = indirectObject;
                const shouldNotCompress = ref === this.context.trailerInfo.Encrypt ||
                    object instanceof PDFStream_1.default ||
                    object instanceof PDFInvalidObject_1.default ||
                    object instanceof PDFCatalog_1.default ||
                    object instanceof PDFPageTree_1.default ||
                    object instanceof PDFPageLeaf_1.default ||
                    ref.generationNumber !== 0;
                if (shouldNotCompress) {
                    uncompressedObjects.push(indirectObject);
                    if (security)
                        this.encrypt(ref, object, security);
                    xrefStream.addUncompressedEntry(ref, size);
                    size += this.computeIndirectObjectSize(indirectObject);
                    if (this.shouldWaitForTick(1))
                        yield (0, utils_1.waitForTick)();
                }
                else {
                    let chunk = (0, utils_1.last)(compressedObjects);
                    let objectStreamRef = (0, utils_1.last)(objectStreamRefs);
                    if (!chunk || chunk.length % this.objectsPerStream === 0) {
                        chunk = [];
                        compressedObjects.push(chunk);
                        objectStreamRef = PDFRef_1.default.of(objectNumber++);
                        objectStreamRefs.push(objectStreamRef);
                    }
                    xrefStream.addCompressedEntry(ref, objectStreamRef, chunk.length);
                    chunk.push(indirectObject);
                }
            }
            for (let idx = 0, len = compressedObjects.length; idx < len; idx++) {
                const chunk = compressedObjects[idx];
                const ref = objectStreamRefs[idx];
                const objectStream = PDFObjectStream_1.default.withContextAndObjects(this.context, chunk, this.encodeStreams);
                if (security)
                    this.encrypt(ref, objectStream, security);
                xrefStream.addUncompressedEntry(ref, size);
                size += this.computeIndirectObjectSize([ref, objectStream]);
                uncompressedObjects.push([ref, objectStream]);
                if (this.shouldWaitForTick(chunk.length))
                    yield (0, utils_1.waitForTick)();
            }
            const xrefStreamRef = PDFRef_1.default.of(objectNumber++);
            xrefStream.dict.set(PDFName_1.default.of('Size'), PDFNumber_1.default.of(objectNumber));
            xrefStream.addUncompressedEntry(xrefStreamRef, size);
            const xrefOffset = size;
            size += this.computeIndirectObjectSize([xrefStreamRef, xrefStream]);
            uncompressedObjects.push([xrefStreamRef, xrefStream]);
            const trailer = PDFTrailer_1.default.forLastCrossRefSectionOffset(xrefOffset);
            size += trailer.sizeInBytes();
            return { size, header, indirectObjects: uncompressedObjects, trailer };
        });
    }
    serializeToBufferIncremental(snapshot) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const originalByteLength = snapshot.getOriginalByteLength();
            // Compute only changed/new objects
            const { size, indirectObjects, trailer } = yield this.computeIncrementalBufferSizeWithStreams(snapshot, originalByteLength);
            let offset = 0;
            const buffer = new Uint8Array(size);
            // Write changed/new objects
            for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
                const [ref, object] = indirectObjects[idx];
                const objectNumber = String(ref.objectNumber);
                offset += (0, utils_1.copyStringIntoBuffer)(objectNumber, buffer, offset);
                buffer[offset++] = CharCodes_1.default.Space;
                const generationNumber = String(ref.generationNumber);
                offset += (0, utils_1.copyStringIntoBuffer)(generationNumber, buffer, offset);
                buffer[offset++] = CharCodes_1.default.Space;
                buffer[offset++] = CharCodes_1.default.o;
                buffer[offset++] = CharCodes_1.default.b;
                buffer[offset++] = CharCodes_1.default.j;
                buffer[offset++] = CharCodes_1.default.Newline;
                offset += object.copyBytesInto(buffer, offset);
                buffer[offset++] = CharCodes_1.default.Newline;
                buffer[offset++] = CharCodes_1.default.e;
                buffer[offset++] = CharCodes_1.default.n;
                buffer[offset++] = CharCodes_1.default.d;
                buffer[offset++] = CharCodes_1.default.o;
                buffer[offset++] = CharCodes_1.default.b;
                buffer[offset++] = CharCodes_1.default.j;
                buffer[offset++] = CharCodes_1.default.Newline;
                buffer[offset++] = CharCodes_1.default.Newline;
                const n = object instanceof PDFObjectStream_1.default ? object.getObjectsCount() : 1;
                if (this.shouldWaitForTick(n))
                    yield (0, utils_1.waitForTick)();
            }
            offset += trailer.copyBytesInto(buffer, offset);
            return buffer;
        });
    }
    computeIncrementalBufferSizeWithStreams(snapshot, startOffset) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let objectNumber = this.context.largestObjectNumber + 1;
            let size = 0;
            const originalBytes = snapshot.getOriginalBytes();
            let prevXRefOffset = 0;
            // Search for "startxref" from the end of the original document
            const startxrefBytes = new TextEncoder().encode('startxref');
            for (let i = originalBytes.length - startxrefBytes.length; i >= 0; i--) {
                let match = true;
                for (let j = 0; j < startxrefBytes.length; j++) {
                    if (originalBytes[i + j] !== startxrefBytes[j]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    let numStart = i + startxrefBytes.length;
                    while (numStart < originalBytes.length &&
                        (originalBytes[numStart] === 32 ||
                            originalBytes[numStart] === 10 ||
                            originalBytes[numStart] === 13)) {
                        numStart++;
                    }
                    let numEnd = numStart;
                    while (numEnd < originalBytes.length &&
                        originalBytes[numEnd] >= 48 &&
                        originalBytes[numEnd] <= 57) {
                        numEnd++;
                    }
                    const numStr = new TextDecoder().decode(originalBytes.slice(numStart, numEnd));
                    prevXRefOffset = parseInt(numStr, 10);
                    break;
                }
            }
            const trailerDict = this.createIncrementalTrailerDict(prevXRefOffset);
            const xrefStream = PDFCrossRefStream_1.default.create(trailerDict, this.encodeStreams);
            const uncompressedObjects = [];
            const compressedObjects = [];
            const objectStreamRefs = [];
            const security = this.context.security;
            // Filter to only new/modified objects
            const allIndirectObjects = this.context.enumerateIndirectObjects();
            for (let idx = 0, len = allIndirectObjects.length; idx < len; idx++) {
                const indirectObject = allIndirectObjects[idx];
                const [ref, object] = indirectObject;
                // Include if it's a new object
                if (!snapshot.hasRef(ref)) {
                    // Check if this is a signature object - signatures should not be compressed
                    const isSignature = object instanceof PDFStream_1.default &&
                        object.dict.has(PDFName_1.default.of('Type')) &&
                        object.dict.get(PDFName_1.default.of('Type')) === PDFName_1.default.of('Sig');
                    const shouldNotCompress = ref === this.context.trailerInfo.Encrypt ||
                        object instanceof PDFStream_1.default ||
                        object instanceof PDFInvalidObject_1.default ||
                        object instanceof PDFCatalog_1.default ||
                        object instanceof PDFPageTree_1.default ||
                        object instanceof PDFPageLeaf_1.default ||
                        isSignature ||
                        ref.generationNumber !== 0;
                    if (shouldNotCompress) {
                        if (security)
                            this.encrypt(ref, object, security);
                        xrefStream.addUncompressedEntry(ref, startOffset + size);
                        size += this.computeIndirectObjectSize(indirectObject);
                        uncompressedObjects.push(indirectObject);
                        if (this.shouldWaitForTick(1))
                            yield (0, utils_1.waitForTick)();
                    }
                    else {
                        let chunk = (0, utils_1.last)(compressedObjects);
                        let objectStreamRef = (0, utils_1.last)(objectStreamRefs);
                        if (!chunk || chunk.length % this.objectsPerStream === 0) {
                            chunk = [];
                            compressedObjects.push(chunk);
                            objectStreamRef = PDFRef_1.default.of(objectNumber++);
                            objectStreamRefs.push(objectStreamRef);
                        }
                        xrefStream.addCompressedEntry(ref, objectStreamRef, chunk.length);
                        chunk.push(indirectObject);
                    }
                }
            }
            // Process compressed object streams
            for (let idx = 0, len = compressedObjects.length; idx < len; idx++) {
                const chunk = compressedObjects[idx];
                const ref = objectStreamRefs[idx];
                const objectStream = PDFObjectStream_1.default.withContextAndObjects(this.context, chunk, this.encodeStreams);
                if (security)
                    this.encrypt(ref, objectStream, security);
                xrefStream.addUncompressedEntry(ref, startOffset + size);
                size += this.computeIndirectObjectSize([ref, objectStream]);
                uncompressedObjects.push([ref, objectStream]);
                if (this.shouldWaitForTick(chunk.length))
                    yield (0, utils_1.waitForTick)();
            }
            const xrefStreamRef = PDFRef_1.default.of(objectNumber++);
            xrefStream.dict.set(PDFName_1.default.of('Size'), PDFNumber_1.default.of(objectNumber));
            xrefStream.addUncompressedEntry(xrefStreamRef, startOffset + size);
            const xrefOffset = startOffset + size;
            size += this.computeIndirectObjectSize([xrefStreamRef, xrefStream]);
            uncompressedObjects.push([xrefStreamRef, xrefStream]);
            const trailer = PDFTrailer_1.default.forLastCrossRefSectionOffset(xrefOffset);
            size += trailer.sizeInBytes();
            return { size, indirectObjects: uncompressedObjects, trailer };
        });
    }
}
PDFStreamWriter.forContext = (context, objectsPerTick, encodeStreams = true, objectsPerStream = 50) => new PDFStreamWriter(context, objectsPerTick, encodeStreams, objectsPerStream);
exports.default = PDFStreamWriter;
//# sourceMappingURL=PDFStreamWriter.js.map