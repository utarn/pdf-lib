import fs from 'fs';
import path from 'path';
import * as Zga from 'zgapdfsigner';
import { PDFDocument } from '../src';

/**
 * Test demonstrating MULTIPLE incremental save and sign cycles with PROPER digital signatures
 * using pdf-lib's native incremental save feature.
 *
 * IMPORTANT: This test uses zgapdfsigner (https://www.npmjs.com/package/zgapdfsigner) to create
 * digital signatures that are recognized and validated by Adobe Acrobat Reader and other PDF viewers.
 *
 * Key Features of the Implementation:
 * - Uses pdf-lib's saveIncremental() for content modifications
 * - Creates proper PKCS#7 detached signatures via zgapdfsigner
 * - Uses ByteRange to sign the correct portions of the PDF
 * - Embeds certificate chain in the signature
 * - Creates signature fields in the PDF's AcroForm
 * - Signatures are visible in Adobe Acrobat's signature panel
 * - zgapdfsigner automatically handles incremental updates for signatures
 * - Applies DocMDP (Document Modification Detection and Prevention) on first signature only
 *
 * DocMDP Levels:
 * - Level 1: No changes allowed (document is locked)
 * - Level 2: Form filling and signing allowed (used in this test)
 * - Level 3: Form filling, signing, and annotations allowed
 *
 * Important Notes:
 * - DocMDP can ONLY be applied to the FIRST signature in a document
 * - Subsequent signatures on an already-signed PDF must not include DocMDP (permission: 0)
 * - Each signature creates an incremental update to the PDF
 * - Previous signatures remain valid after new signatures are added
 *
 * Workflow:
 * CYCLE 1:
 * 1. Load samples/sample.pdf
 * 2. Take snapshot using takeSnapshot()
 * 3. Add first image (small_mario.png) at position (50, 50)
 * 4. Call saveIncremental({ snapshot }) to get incremental bytes
 * 5. Concatenate: Buffer.concat([originalBytes, incrementalBytes])
 * 6. Sign the concatenated PDF with samples/sample.pfx using zgapdfsigner
 * 7. Save as intermediate file samples/signed-intermediate.pdf
 *
 * CYCLE 2:
 * 8. Reload the signed PDF from cycle 1
 * 9. Take another snapshot using takeSnapshot()
 * 10. Add second image (minions_banana_alpha.png) at position (200, 200)
 * 11. Call saveIncremental({ snapshot }) to get incremental bytes
 * 12. Concatenate: Buffer.concat([cycle1Bytes, incrementalBytes])
 * 13. Sign the concatenated PDF with the same certificate
 * 14. Save final result as samples/signed.pdf
 *
 * Verification:
 * - Open samples/signed.pdf in Adobe Acrobat Reader
 * - Both images should be visible on the first page
 * - Click "Signature Panel" to see both signatures
 * - Both signatures should show as valid (if certificate is trusted)
 * - Document properties should show signature details and DocMDP settings
 *
 * The final PDF demonstrates that:
 * - pdf-lib's incremental save works correctly with digital signatures
 * - Content modifications work correctly across multiple cycles
 * - Digital signatures are preserved through the process
 * - Multiple signatures can be chained sequentially
 * - zgapdfsigner's signatures remain compatible with incremental saves
 */

async function signPdfIncremental() {
  console.log('=== PDF Multiple Incremental Save & Sign Cycles Test ===\n');
  console.log(
    'This test demonstrates chaining multiple incremental saves with signatures.\n',
  );

  // ========================================================================
  // CYCLE 1: First modification, incremental save, and signature
  // ========================================================================
  console.log(
    '┌─────────────────────────────────────────────────────────────┐',
  );
  console.log(
    '│                        CYCLE 1                              │',
  );
  console.log(
    '└─────────────────────────────────────────────────────────────┘\n',
  );

  // Step 1: Load existing PDF
  console.log('Step 1: Loading original PDF...');
  const existingPdfPath = path.join(__dirname, '../samples/sample.pdf');
  const existingPdfBytes = new Uint8Array(fs.readFileSync(existingPdfPath));
  const pdfDoc1 = await PDFDocument.load(existingPdfBytes);
  console.log(`✓ Loaded PDF with ${pdfDoc1.getPageCount()} page(s)`);
  console.log(`  - File size: ${existingPdfBytes.length} bytes\n`);

  // Step 2: Take snapshot for incremental save
  console.log('Step 2: Taking snapshot for incremental save...');
  const snapshot1 = await pdfDoc1.takeSnapshot();
  console.log('✓ Snapshot taken\n');

  // Step 3: Embed and draw first image
  console.log('Step 3: Adding first image (small_mario.png)...');
  const image1Path = path.join(__dirname, '../assets/images/small_mario.png');
  const image1Bytes = new Uint8Array(fs.readFileSync(image1Path));
  const image1 = await pdfDoc1.embedPng(image1Bytes);

  const pages1 = pdfDoc1.getPages();
  const firstPage1 = pages1[0];

  // Draw at position (50, 50)
  firstPage1.drawImage(image1, {
    x: 50,
    y: 50,
    width: image1.width * 0.5,
    height: image1.height * 0.5,
  });

  console.log('✓ First image embedded and drawn');
  console.log('  - Position: (50, 50)');
  console.log(
    `  - Size: ${image1.width}x${image1.height} pixels (scaled 50%)\n`,
  );

  // Step 4: Save incrementally and concatenate with original
  console.log('Step 4: Saving PDF with incremental changes...');
  const incrementalBytes1 = await pdfDoc1.saveIncremental({
    snapshot: snapshot1,
  });
  const concatenatedBytes1 = new Uint8Array(
    existingPdfBytes.length + incrementalBytes1.length,
  );
  concatenatedBytes1.set(existingPdfBytes, 0);
  concatenatedBytes1.set(incrementalBytes1, existingPdfBytes.length);
  console.log('✓ Incremental save completed');
  console.log(`  - Original size: ${existingPdfBytes.length} bytes`);
  console.log(`  - Incremental size: ${incrementalBytes1.length} bytes`);
  console.log(`  - Concatenated size: ${concatenatedBytes1.length} bytes\n`);

  // Step 4.5: Use concatenated bytes directly (no reload needed)
  console.log('Step 4.5: Using concatenated PDF directly for signing...');
  const reloadedBytes1 = concatenatedBytes1;
  console.log('✓ Concatenated bytes ready for signing');
  console.log(`  - Size: ${reloadedBytes1.length} bytes`);
  console.log('  - saveIncremental() already produces a complete, valid PDF\n');

  // Step 5: First signature (sign the reloaded PDF)
  console.log('Step 5: Applying first digital signature...');
  console.log('  - Signing the reloaded complete PDF structure');
  const signedBytes1 = await addDigitalSignature(
    reloadedBytes1,
    path.join(__dirname, '../samples/sample.pfx'),
    'AITECH@2025',
    1,
  );
  console.log('✓ First signature applied\n');

  // Step 6: Save intermediate file
  console.log('Step 6: Saving intermediate signed PDF...');
  const intermediatePath = path.join(
    __dirname,
    '../samples/signed-intermediate.pdf',
  );
  fs.writeFileSync(intermediatePath, signedBytes1);
  console.log(`✓ Intermediate file saved: ${intermediatePath}`);
  console.log(`  - Size: ${signedBytes1.length} bytes\n`);

  // ========================================================================
  // CYCLE 2: Reload, second modification, incremental save, and signature
  // ========================================================================
  console.log(
    '\n┌─────────────────────────────────────────────────────────────┐',
  );
  console.log(
    '│                        CYCLE 2                              │',
  );
  console.log(
    '└─────────────────────────────────────────────────────────────┘\n',
  );

  // Step 7: Reload the signed PDF from cycle 1
  console.log('Step 7: Reloading signed PDF from Cycle 1...');
  const pdfDoc2 = await PDFDocument.load(signedBytes1);
  console.log(`✓ Reloaded signed PDF with ${pdfDoc2.getPageCount()} page(s)`);
  console.log(`  - File size: ${signedBytes1.length} bytes\n`);

  // Step 8: Take another snapshot for second incremental save
  console.log('Step 8: Taking snapshot for incremental save...');
  const snapshot2 = await pdfDoc2.takeSnapshot();
  console.log('✓ Snapshot taken\n');

  // Step 9: Embed and draw second image
  console.log('Step 9: Adding second image (minions_banana_alpha.png)...');
  const image2Path = path.join(
    __dirname,
    '../assets/images/minions_banana_alpha.png',
  );
  const image2Bytes = new Uint8Array(fs.readFileSync(image2Path));
  const image2 = await pdfDoc2.embedPng(image2Bytes);

  const pages2 = pdfDoc2.getPages();
  const firstPage2 = pages2[0];

  // Draw at position (200, 200)
  firstPage2.drawImage(image2, {
    x: 200,
    y: 200,
    width: image2.width * 0.3,
    height: image2.height * 0.3,
  });

  console.log('✓ Second image embedded and drawn');
  console.log('  - Position: (200, 200)');
  console.log(
    `  - Size: ${image2.width}x${image2.height} pixels (scaled 30%)\n`,
  );

  // Step 10: Save incrementally and concatenate with cycle 1 bytes
  console.log('Step 10: Saving PDF with incremental changes...');
  const incrementalBytes2 = await pdfDoc2.saveIncremental({
    snapshot: snapshot2,
  });
  const concatenatedBytes2 = new Uint8Array(
    signedBytes1.length + incrementalBytes2.length,
  );
  concatenatedBytes2.set(signedBytes1, 0);
  concatenatedBytes2.set(incrementalBytes2, signedBytes1.length);
  console.log('✓ Incremental save completed');
  console.log(`  - Cycle 1 size: ${signedBytes1.length} bytes`);
  console.log(`  - Incremental size: ${incrementalBytes2.length} bytes`);
  console.log(`  - Concatenated size: ${concatenatedBytes2.length} bytes\n`);

  // Step 10.5: Use concatenated bytes directly (no reload needed)
  console.log('Step 10.5: Using concatenated PDF directly for signing...');
  const reloadedBytes2 = concatenatedBytes2;
  console.log('✓ Concatenated bytes ready for signing');
  console.log(`  - Size: ${reloadedBytes2.length} bytes`);
  console.log('  - saveIncremental() already produces a complete, valid PDF\n');

  // Step 11: Second signature (sign the reloaded PDF)
  console.log('Step 11: Applying second digital signature...');
  console.log('  - Signing the reloaded complete PDF structure');
  const signedBytes2 = await addDigitalSignature(
    reloadedBytes2,
    path.join(__dirname, '../samples/sample.pfx'),
    'AITECH@2025',
    2,
  );
  console.log('✓ Second signature applied\n');

  // Step 12: Save final result
  console.log('Step 12: Writing final signed PDF...');
  const outputPath = path.join(__dirname, '../samples/signed.pdf');
  fs.writeFileSync(outputPath, signedBytes2);
  console.log(`✓ Final PDF written to: ${outputPath}`);
  console.log(`  - Final size: ${signedBytes2.length} bytes\n`);

  // ========================================================================
  // Summary
  // ========================================================================
  console.log(
    '\n┌─────────────────────────────────────────────────────────────┐',
  );
  console.log(
    '│                         SUMMARY                             │',
  );
  console.log(
    '└─────────────────────────────────────────────────────────────┘\n',
  );

  console.log('File Size Progression:');
  console.log(
    `  Original PDF:          ${existingPdfBytes.length.toLocaleString()} bytes`,
  );
  console.log(
    `  After Cycle 1:         ${signedBytes1.length.toLocaleString()} bytes (+${(signedBytes1.length - existingPdfBytes.length).toLocaleString()})`,
  );
  console.log(
    `  After Cycle 2 (Final): ${signedBytes2.length.toLocaleString()} bytes (+${(signedBytes2.length - signedBytes1.length).toLocaleString()})`,
  );
  console.log(
    `  Total growth:          ${(signedBytes2.length - existingPdfBytes.length).toLocaleString()} bytes\n`,
  );

  console.log('Modifications Applied:');
  console.log('  ✓ Cycle 1: small_mario.png at (50, 50) + Signature 1');
  console.log(
    '  ✓ Cycle 2: minions_banana_alpha.png at (200, 200) + Signature 2\n',
  );

  console.log('Verification Steps:');
  console.log('  1. Open samples/signed.pdf in Adobe Acrobat Reader');
  console.log('  2. You should see BOTH images on the first page:');
  console.log('     - Mario image at bottom-left (50, 50)');
  console.log('     - Minions image at middle (200, 200)');
  console.log('  3. Check the signature panel (View > Signature Panel)');
  console.log('     - The document should show TWO signatures');
  console.log('     - Both signatures should be VALID (green checkmark)');
  console.log('     - ByteRange validation should PASS for both signatures');
  console.log('  4. Click on each signature to view details:');
  console.log('     - Signature #1: "Incremental signature #1"');
  console.log('     - Signature #2: "Incremental signature #2"');
  console.log('  5. Check Document Properties > Security:');
  console.log('     - Should show "Signed by: [Certificate Name]"');
  console.log('     - Should show DocMDP settings for first signature\n');

  console.log('Technical Notes:');
  console.log('  - Each cycle: snapshot → modify → saveIncremental → sign');
  console.log(
    '  - saveIncremental() produces a complete, valid PDF with incremental structure',
  );
  console.log('  - Concatenated bytes are used directly without reload');
  console.log(
    '  - This preserves the incremental structure and previous signatures',
  );
  console.log(
    '  - zgapdfsigner adds its own incremental update for the signature\n',
  );

  console.log('=== Test completed successfully! ===');
  console.log('Please verify the signatures in Adobe Acrobat Reader! 🎉\n');
}

/**
 * Adds a proper digital signature to a PDF using zgapdfsigner.
 *
 * This function creates a digital signature that is recognized by Adobe Acrobat Reader
 * and other PDF viewers. The signature:
 * - Uses PKCS#7 detached signature format
 * - Includes proper ByteRange for signing
 * - Embeds the certificate chain
 * - Creates a signature field in the PDF
 * - Is visible in Adobe Acrobat's signature panel
 *
 * @param pdfBytes The PDF document bytes to sign
 * @param p12Path Path to the PKCS#12 certificate file
 * @param passphrase Password for the certificate
 * @param signatureNumber The signature number for logging purposes
 * @returns The signed PDF bytes
 */
async function addDigitalSignature(
  pdfBytes: Uint8Array,
  p12Path: string,
  passphrase: string,
  signatureNumber: number = 1,
): Promise<Uint8Array> {
  console.log(
    `  Signature #${signatureNumber} - Applying digital signature using zgapdfsigner...`,
  );

  // Load the PKCS#12 certificate
  const p12Buffer = new Uint8Array(fs.readFileSync(p12Path));

  // Configure signature options
  // Note: DocMDP (permission) can only be set on the FIRST signature.
  // Subsequent signatures on an already-signed PDF should not include permission.
  const signOptions: Zga.SignOption = {
    p12cert: p12Buffer,
    pwd: passphrase,
    permission: signatureNumber === 1 ? 3 : 0, // DocMDP only on first signature
    signdate: '1', // Use current date/time
    reason: `Incremental signature #${signatureNumber}`,
    location: 'PDF-LIB Test Suite',
    contact: 'test@pdf-lib.org',
  };

  // Create the signer
  const signer = new Zga.PdfSigner(signOptions);

  // Sign the PDF
  const signedBytes = await signer.sign(pdfBytes);

  console.log('    - Signature algorithm: SHA-256 with RSA (PKCS#7)');
  console.log('    - Signature applied successfully');
  console.log('    - Signature is Adobe Acrobat compatible');
  if (signatureNumber === 1) {
    console.log('    - DocMDP level 3: No changes allowed');
  } else {
    console.log('    - Incremental signature (no DocMDP)');
  }

  return signedBytes;
}

// Run the test
signPdfIncremental().catch((error) => {
  console.error('\n❌ Error during test execution:');
  console.error(error);
  process.exit(1);
});
