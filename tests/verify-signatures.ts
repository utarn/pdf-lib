import fs from 'fs';
import path from 'path';
import { PDFDocument } from '../src';

/**
 * Verify the signatures in the signed PDF files
 * This script checks:
 * 1. If the PDF can be loaded
 * 2. If signature fields exist
 * 3. Basic structure validation
 */
async function verifySignatures() {
  console.log('=== PDF Signature Verification ===\n');

  const files = ['../samples/signed-intermediate.pdf', '../samples/signed.pdf'];

  for (const file of files) {
    const filePath = path.join(__dirname, file);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${file}\n`);
      continue;
    }

    console.log(`Checking: ${file}`);
    console.log('-'.repeat(60));

    try {
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      console.log('✓ PDF loaded successfully');
      console.log(`  - Pages: ${pdfDoc.getPageCount()}`);
      console.log(`  - Size: ${pdfBytes.length.toLocaleString()} bytes`);

      // Check for form and signature fields
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      console.log(`  - Form fields: ${fields.length}`);

      // Look for signature fields
      const signatureFields = fields.filter((field) => {
        const fieldName = field.getName();
        return fieldName.toLowerCase().includes('signature');
      });

      if (signatureFields.length > 0) {
        console.log(`✓ Found ${signatureFields.length} signature field(s)`);
        signatureFields.forEach((field) => {
          console.log(`  - ${field.getName()}`);
        });
      } else {
        console.log('⚠️  No signature fields found in form');
      }

      // Check PDF structure
      const pdfString = new TextDecoder().decode(pdfBytes);
      const hasSignature = pdfString.includes('/Type /Sig');
      const hasByteRange = pdfString.includes('/ByteRange');
      const hasContents = pdfString.includes('/Contents <');

      console.log('\nPDF Structure:');
      console.log(`  - Has /Type /Sig: ${hasSignature ? '✓' : '✗'}`);
      console.log(`  - Has /ByteRange: ${hasByteRange ? '✓' : '✗'}`);
      console.log(`  - Has /Contents: ${hasContents ? '✓' : '✗'}`);

      if (hasSignature && hasByteRange && hasContents) {
        console.log('\n✅ PDF appears to contain valid signature structure');
      } else {
        console.log('\n⚠️  PDF may have incomplete signature structure');
      }

      console.log('\n📋 Next Steps:');
      console.log('   Open this file in Adobe Acrobat Reader to verify:');
      console.log('   1. Signature validity (green checkmark)');
      console.log('   2. ByteRange validation passes');
      console.log('   3. Certificate details are correct');
      console.log("   4. Document hasn't been altered since signing");
    } catch (error) {
      console.log(`❌ Error loading PDF: ${error}`);
    }

    console.log('\n');
  }

  console.log('=== Verification Complete ===\n');
  console.log('IMPORTANT:');
  console.log('This script only performs basic structural checks.');
  console.log('For full signature validation, please:');
  console.log('1. Open the PDFs in Adobe Acrobat Reader');
  console.log('2. Check the Signature Panel (View > Signature Panel)');
  console.log('3. Verify that signatures show as VALID');
  console.log(
    '4. Click on each signature to view detailed validation results\n',
  );
}

verifySignatures().catch((error) => {
  console.error('Error during verification:', error);
  process.exit(1);
});
