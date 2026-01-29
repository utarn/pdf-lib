import fs from 'fs';
import { PDFDocument, StandardFonts, rgb } from '../src/index';

async function testIncrementalSave() {
  console.log('Testing incremental save functionality...\n');

  // Test 1: Create a new document, take snapshot, modify, and save incrementally
  console.log('Test 1: New document with incremental save');
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText('Initial content', {
      x: 50,
      y: 350,
      size: 30,
      font,
      color: rgb(0, 0, 0),
    });

    // Take a snapshot
    const snapshot = await pdfDoc.takeSnapshot();
    console.log('✓ Snapshot taken successfully');
    console.log(`  Original byte length: ${snapshot.getOriginalByteLength()}`);

    // Make changes after snapshot
    page.drawText('Added after snapshot', {
      x: 50,
      y: 300,
      size: 20,
      font,
      color: rgb(0, 0.5, 0),
    });

    // Save incrementally
    const incrementalBytes = await pdfDoc.saveIncremental({ snapshot });
    console.log(
      `✓ Incremental save completed: ${incrementalBytes.length} bytes`,
    );

    // Save to file for verification
    fs.writeFileSync('test-incremental-new.pdf', incrementalBytes);
    console.log('✓ Saved to test-incremental-new.pdf\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error);
  }

  // Test 2: Load existing PDF, take snapshot, modify, and save incrementally
  console.log('Test 2: Loaded document with incremental save');
  try {
    // First create a base PDF
    const basePdf = await PDFDocument.create();
    const basePage = basePdf.addPage([600, 400]);
    const baseFont = await basePdf.embedFont(StandardFonts.TimesRoman);

    basePage.drawText('Base Document', {
      x: 50,
      y: 350,
      size: 40,
      font: baseFont,
      color: rgb(0, 0, 1),
    });

    const baseBytes = await basePdf.save();
    fs.writeFileSync('test-base.pdf', baseBytes);
    console.log('✓ Base PDF created');

    // Load the base PDF
    const loadedPdf = await PDFDocument.load(baseBytes);

    // Take snapshot immediately after loading
    const loadedSnapshot = await loadedPdf.takeSnapshot();
    console.log('✓ Snapshot taken from loaded PDF');
    console.log(
      `  Original byte length: ${loadedSnapshot.getOriginalByteLength()}`,
    );

    // Modify the loaded PDF
    const loadedPage = loadedPdf.getPages()[0];
    const loadedFont = await loadedPdf.embedFont(StandardFonts.Courier);

    loadedPage.drawText('Incremental Update', {
      x: 50,
      y: 250,
      size: 25,
      font: loadedFont,
      color: rgb(1, 0, 0),
    });

    // Save incrementally
    const incrementalLoadedBytes = await loadedPdf.saveIncremental({
      snapshot: loadedSnapshot,
    });
    console.log(
      `✓ Incremental save completed: ${incrementalLoadedBytes.length} bytes`,
    );

    fs.writeFileSync('test-incremental-loaded.pdf', incrementalLoadedBytes);
    console.log('✓ Saved to test-incremental-loaded.pdf\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error);
  }

  // Test 3: Multiple incremental updates
  console.log('Test 3: Multiple incremental updates');
  try {
    const multiPdf = await PDFDocument.create();
    const multiPage = multiPdf.addPage([600, 400]);
    const multiFont = await multiPdf.embedFont(StandardFonts.Helvetica);

    multiPage.drawText('Version 1', {
      x: 50,
      y: 350,
      size: 30,
      font: multiFont,
    });

    // First snapshot and save
    const snapshot1 = await multiPdf.takeSnapshot();
    console.log('✓ Snapshot 1 taken');

    multiPage.drawText('Version 2 update', {
      x: 50,
      y: 300,
      size: 20,
      font: multiFont,
      color: rgb(0, 0.5, 0),
    });

    const bytes1 = await multiPdf.saveIncremental({ snapshot: snapshot1 });
    console.log(`✓ First incremental save: ${bytes1.length} bytes`);

    // Load the incremental version
    const multiPdf2 = await PDFDocument.load(bytes1);
    const snapshot2 = await multiPdf2.takeSnapshot();
    console.log('✓ Snapshot 2 taken from incremental PDF');

    const multiPage2 = multiPdf2.getPages()[0];
    const multiFont2 = await multiPdf2.embedFont(StandardFonts.Courier);

    multiPage2.drawText('Version 3 update', {
      x: 50,
      y: 250,
      size: 20,
      font: multiFont2,
      color: rgb(0.5, 0, 0.5),
    });

    const bytes2 = await multiPdf2.saveIncremental({ snapshot: snapshot2 });
    console.log(`✓ Second incremental save: ${bytes2.length} bytes`);

    fs.writeFileSync('test-incremental-multi.pdf', bytes2);
    console.log('✓ Saved to test-incremental-multi.pdf\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error);
  }

  // Test 4: Error handling - snapshot required
  console.log('Test 4: Error handling');
  try {
    const errorPdf = await PDFDocument.create();
    errorPdf.addPage();

    try {
      await errorPdf.saveIncremental({});
      console.error('✗ Should have thrown error for missing snapshot');
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('snapshot is required')
      ) {
        console.log('✓ Correctly throws error when snapshot is missing');
      } else {
        console.error('✗ Unexpected error:', error);
      }
    }
  } catch (error) {
    console.error('✗ Test 4 failed:', error);
  }

  console.log('\n=== All tests completed ===');
}

// Run the tests
testIncrementalSave().catch(console.error);
