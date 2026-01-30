/**
 * SDK Build Script
 * Minifies sdk.js and replaces API_BASE_URL placeholder
 */
import * as fs from 'fs';
import * as path from 'path';
import { minify } from 'terser';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const SDK_SOURCE = path.join(TEMPLATES_DIR, 'sdk.js');
const SDK_OUTPUT = path.join(TEMPLATES_DIR, 'sdk.min.js');

async function buildSDK(): Promise<void> {
  console.log('Building SDK...');

  // Read source file
  let source = fs.readFileSync(SDK_SOURCE, 'utf-8');

  // Replace API_BASE_URL placeholder
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  source = source.replace('{{API_BASE_URL}}', apiBaseUrl);

  console.log(`API Base URL: ${apiBaseUrl}`);

  // Minify with Terser
  const result = await minify(source, {
    compress: {
      drop_console: false, // Keep console.log/warn for debugging
      passes: 2
    },
    mangle: {
      reserved: ['FastTrackTool'] // Keep global name
    },
    format: {
      comments: false
    }
  });

  if (!result.code) {
    throw new Error('Minification failed');
  }

  // Write minified output
  fs.writeFileSync(SDK_OUTPUT, result.code, 'utf-8');

  // Report size
  const sourceSize = Buffer.byteLength(source, 'utf-8');
  const minifiedSize = Buffer.byteLength(result.code, 'utf-8');
  const compressionRatio = ((1 - minifiedSize / sourceSize) * 100).toFixed(1);

  console.log(`Source size:    ${(sourceSize / 1024).toFixed(2)} KB`);
  console.log(`Minified size:  ${(minifiedSize / 1024).toFixed(2)} KB`);
  console.log(`Compression:    ${compressionRatio}%`);

  if (minifiedSize > 5120) {
    console.warn('WARNING: SDK exceeds 5KB limit!');
    process.exit(1);
  } else {
    console.log('SUCCESS: SDK is under 5KB limit');
  }

  console.log(`Output: ${SDK_OUTPUT}`);
}

buildSDK().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
