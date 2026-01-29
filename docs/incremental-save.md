# Incremental Save Feature

## Overview

The incremental save feature allows you to append changes to an existing PDF document without rewriting the entire file. This is particularly useful when:

- You need to add digital signatures to a PDF
- You're making small changes to a large PDF document
- You want to preserve the original PDF structure and maintain compatibility with certain PDF validators
- You need better performance when modifying large documents

Instead of regenerating the entire PDF file, incremental save creates an **incremental update section** that is appended to the original PDF. The result is a valid PDF that contains both the original content and your modifications.

## How It Works

### PDF Incremental Update Mechanism

PDF files support a powerful feature called "incremental updates" as defined in the PDF specification. When you save a PDF incrementally:

1. The original PDF bytes remain unchanged
2. New or modified objects are written to an update section
3. A new cross-reference table (xref) is appended that references both old and new objects
4. A new trailer is added that points to the previous trailer

This creates a layered structure where each incremental update builds upon the previous version. PDF readers automatically use the most recent version of each object.

```
┌─────────────────────────┐
│   Original PDF          │  ← Original document
├─────────────────────────┤
│   Incremental Update 1  │  ← First set of changes
├─────────────────────────┤
│   Incremental Update 2  │  ← Second set of changes
└─────────────────────────┘
```

## API Reference

### `takeSnapshot()` Method

Takes a snapshot of the document's current state for use with incremental saving.

```typescript
async takeSnapshot(): Promise<DocumentSnapshot>
```

**Returns:** A [`DocumentSnapshot`](#documentsnapshot-interface) representing the current state

**Example:**
```javascript
import { PDFDocument } from 'pdf-lib'

const pdfDoc = await PDFDocument.load(existingPdfBytes)

// Take a snapshot before making changes
const snapshot = await pdfDoc.takeSnapshot()
```

**Important Notes:**
- You should call `takeSnapshot()` immediately after loading a document or after the last save
- The snapshot captures the full document state at that moment
- Snapshots can be large for big PDFs as they contain the complete document bytes

---

### `saveIncremental()` Method

Saves only the changes made since the snapshot was taken, appending them to the original document.

```typescript
async saveIncremental(options?: IncrementalSaveOptions): Promise<Uint8Array>
```

**Parameters:**
- `options` (optional): Configuration options for the incremental save
  - `snapshot`: [`DocumentSnapshot`](#documentsnapshot-interface) - **Required**. The snapshot to save against
  - `useObjectStreams`: `boolean` - Whether to use object streams for compression (default: `true`)
  - `addDefaultPage`: `boolean` - Whether to add a default page if document is empty (default: `true`)
  - `objectsPerTick`: `number` - Objects to process per tick for async operations (default: `50`)
  - `updateFieldAppearances`: `boolean` - Whether to update form field appearances (default: `true`)

**Returns:** A `Uint8Array` containing the complete PDF (original + incremental update)

**Throws:** Error if `snapshot` is not provided

**Example:**
```javascript
const pdfDoc = await PDFDocument.load(existingPdfBytes)
const snapshot = await pdfDoc.takeSnapshot()

// Make changes
const page = pdfDoc.getPages()[0]
page.drawText('Modified!')

// Save incrementally
const incrementalBytes = await pdfDoc.saveIncremental({ snapshot })
```

---

### `DocumentSnapshot` Interface

Represents a snapshot of a PDF document's state. Used to track which objects existed at the time of the snapshot.

```typescript
interface DocumentSnapshot {
  /** Get the original PDF bytes when the snapshot was taken */
  getOriginalBytes(): Uint8Array
  
  /** Get the byte offset where the original document ends */
  getOriginalByteLength(): number
  
  /** Get the set of object references that existed at snapshot time */
  getSnapshotRefs(): Set<PDFRef>
  
  /** Check if a reference existed in the snapshot */
  hasRef(ref: PDFRef): boolean
  
  /** Get the highest object number that existed in the snapshot */
  getHighestObjectNumber(): number
}
```

**Methods:**

#### `getOriginalBytes()`
Returns the complete PDF bytes as they were when the snapshot was taken.

```javascript
const snapshot = await pdfDoc.takeSnapshot()
const originalBytes = snapshot.getOriginalBytes()
console.log(`Original size: ${originalBytes.length} bytes`)
```

#### `getOriginalByteLength()`
Returns the length of the original PDF in bytes. This is where the incremental update section will begin.

```javascript
const snapshot = await pdfDoc.takeSnapshot()
const originalLength = snapshot.getOriginalByteLength()
console.log(`Incremental updates start at byte ${originalLength}`)
```

#### `getSnapshotRefs()`
Returns a Set of all PDF object references that existed when the snapshot was taken.

```javascript
const snapshot = await pdfDoc.takeSnapshot()
const refs = snapshot.getSnapshotRefs()
console.log(`Snapshot contains ${refs.size} objects`)
```

#### `hasRef(ref: PDFRef)`
Checks if a specific PDF object reference existed in the snapshot.

```javascript
const snapshot = await pdfDoc.takeSnapshot()
const someRef = pdfDoc.context.nextRef()
console.log(`Is new object: ${!snapshot.hasRef(someRef)}`)
```

#### `getHighestObjectNumber()`
Returns the highest object number that existed in the snapshot. New objects will have higher numbers.

```javascript
const snapshot = await pdfDoc.takeSnapshot()
const maxNum = snapshot.getHighestObjectNumber()
console.log(`Objects numbered up to ${maxNum}`)
```

---

### `IncrementalDocumentSnapshot` Class

The concrete implementation of [`DocumentSnapshot`](#documentsnapshot-interface).

```typescript
class IncrementalDocumentSnapshot implements DocumentSnapshot {
  static fromDocument(
    originalBytes: Uint8Array,
    existingRefs: PDFRef[]
  ): IncrementalDocumentSnapshot
}
```

**Static Method:**

#### `fromDocument(originalBytes, existingRefs)`
Creates a snapshot from document bytes and object references. This is typically called internally by [`takeSnapshot()`](#takesnapshot-method).

```javascript
// Usually you don't need to call this directly
// Instead use: pdfDoc.takeSnapshot()

// But if needed for advanced use cases:
const bytes = await pdfDoc.save()
const refs = pdfDoc.context.enumerateIndirectObjects().map(([ref]) => ref)
const snapshot = IncrementalDocumentSnapshot.fromDocument(bytes, refs)
```

## Usage Examples

### Basic Incremental Save

The most common use case: load a PDF, make changes, and save incrementally.

```javascript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Load an existing PDF
const existingPdfBytes = await fetch('document.pdf').then(r => r.arrayBuffer())
const pdfDoc = await PDFDocument.load(existingPdfBytes)

// Take a snapshot BEFORE making any changes
const snapshot = await pdfDoc.takeSnapshot()

// Now make your changes
const pages = pdfDoc.getPages()
const firstPage = pages[0]
const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

firstPage.drawText('Added via incremental save!', {
  x: 50,
  y: 50,
  size: 20,
  font,
  color: rgb(1, 0, 0)
})

// Save incrementally - only the changes are appended
const incrementalBytes = await pdfDoc.saveIncremental({ snapshot })

// Write to file or send to browser
await fs.writeFile('modified.pdf', incrementalBytes)
```

### Multiple Sequential Updates

You can perform multiple incremental updates by taking a new snapshot after each save.

```javascript
import { PDFDocument, StandardFonts } from 'pdf-lib'

// Start with a new document
const pdfDoc = await PDFDocument.create()
const page = pdfDoc.addPage([600, 400])
const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

// Add initial content
page.drawText('Version 1', { x: 50, y: 350, size: 30, font })

// First snapshot and incremental save
const snapshot1 = await pdfDoc.takeSnapshot()
page.drawText('Version 2 content', { x: 50, y: 300, size: 20, font })
const bytes1 = await pdfDoc.saveIncremental({ snapshot: snapshot1 })

// Load the incremental version
const pdfDoc2 = await PDFDocument.load(bytes1)
const snapshot2 = await pdfDoc2.takeSnapshot()

// Make more changes
const page2 = pdfDoc2.getPages()[0]
const font2 = await pdfDoc2.embedFont(StandardFonts.Courier)
page2.drawText('Version 3 content', { x: 50, y: 250, size: 20, font: font2 })

// Second incremental save
const bytes2 = await pdfDoc2.saveIncremental({ snapshot: snapshot2 })

// The final PDF now has two incremental update sections
await fs.writeFile('multi-version.pdf', bytes2)
```

### Working with Existing PDFs

Best practice when modifying existing PDFs is to take a snapshot immediately after loading.

```javascript
import { PDFDocument, StandardFonts } from 'pdf-lib'

// Load existing PDF
const existingBytes = await fs.readFile('input.pdf')
const pdfDoc = await PDFDocument.load(existingBytes)

// Snapshot immediately after loading
const snapshot = await pdfDoc.takeSnapshot()
console.log(`Original size: ${snapshot.getOriginalByteLength()} bytes`)

// Modify the document
const pages = pdfDoc.getPages()
const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)

pages[0].drawText('DRAFT', {
  x: 50,
  y: 750,
  size: 72,
  font,
  opacity: 0.3
})

// Save incrementally
const modifiedBytes = await pdfDoc.saveIncremental({ snapshot })
console.log(`Modified size: ${modifiedBytes.length} bytes`)
console.log(`Incremental update size: ${modifiedBytes.length - snapshot.getOriginalByteLength()} bytes`)

await fs.writeFile('output.pdf', modifiedBytes)
```

### Marking Objects for Save

When working with form fields or other PDF objects, changes are automatically tracked.

```javascript
import { PDFDocument } from 'pdf-lib'

const formPdfBytes = await fs.readFile('form.pdf')
const pdfDoc = await PDFDocument.load(formPdfBytes)

// Take snapshot before modifications
const snapshot = await pdfDoc.takeSnapshot()

// Fill form fields
const form = pdfDoc.getForm()
const nameField = form.getTextField('name')
const emailField = form.getTextField('email')

nameField.setText('John Doe')
emailField.setText('john@example.com')

// Form field changes are automatically tracked
const modifiedBytes = await pdfDoc.saveIncremental({ snapshot })
await fs.writeFile('filled-form.pdf', modifiedBytes)
```

## Use Cases

### Digital Signatures

Incremental save is essential for digital signatures because:
- The signature must be calculated over the original document
- Adding a signature must not invalidate existing signatures
- Many signature validators require incremental updates

```javascript
import { PDFDocument } from 'pdf-lib'

const pdfDoc = await PDFDocument.load(documentBytes)
const snapshot = await pdfDoc.takeSnapshot()

// Add signature field and placeholder
const form = pdfDoc.getForm()
const signatureField = form.createSignature('signature1')
signatureField.addToPage(pdfDoc.getPages()[0], { x: 50, y: 50 })

// Save incrementally to preserve original for signature
const preparedBytes = await pdfDoc.saveIncremental({ snapshot })

// Now the signature can be calculated and applied
// (signature calculation not shown - requires external library)
```

### Performance Optimization

For large PDFs, incremental save can be significantly faster than a full save.

```javascript
import { PDFDocument } from 'pdf-lib'

// Load a large PDF (e.g., 100+ pages)
const largePdfBytes = await fs.readFile('large-document.pdf')
const startTime = Date.now()

const pdfDoc = await PDFDocument.load(largePdfBytes)
const snapshot = await pdfDoc.takeSnapshot()

// Make a small change
const page = pdfDoc.getPages()[0]
page.drawText('Page 1 of ' + pdfDoc.getPageCount(), { x: 500, y: 20 })

// Incremental save is much faster than full save for large documents
const incrementalBytes = await pdfDoc.saveIncremental({ snapshot })
console.log(`Incremental save took ${Date.now() - startTime}ms`)

// Compare with full save (would be much slower)
// const fullBytes = await pdfDoc.save()
```

### Large PDF Modifications

When making changes to specific pages in a large document, incremental save avoids rewriting unchanged pages.

```javascript
import { PDFDocument, StandardFonts } from 'pdf-lib'

const pdfDoc = await PDFDocument.load(largeDocumentBytes)
const snapshot = await pdfDoc.takeSnapshot()

// Add page numbers only to first 10 pages
const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
const pages = pdfDoc.getPages().slice(0, 10)

pages.forEach((page, idx) => {
  page.drawText(`Page ${idx + 1}`, {
    x: 50,
    y: page.getHeight() - 50,
    size: 12,
    font
  })
})

// Only modified pages and new objects are written
const bytes = await pdfDoc.saveIncremental({ snapshot })
await fs.writeFile('numbered.pdf', bytes)
```

## Important Notes and Best Practices

### When to Use Incremental Save

✅ **Use incremental save when:**
- Working with digital signatures
- Making small changes to large documents
- Need to preserve original PDF structure
- Want to maintain PDF/A compliance
- Adding annotations or form fields to existing PDFs

❌ **Don't use incremental save when:**
- Creating new PDFs from scratch (use regular `save()`)
- Making extensive changes to most pages
- File size is a critical concern (full save may be smaller)
- Don't have access to the original bytes

### Snapshot Timing

```javascript
// ✅ CORRECT: Snapshot before changes
const pdfDoc = await PDFDocument.load(bytes)
const snapshot = await pdfDoc.takeSnapshot()
pdfDoc.getPages()[0].drawText('Hello')
await pdfDoc.saveIncremental({ snapshot })

// ❌ WRONG: Snapshot after changes
const pdfDoc = await PDFDocument.load(bytes)
pdfDoc.getPages()[0].drawText('Hello')
const snapshot = await pdfDoc.takeSnapshot() // Too late!
await pdfDoc.saveIncremental({ snapshot })
```

### File Size Considerations

- Each incremental update adds to the file size
- Multiple incremental updates can make the file larger than a full save
- Consider using regular `save()` after several incremental updates
- The original content is never removed, even if objects are deleted

```javascript
// File size comparison
const snapshot = await pdfDoc.takeSnapshot()
// ... make changes ...

const incrementalBytes = await pdfDoc.saveIncremental({ snapshot })
const fullBytes = await pdfDoc.save()

console.log(`Incremental: ${incrementalBytes.length} bytes`)
console.log(`Full save: ${fullBytes.length} bytes`)
```

### Memory Usage

- Snapshots keep the entire original document in memory
- For very large PDFs, this may impact performance
- Consider the memory/speed tradeoff for your use case

```javascript
// Be mindful of memory with large PDFs
const snapshot = await pdfDoc.takeSnapshot()
console.log(`Snapshot size: ${snapshot.getOriginalByteLength()} bytes`)

// The snapshot keeps these bytes in memory until garbage collected
// Clear reference when done if needed
snapshot = null
```

### Compatibility

- Incremental updates are part of the PDF specification
- All compliant PDF readers support incremental updates
- Some PDF validators specifically require incremental updates (e.g., for signatures)
- Older or non-compliant readers may have issues (very rare)

## Troubleshooting

### Error: "snapshot is required for incremental save"

```javascript
// This will throw an error:
await pdfDoc.saveIncremental({}) // Missing snapshot!

// Fix: Provide a snapshot
const snapshot = await pdfDoc.takeSnapshot()
await pdfDoc.saveIncremental({ snapshot })
```

### Incremental save produces larger files than expected

This is normal behavior. Each incremental update:
- Keeps the original content unchanged
- Adds new/modified objects
- Adds a new xref table
- Adds a new trailer

**Solution:** Use regular `save()` to optimize file size after multiple incremental updates.

```javascript
// After several incremental updates, optimize with full save
const optimizedBytes = await pdfDoc.save()
```

### Changes not appearing in saved PDF

Make sure you take the snapshot **before** making changes, not after.

```javascript
// ❌ Wrong order
pdfDoc.getPages()[0].drawText('Hello')
const snapshot = await pdfDoc.takeSnapshot()

// ✅ Correct order
const snapshot = await pdfDoc.takeSnapshot()
pdfDoc.getPages()[0].drawText('Hello')
```

### Out of memory errors with large PDFs

Snapshots store the complete document in memory. For very large documents:

```javascript
// Consider if incremental save is necessary
if (pdfBytes.length > 100_000_000) { // 100 MB
  console.warn('Large PDF: consider using regular save()')
  const bytes = await pdfDoc.save()
} else {
  const snapshot = await pdfDoc.takeSnapshot()
  const bytes = await pdfDoc.saveIncremental({ snapshot })
}
```

### Signature validation fails after incremental save

Ensure you're not modifying signed objects:

```javascript
// Take snapshot after loading existing signed PDF
const pdfDoc = await PDFDocument.load(signedPdfBytes)
const snapshot = await pdfDoc.takeSnapshot()

// Only add new content, don't modify existing pages
const newPage = pdfDoc.addPage()
newPage.drawText('Additional content')

await pdfDoc.saveIncremental({ snapshot })
```

## See Also

- [`PDFDocument.save()`](https://pdf-lib.js.org/docs/api/classes/pdfdocument#save) - Regular full document save
- [`PDFDocument.load()`](https://pdf-lib.js.org/docs/api/classes/pdfdocument#load) - Loading existing PDFs
- [Form Filling Example](https://github.com/Hopding/pdf-lib#fill-form) - Working with form fields
- [PDF Specification](https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/PDF32000_2008.pdf) - Section 7.5.6 on Incremental Updates