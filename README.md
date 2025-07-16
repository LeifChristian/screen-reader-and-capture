# 🔍 Queue Watcher - Electron Background Monitor

An Electron application that runs in the background, monitors your screen for queue numbers, and alerts you when your position reaches critical thresholds.

## ✨ Features

- **Background Monitoring**: Runs in system tray, continuously watching your screen
- **AI-Powered OCR**: Uses OpenAI Vision API to extract queue numbers from screenshots
- **Smart Alerts**: Notifications at queue positions 10, 9, 8, and 5
- **Sound Notifications**: Plays your custom sound file when alerts trigger
- **Database Logging**: All queue data logged to SQLite database
- **Windows Optimized**: Designed specifically for Windows environment

## 🚀 Setup Instructions

### 1. Prerequisites

Make sure you have:

- **Node.js** (v18 or higher)
- **OpenAI API Key** (with GPT-4 Vision access)
- **Windows 10/11** (tested environment)

### 2. Installation

```bash
# Install dependencies
npm install

# Run setup script
npm run setup
```

### 3. Configuration

The setup script will check for:

- ✅ `sound.wav` file in the project directory
- ✅ Valid OpenAI API key in `.env` file
- ✅ Sound playback functionality

### 4. Start the Application

```bash
npm start
```

The app will:

- Launch in the background (system tray)
- Begin monitoring your screen every 30 seconds
- Show a dashboard window (can be minimized)

## 🎯 How It Works

1. **Screenshot Capture**: Takes periodic screenshots of your entire screen
2. **AI Processing**: Sends images to OpenAI Vision API to extract queue numbers
3. **Alert Logic**: Triggers notifications when queue position reaches 10, 9, 8, or 5
4. **Sound Alerts**: Plays `sound.wav` file for each alert
5. **Data Logging**: Saves all queue data to `queue_log.db` and `queue-watcher.log`

## 📊 Dashboard Features

- **Real-time Status**: Current queue position and last check time
- **Alert Settings**: Shows configured notification thresholds
- **Recent Logs**: History of detected queue numbers
- **Controls**: Test sound, manual check, clear logs

## 🔧 System Tray Options

Right-click the tray icon to access:

- **Show Dashboard**: Open the main window
- **Status**: Current monitoring status
- **Quit**: Exit the application

## 📁 Files Generated

- `queue_log.db` - SQLite database with all queue data
- `queue-watcher.log` - Application log file
- `screenshot.png` - Latest screenshot (temporary)

## ⚙️ Configuration

### Alert Thresholds

Currently set to: **10, 9, 8, 5**

To modify, edit the `ALERT_NUMBERS` array in `capture.js`:

```javascript
const ALERT_NUMBERS = [10, 9, 8, 5]; // Customize these values
```

### Check Interval

Default: 30 seconds (for testing)

To modify, edit `INTERVAL_MS` in `capture.js`:

```javascript
const INTERVAL_MS = 30 * 1000; // 30 seconds
```

## 🔊 Sound Requirements

- Place your `sound.wav` file in the project root directory
- Supported formats: WAV (recommended for Windows)
- The setup script will test sound playback

## 🛠️ Troubleshooting

### Common Issues

1. **Sound Not Playing**

   - Ensure `sound.wav` exists in project directory
   - Check Windows audio settings
   - Run `npm run setup` to test sound

2. **No Queue Numbers Detected**

   - Verify OpenAI API key is valid
   - Check if queue numbers are clearly visible on screen
   - Review logs in `queue-watcher.log`

3. **Screenshot Issues**
   - Ensure Windows allows screen capture
   - Check Windows Privacy settings for screen recording
   - Try running as administrator

### Logs and Debugging

- Check `queue-watcher.log` for detailed application logs
- Database logs are in `queue_log.db` (can be viewed with SQLite browser)
- Console logs appear in the Electron DevTools

## 📱 Windows Permissions

The app may need permissions for:

- **Screen capture** (Windows Privacy Settings)
- **Sound playback** (Windows Audio Settings)
- **File system access** (for logging and database)

## 🔄 Updates and Maintenance

- Queue data is automatically archived in the database
- Log files rotate to prevent disk space issues
- Screenshots are temporary and overwritten each check

## 🆘 Support

If you encounter issues:

1. Run `npm run setup` to verify configuration
2. Check the log files for error messages
3. Ensure all permissions are granted
4. Verify OpenAI API key has sufficient credits

## 🎮 Usage Tips

- **Minimize to tray**: Close the dashboard window to run purely in background
- **Test alerts**: Use the "Test Sound" button to verify audio works
- **Monitor logs**: Keep an eye on the Recent Logs section for issues
- **Adjust timing**: Modify check interval based on your queue's update frequency

---

**Note**: This application is designed for Windows environments and requires an active OpenAI API key with GPT-4 Vision access.
