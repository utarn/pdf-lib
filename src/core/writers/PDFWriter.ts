import PDFCrossRefSection from '../document/PDFCrossRefSection';
import PDFHeader from '../document/PDFHeader';
import PDFTrailer from '../document/PDFTrailer';
import PDFTrailerDict from '../document/PDFTrailerDict';
import PDFDict from '../objects/PDFDict';
import PDFObject from '../objects/PDFObject';
import PDFRef from '../objects/PDFRef';
import PDFStream from '../objects/PDFStream';
import PDFContext from '../PDFContext';
import PDFObjectStream from '../structures/PDFObjectStream';
import PDFSecurity from '../security/PDFSecurity';
import CharCodes from '../syntax/CharCodes';
import { copyStringIntoBuffer, waitForTick } from '../../utils';
import { DocumentSnapshot } from '../../api/snapshot';
import PDFName from '../objects/PDFName';
import PDFNumber from '../objects/PDFNumber';

export interface SerializationInfo {
  size: number;
  header: PDFHeader;
  indirectObjects: [PDFRef, PDFObject][];
  xref?: PDFCrossRefSection;
  trailerDict?: PDFTrailerDict;
  trailer: PDFTrailer;
}

class PDFWriter {
  static forContext = (context: PDFContext, objectsPerTick: number) =>
    new PDFWriter(context, objectsPerTick);

  protected readonly context: PDFContext;

  protected readonly objectsPerTick: number;
  private parsedObjects = 0;

  protected constructor(context: PDFContext, objectsPerTick: number) {
    this.context = context;
    this.objectsPerTick = objectsPerTick;
  }

  async serializeToBuffer(): Promise<Uint8Array> {
    const { size, header, indirectObjects, xref, trailerDict, trailer } =
      await this.computeBufferSize();

    let offset = 0;
    const buffer = new Uint8Array(size);

    offset += header.copyBytesInto(buffer, offset);
    buffer[offset++] = CharCodes.Newline;
    buffer[offset++] = CharCodes.Newline;

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

      const n =
        object instanceof PDFObjectStream ? object.getObjectsCount() : 1;
      if (this.shouldWaitForTick(n)) await waitForTick();
    }

    if (xref) {
      offset += xref.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
    }

    if (trailerDict) {
      offset += trailerDict.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.Newline;
    }

    offset += trailer.copyBytesInto(buffer, offset);

    return buffer;
  }

  async serializeToBufferIncremental(
    snapshot: DocumentSnapshot,
  ): Promise<Uint8Array> {
    const originalByteLength = snapshot.getOriginalByteLength();

    // Compute only changed/new objects
    const { size, indirectObjects, xref, trailerDict, trailer } =
      await this.computeIncrementalBufferSize(snapshot, originalByteLength);

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

      const n =
        object instanceof PDFObjectStream ? object.getObjectsCount() : 1;
      if (this.shouldWaitForTick(n)) await waitForTick();
    }

    if (xref) {
      offset += xref.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
    }

    if (trailerDict) {
      offset += trailerDict.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.Newline;
    }

    offset += trailer.copyBytesInto(buffer, offset);

    return buffer;
  }

  protected computeIndirectObjectSize([ref, object]: [
    PDFRef,
    PDFObject,
  ]): number {
    const refSize = ref.sizeInBytes() + 3; // 'R' -> 'obj\n'
    const objectSize = object.sizeInBytes() + 9; // '\nendobj\n\n'
    return refSize + objectSize;
  }

  protected createTrailerDict(): PDFDict {
    return this.context.obj({
      Size: this.context.largestObjectNumber + 1,
      Root: this.context.trailerInfo.Root,
      Encrypt: this.context.trailerInfo.Encrypt,
      Info: this.context.trailerInfo.Info,
      ID: this.context.trailerInfo.ID,
    });
  }

  protected createIncrementalTrailerDict(prevXRefOffset: number): PDFDict {
    const dict = this.createTrailerDict();
    dict.set(PDFName.of('Prev'), PDFNumber.of(prevXRefOffset));
    return dict;
  }

  protected async computeBufferSize(): Promise<SerializationInfo> {
    const header = PDFHeader.forVersion(1, 7);

    let size = header.sizeInBytes() + 2;

    const xref = PDFCrossRefSection.create();

    const security = this.context.security;

    const indirectObjects = this.context.enumerateIndirectObjects();

    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const indirectObject = indirectObjects[idx];
      const [ref, object] = indirectObject;
      if (security) this.encrypt(ref, object, security);
      xref.addEntry(ref, size);
      size += this.computeIndirectObjectSize(indirectObject);
      if (this.shouldWaitForTick(1)) await waitForTick();
    }

    const xrefOffset = size;
    size += xref.sizeInBytes() + 1; // '\n'

    const trailerDict = PDFTrailerDict.of(this.createTrailerDict());
    size += trailerDict.sizeInBytes() + 2; // '\n\n'

    const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
    size += trailer.sizeInBytes();

    return { size, header, indirectObjects, xref, trailerDict, trailer };
  }

  protected async computeIncrementalBufferSize(
    snapshot: DocumentSnapshot,
    startOffset: number,
  ): Promise<SerializationInfo> {
    let size = 0;

    const xref = PDFCrossRefSection.create();
    const security = this.context.security;

    // Filter to only new/modified objects
    const allIndirectObjects = this.context.enumerateIndirectObjects();
    const changedObjects: [PDFRef, PDFObject][] = [];

    for (let idx = 0, len = allIndirectObjects.length; idx < len; idx++) {
      const indirectObject = allIndirectObjects[idx];
      const [ref, object] = indirectObject;

      // Include if it's a new object or potentially modified
      if (!snapshot.hasRef(ref)) {
        if (security) this.encrypt(ref, object, security);
        xref.addEntry(ref, startOffset + size);
        size += this.computeIndirectObjectSize(indirectObject);
        changedObjects.push(indirectObject);
        if (this.shouldWaitForTick(1)) await waitForTick();
      }
    }

    const xrefOffset = startOffset + size;
    size += xref.sizeInBytes() + 1; // '\n'

    // Find the byte offset of the previous xref in the original document
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
        // Found "startxref", now read the number after it
        let numStart = i + startxrefBytes.length;
        while (
          numStart < originalBytes.length &&
          (originalBytes[numStart] === 32 ||
            originalBytes[numStart] === 10 ||
            originalBytes[numStart] === 13)
        ) {
          numStart++;
        }
        let numEnd = numStart;
        while (
          numEnd < originalBytes.length &&
          originalBytes[numEnd] >= 48 &&
          originalBytes[numEnd] <= 57
        ) {
          numEnd++;
        }
        const numStr = new TextDecoder().decode(
          originalBytes.slice(numStart, numEnd),
        );
        prevXRefOffset = parseInt(numStr, 10);
        break;
      }
    }

    const trailerDict = PDFTrailerDict.of(
      this.createIncrementalTrailerDict(prevXRefOffset),
    );
    size += trailerDict.sizeInBytes() + 2; // '\n\n'

    const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
    size += trailer.sizeInBytes();

    return {
      size,
      header: PDFHeader.forVersion(1, 7),
      indirectObjects: changedObjects,
      xref,
      trailerDict,
      trailer,
    };
  }

  protected encrypt(ref: PDFRef, object: PDFObject, security: PDFSecurity) {
    if (object instanceof PDFStream) {
      const encryptFn = security.getEncryptFn(
        ref.objectNumber,
        ref.generationNumber,
      );
      const unencryptedContents = object.getContents();
      const encryptedContents = encryptFn(unencryptedContents);
      object.updateContents(encryptedContents);
    }
  }

  protected shouldWaitForTick = (n: number) => {
    this.parsedObjects += n;
    return this.parsedObjects % this.objectsPerTick === 0;
  };
}

export default PDFWriter;
