import { __awaiter } from "tslib";
import PDFHeader from '../document/PDFHeader.js';
import PDFTrailer from '../document/PDFTrailer.js';
import PDFInvalidObject from '../objects/PDFInvalidObject.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import PDFCatalog from '../structures/PDFCatalog.js';
import PDFPageTree from '../structures/PDFPageTree.js';
import PDFPageLeaf from '../structures/PDFPageLeaf.js';
import PDFCrossRefStream from '../structures/PDFCrossRefStream.js';
import PDFObjectStream from '../structures/PDFObjectStream.js';
import PDFWriter from './PDFWriter.js';
import { last, waitForTick, copyStringIntoBuffer } from '../../utils/index.js';
import CharCodes from '../syntax/CharCodes.js';
class PDFStreamWriter extends PDFWriter {
    constructor(context, objectsPerTick, encodeStreams, objectsPerStream) {
        super(context, objectsPerTick);
        this.encodeStreams = encodeStreams;
        this.objectsPerStream = objectsPerStream;
    }
    computeBufferSize() {
        return __awaiter(this, void 0, void 0, function* () {
            let objectNumber = this.context.largestObjectNumber + 1;
            const header = PDFHeader.forVersion(1, 7);
            let size = header.sizeInBytes() + 2;
            const xrefStream = PDFCrossRefStream.create(this.createTrailerDict(), this.encodeStreams);
            const uncompressedObjects = [];
            const compressedObjects = [];
            const objectStreamRefs = [];
            const security = this.context.security;
            const indirectObjects = this.context.enumerateIndirectObjects();
            for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
                const indirectObject = indirectObjects[idx];
                const [ref, object] = indirectObject;
                const shouldNotCompress = ref === this.context.trailerInfo.Encrypt ||
                    object instanceof PDFStream ||
                    object instanceof PDFInvalidObject ||
                    object instanceof PDFCatalog ||
                    object instanceof PDFPageTree ||
                    object instanceof PDFPageLeaf ||
                    ref.generationNumber !== 0;
                if (shouldNotCompress) {
                    uncompressedObjects.push(indirectObject);
                    if (security)
                        this.encrypt(ref, object, security);
                    xrefStream.addUncompressedEntry(ref, size);
                    size += this.computeIndirectObjectSize(indirectObject);
                    if (this.shouldWaitForTick(1))
                        yield waitForTick();
                }
                else {
                    let chunk = last(compressedObjects);
                    let objectStreamRef = last(objectStreamRefs);
                    if (!chunk || chunk.length % this.objectsPerStream === 0) {
                        chunk = [];
                        compressedObjects.push(chunk);
                        objectStreamRef = PDFRef.of(objectNumber++);
                        objectStreamRefs.push(objectStreamRef);
                    }
                    xrefStream.addCompressedEntry(ref, objectStreamRef, chunk.length);
                    chunk.push(indirectObject);
                }
            }
            for (let idx = 0, len = compressedObjects.length; idx < len; idx++) {
                const chunk = compressedObjects[idx];
                const ref = objectStreamRefs[idx];
                const objectStream = PDFObjectStream.withContextAndObjects(this.context, chunk, this.encodeStreams);
                if (security)
                    this.encrypt(ref, objectStream, security);
                xrefStream.addUncompressedEntry(ref, size);
                size += this.computeIndirectObjectSize([ref, objectStream]);
                uncompressedObjects.push([ref, objectStream]);
                if (this.shouldWaitForTick(chunk.length))
                    yield waitForTick();
            }
            const xrefStreamRef = PDFRef.of(objectNumber++);
            xrefStream.dict.set(PDFName.of('Size'), PDFNumber.of(objectNumber));
            xrefStream.addUncompressedEntry(xrefStreamRef, size);
            const xrefOffset = size;
            size += this.computeIndirectObjectSize([xrefStreamRef, xrefStream]);
            uncompressedObjects.push([xrefStreamRef, xrefStream]);
            const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
            size += trailer.sizeInBytes();
            return { size, header, indirectObjects: uncompressedObjects, trailer };
        });
    }
    serializeToBufferIncremental(snapshot) {
        return __awaiter(this, void 0, void 0, function* () {
            const originalByteLength = snapshot.getOriginalByteLength();
            // Compute only changed/new objects
            const { size, indirectObjects, trailer } = yield this.computeIncrementalBufferSizeWithStreams(snapshot, originalByteLength);
            let offset = 0;
            const buffer = new Uint8Array(size);
            // Write changed/new objects
            for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
                const [ref, object] = indirectObjects[idx];
                const objectNumber = String(ref.objectNumber);
                offset += copyStringIntoBuffer(objectNumber, buffer, offset);
                buffer[offset++] = CharCodes.Space;
                const generationNumber = String(ref.generationNumber);
                offset += copyStringIntoBuffer(generationNumber, buffer, offset);
                buffer[offset++] = CharCodes.Space;
                buffer[offset++] = CharCodes.o;
                buffer[offset++] = CharCodes.b;
                buffer[offset++] = CharCodes.j;
                buffer[offset++] = CharCodes.Newline;
                offset += object.copyBytesInto(buffer, offset);
                buffer[offset++] = CharCodes.Newline;
                buffer[offset++] = CharCodes.e;
                buffer[offset++] = CharCodes.n;
                buffer[offset++] = CharCodes.d;
                buffer[offset++] = CharCodes.o;
                buffer[offset++] = CharCodes.b;
                buffer[offset++] = CharCodes.j;
                buffer[offset++] = CharCodes.Newline;
                buffer[offset++] = CharCodes.Newline;
                const n = object instanceof PDFObjectStream ? object.getObjectsCount() : 1;
                if (this.shouldWaitForTick(n))
                    yield waitForTick();
            }
            offset += trailer.copyBytesInto(buffer, offset);
            return buffer;
        });
    }
    computeIncrementalBufferSizeWithStreams(snapshot, startOffset) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const xrefStream = PDFCrossRefStream.create(trailerDict, this.encodeStreams);
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
                    const isSignature = object instanceof PDFStream &&
                        object.dict.has(PDFName.of('Type')) &&
                        object.dict.get(PDFName.of('Type')) === PDFName.of('Sig');
                    const shouldNotCompress = ref === this.context.trailerInfo.Encrypt ||
                        object instanceof PDFStream ||
                        object instanceof PDFInvalidObject ||
                        object instanceof PDFCatalog ||
                        object instanceof PDFPageTree ||
                        object instanceof PDFPageLeaf ||
                        isSignature ||
                        ref.generationNumber !== 0;
                    if (shouldNotCompress) {
                        if (security)
                            this.encrypt(ref, object, security);
                        xrefStream.addUncompressedEntry(ref, startOffset + size);
                        size += this.computeIndirectObjectSize(indirectObject);
                        uncompressedObjects.push(indirectObject);
                        if (this.shouldWaitForTick(1))
                            yield waitForTick();
                    }
                    else {
                        let chunk = last(compressedObjects);
                        let objectStreamRef = last(objectStreamRefs);
                        if (!chunk || chunk.length % this.objectsPerStream === 0) {
                            chunk = [];
                            compressedObjects.push(chunk);
                            objectStreamRef = PDFRef.of(objectNumber++);
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
                const objectStream = PDFObjectStream.withContextAndObjects(this.context, chunk, this.encodeStreams);
                if (security)
                    this.encrypt(ref, objectStream, security);
                xrefStream.addUncompressedEntry(ref, startOffset + size);
                size += this.computeIndirectObjectSize([ref, objectStream]);
                uncompressedObjects.push([ref, objectStream]);
                if (this.shouldWaitForTick(chunk.length))
                    yield waitForTick();
            }
            const xrefStreamRef = PDFRef.of(objectNumber++);
            xrefStream.dict.set(PDFName.of('Size'), PDFNumber.of(objectNumber));
            xrefStream.addUncompressedEntry(xrefStreamRef, startOffset + size);
            const xrefOffset = startOffset + size;
            size += this.computeIndirectObjectSize([xrefStreamRef, xrefStream]);
            uncompressedObjects.push([xrefStreamRef, xrefStream]);
            const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
            size += trailer.sizeInBytes();
            return { size, indirectObjects: uncompressedObjects, trailer };
        });
    }
}
PDFStreamWriter.forContext = (context, objectsPerTick, encodeStreams = true, objectsPerStream = 50) => new PDFStreamWriter(context, objectsPerTick, encodeStreams, objectsPerStream);
export default PDFStreamWriter;
//# sourceMappingURL=PDFStreamWriter.js.map