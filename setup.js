import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

console.log('🚀 Setting up Queue Watcher for Windows...\n');

// Check if sound file exists
const soundPath = path.join(process.cwd(), 'sound.wav');
if (!fs.existsSync(soundPath)) {
    console.error('❌ ERROR: sound.wav file not found!');
    console.log('Please ensure sound.wav is in the project directory.');
    process.exit(1);
}

// Check if .env file exists and has OpenAI API key
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ ERROR: .env file not found!');
    console.log('Please create a .env file with your OpenAI API key:');
    console.log('OPENAI_API_KEY=your_api_key_here');
    process.exit(1);
}

// Read and validate .env file
const envContent = fs.readFileSync(envPath, 'utf8');
if (!envContent.includes('OPENAI_API_KEY=') || envContent.includes('your_api_key_here')) {
    console.error('❌ ERROR: Invalid OpenAI API key in .env file!');
    console.log('Please set a valid OpenAI API key in the .env file.');
    process.exit(1);
}

console.log('✅ Sound file found');
console.log('✅ Environment configuration valid');

// Test sound playback
console.log('\n🔊 Testing sound playback...');
const testCommand = `powershell -command "& {Add-Type -TypeDefinition 'using System; using System.Media; public class Sound { public static void Play(string path) { using (var player = new SoundPlayer(path)) { player.PlaySync(); } } }'; [Sound]::Play('${soundPath.replace(/\\/g, '\\\\')}')}"`;

exec(testCommand, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Sound test failed:', error.message);
        console.log('This may affect notifications, but the app will still work.');
    } else {
        console.log('✅ Sound test successful');
    }

    console.log('\n🎯 Setup complete! You can now run the application.');
    console.log('\nTo start the Queue Watcher:');
    console.log('npm start');
    console.log('\nThe app will run in the background and appear in your system tray.');
    console.log('It will check your screen every 30 seconds for queue numbers.');
    console.log('Alerts will sound when your queue position reaches 10, 9, 8, or 5.');
    console.log('\nAll queue data will be logged to queue_log.db and queue-watcher.log');
});

// Create directories if they don't exist
const dirs = ['logs', 'screenshots'];
dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created ${dir} directory`);
    }
}); 