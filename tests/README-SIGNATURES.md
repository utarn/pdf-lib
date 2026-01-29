# Digital Signature Testing Guide

This guide explains how to test and verify the digital signatures created by the `test-sign-incremental.ts` test.

## Overview

The test creates proper PDF digital signatures using the [zgapdfsigner](https://www.npmjs.com/package/zgapdfsigner) library. These signatures are compatible with Adobe Acrobat Reader and other PDF viewers.

## Running the Test

```bash
npx ts-node tests/test-sign-incremental.ts
```

This will create two signed PDF files:
- `samples/signed-intermediate.pdf` - PDF with one signature
- `samples/signed.pdf` - PDF with two signatures (final result)

## Verifying Signatures in Adobe Acrobat Reader

### Opening the Signature Panel

1. Open `samples/signed.pdf` in Adobe Acrobat Reader
2. Click on the "Signature Panel" icon on the left sidebar, or
3. Go to **Tools** > **Certificates** > **Digitally Sign**

### What You Should See

The Signature Panel should display:
- **Two signatures** listed sequentially
- Each signature shows:
  - Signature name (from certificate)
  - Date and time of signing
  - Reason: "Incremental signature #1" or "Incremental signature #2"
  - Location: "PDF-LIB Test Suite"

### Signature Validity

The signatures will show as:
- ✅ **Valid** - If the certificate is in your trusted certificate store
- ⚠️ **Unknown** - If the certificate is self-signed or not trusted (this is expected for test certificates)

**Note:** Even if the signature shows as "Unknown", it means the signature itself is valid, but the certificate is not trusted by your system. This is normal for test/self-signed certificates.

### Viewing Signature Details

1. Click on a signature in the Signature Panel
2. Click **Signature Properties** to see:
   - Certificate details (Subject, Issuer, Validity dates)
   - Signature algorithm (SHA-256 with RSA)
   - ByteRange (the portions of the PDF that were signed)
   - DocMDP settings (on first signature only)

### Document Modification Detection (DocMDP)

The first signature includes DocMDP level 2, which means:
- ✅ Form filling is allowed
- ✅ Adding signatures is allowed
- ❌ Other modifications are restricted

You can verify this by:
1. Opening the signed PDF
2. Checking the signature properties
3. Looking for "Permissions" or "DocMDP" settings

## Understanding the Test

### Signature #1 (First Signature)
- Applied after first incremental save
- Includes DocMDP level 2
- Creates the first signature field in the PDF
- Location in file: `samples/signed-intermediate.pdf`

### Signature #2 (Second Signature)
- Applied after second incremental save
- No DocMDP (cannot be applied to subsequent signatures)
- Creates an incremental update preserving the first signature
- Location in file: `samples/signed.pdf`

## Technical Details

### What zgapdfsigner Does

1. **Creates Signature Field**: Adds a signature field to the PDF's AcroForm
2. **Calculates ByteRange**: Determines which bytes of the PDF to sign
3. **Creates PKCS#7 Signature**: Uses the certificate to create a detached signature
4. **Embeds Certificate**: Includes the certificate in the signature for validation
5. **Updates PDF Structure**: Properly integrates the signature into the PDF

### Signature Format

- **Type**: PKCS#7 (CMS) detached signature
- **Algorithm**: SHA-256 with RSA
- **Standard**: ISO 32000-1 (PDF specification)
- **Compatible with**: Adobe Acrobat, PDF readers, signing services

## Common Issues and Solutions

### Issue: Signature shows as "Invalid"
**Cause**: The PDF was modified after signing
**Solution**: This shouldn't happen with this test. If it does, there's a bug in the incremental save implementation.

### Issue: Signature shows as "Unknown"
**Cause**: The certificate is not trusted
**Solution**: This is expected for test certificates. In production:
- Use a certificate from a trusted CA (Certificate Authority)
- Install the certificate in the system's trusted store

### Issue: Can't see signatures
**Cause**: PDF viewer doesn't support digital signatures
**Solution**: Use Adobe Acrobat Reader or another PDF viewer with signature support

### Issue: Second signature invalidates first
**Cause**: DocMDP level is too restrictive or improper incremental update
**Solution**: Ensure DocMDP is only on first signature and incremental saves are done correctly

## Certificate Information

The test uses `samples/sample.pfx` with password `AITECH@2025`.

This is a test certificate and should never be used in production. For production use:
1. Obtain a certificate from a trusted CA
2. Store it securely
3. Never commit certificates to version control

## Further Reading

- [zgapdfsigner Documentation](https://github.com/zboris12/zgapdfsigner/blob/main/README.md)
- [PDF Digital Signatures (ISO 32000-1)](https://www.adobe.com/devnet-docs/acrobatetk/tools/DigSig/Acrobat_DigitalSignatures_in_PDF.pdf)
- [DocMDP Signature Reference](https://helpx.adobe.com/acrobat/using/validating-digital-signatures.html)

## Troubleshooting

If you encounter issues:

1. **Check Node.js version**: Ensure you're using Node.js 14 or higher
2. **Verify dependencies**: Run `npm install` to ensure all packages are installed
3. **Check certificate file**: Ensure `samples/sample.pfx` exists
4. **Verify password**: The certificate password is `AITECH@2025`
5. **Check file permissions**: Ensure write access to the `samples/` directory

For issues specific to zgapdfsigner, refer to its [GitHub issues page](https://github.com/zboris12/zgapdfsigner/issues).