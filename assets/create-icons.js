import sharp from 'sharp';
import fs from 'fs';

// Create a simple icon with a microphone emoji background
const createIcon = async (size, outputPath) => {
    const svgIcon = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2196F3;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1976D2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad1)" rx="${size * 0.1}"/>
      <circle cx="${size * 0.5}" cy="${size * 0.35}" r="${size * 0.15}" fill="white"/>
      <rect x="${size * 0.45}" y="${size * 0.5}" width="${size * 0.1}" height="${size * 0.2}" fill="white"/>
      <rect x="${size * 0.35}" y="${size * 0.65}" width="${size * 0.3}" height="${size * 0.05}" fill="white"/>
      <text x="${size * 0.5}" y="${size * 0.85}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size * 0.08}" fill="white">SN</text>
    </svg>
  `;

    await sharp(Buffer.from(svgIcon))
        .png()
        .toFile(outputPath);
};

// Generate icons for different platforms
const generateIcons = async () => {
    try {
        // PNG icon for Linux and general use
        await createIcon(512, 'assets/icon.png');
        await createIcon(256, 'assets/icon-256.png');
        await createIcon(128, 'assets/icon-128.png');
        await createIcon(64, 'assets/icon-64.png');
        await createIcon(32, 'assets/icon-32.png');
        await createIcon(16, 'assets/icon-16.png');

        console.log('✅ Icons generated successfully!');
        console.log('📁 Generated files:');
        console.log('   - assets/icon.png (512x512)');
        console.log('   - assets/icon-256.png (256x256)');
        console.log('   - assets/icon-128.png (128x128)');
        console.log('   - assets/icon-64.png (64x64)');
        console.log('   - assets/icon-32.png (32x32)');
        console.log('   - assets/icon-16.png (16x16)');
        console.log('');
        console.log('🔧 For Windows (.ico) and macOS (.icns) icons:');
        console.log('   - Use online converters or specialized tools');
        console.log('   - Convert from the 512x512 PNG for best quality');
        console.log('   - Save as assets/icon.ico and assets/icon.icns');

    } catch (error) {
        console.error('❌ Error generating icons:', error);
    }
};

generateIcons(); 