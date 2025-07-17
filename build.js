import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BUILD_CONFIGS = {
    win: {
        name: 'Windows',
        command: 'npm run build:win',
        outputs: ['dist/Screen-Narrator Setup *.exe', 'dist/Screen-Narrator-Portable-*.exe']
    },
    mac: {
        name: 'macOS',
        command: 'npm run build:mac',
        outputs: ['dist/Screen-Narrator-*.dmg']
    },
    linux: {
        name: 'Linux',
        command: 'npm run build:linux',
        outputs: ['dist/Screen-Narrator-*.AppImage', 'dist/Screen-Narrator-*.deb']
    }
};

function checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');

    // Check if electron-builder is installed
    try {
        execSync('npx electron-builder --version', { stdio: 'ignore' });
        console.log('✅ electron-builder is installed');
    } catch (error) {
        console.error('❌ electron-builder is not installed. Run: npm install');
        process.exit(1);
    }

    // Check if assets exist
    const requiredAssets = ['assets/icon.png', 'assets/icon.ico', 'assets/icon.icns'];
    for (const asset of requiredAssets) {
        if (!fs.existsSync(asset)) {
            console.error(`❌ Missing asset: ${asset}`);
            console.log('💡 Run: node assets/create-icons.js');
            process.exit(1);
        }
    }
    console.log('✅ All assets are present');

    // Check if sound.wav exists
    if (!fs.existsSync('sound.wav')) {
        console.log('⚠️  Warning: sound.wav not found. The app will work but without alarm sounds.');
    } else {
        console.log('✅ sound.wav found');
    }

    console.log('');
}

function buildPlatform(platform) {
    const config = BUILD_CONFIGS[platform];
    if (!config) {
        console.error(`❌ Unknown platform: ${platform}`);
        process.exit(1);
    }

    console.log(`🏗️  Building for ${config.name}...`);
    console.log(`📦 Command: ${config.command}`);
    console.log('');

    try {
        execSync(config.command, { stdio: 'inherit' });

        console.log('');
        console.log(`✅ Build completed for ${config.name}!`);
        console.log('📁 Output files:');

        // List generated files
        const distDir = 'dist';
        if (fs.existsSync(distDir)) {
            const files = fs.readdirSync(distDir);
            files.forEach(file => {
                const filePath = path.join(distDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    const size = (stats.size / 1024 / 1024).toFixed(2);
                    console.log(`   - ${file} (${size} MB)`);
                }
            });
        }

    } catch (error) {
        console.error(`❌ Build failed for ${config.name}`);
        console.error(error.message);
        process.exit(1);
    }
}

function showHelp() {
    console.log('🎙️  Screen Narrator Build Script');
    console.log('');
    console.log('Usage: node build.js [platform]');
    console.log('');
    console.log('Platforms:');
    console.log('  win     - Build for Windows (NSIS installer + portable)');
    console.log('  mac     - Build for macOS (DMG)');
    console.log('  linux   - Build for Linux (AppImage + DEB)');
    console.log('  all     - Build for all platforms');
    console.log('');
    console.log('Examples:');
    console.log('  node build.js win');
    console.log('  node build.js all');
    console.log('');
}

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
        showHelp();
        return;
    }

    const platform = args[0];

    checkPrerequisites();

    if (platform === 'all') {
        console.log('🏗️  Building for all platforms...');
        console.log('');

        for (const [key, config] of Object.entries(BUILD_CONFIGS)) {
            buildPlatform(key);
            console.log('');
        }

        console.log('🎉 All builds completed!');
    } else {
        buildPlatform(platform);
    }

    console.log('');
    console.log('🎉 Build process completed!');
    console.log('📁 Check the dist/ directory for your built applications.');
}

main(); 