# 🎙️ Screen Narrator - AI-Powered Screen Monitoring

An advanced Electron application that provides AI-powered screen monitoring and narration with dual operational modes, comprehensive session management, and intelligent alerting capabilities.

## ✨ Features

### 🎯 Dual Operational Modes

- **Check-in Mode**: Continuous, verbose screen narration for accessibility and monitoring
- **Notification Mode**: Intelligent detection and alerting for specific content or events

### 🤖 AI-Powered Intelligence

- **OpenAI Vision API**: Advanced image analysis with GPT-4 Vision
- **Smart Detection**: Sensitive to text, images, names, references, and related content
- **Context Awareness**: Maintains conversation history for continuity in check-in mode

### 📱 Advanced User Interface

- **Dashboard**: Real-time statistics, capture history, and configuration
- **File Manager**: Complete session management with export capabilities
- **Startup Modal**: Easy mode selection and configuration
- **System Tray**: Quick access with intuitive click behaviors

### 🔊 Audio & Visual Feedback

- **Volume Control**: Integrated system volume management
- **Visual Flash Indicator**: Screen-wide blue flash for alarm notifications
- **Text-to-Speech**: Natural voice narration of screen content
- **Sound Alerts**: Custom alarm sounds for notifications

### 🎯 Flexible Targeting

- **Region Selection**: Monitor specific screen areas with visual overlay
- **Full Screen**: Complete screen monitoring capability
- **Dynamic Switching**: Change regions without restarting sessions

### 🔗 Integration & Automation

- **Webhook Support**: HTTP notifications with retry logic and circuit breaker
- **Session Export**: Text-only or complete ZIP archives with screenshots
- **Persistent Settings**: Encrypted storage of preferences and configurations

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** (v18 or higher)
- **OpenAI API Key** (with GPT-4 Vision access)
- **Windows 10/11** (primary platform)

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd screen-narrator

# Install dependencies
npm install

# Start the application
npm start
```

### 3. Initial Setup

1. **API Key Configuration**: Enter your OpenAI API key in the setup modal
2. **Mode Selection**: Choose between Check-in or Notification mode
3. **Region Selection**: Optionally select a specific screen region to monitor
4. **Start Monitoring**: Begin your AI-powered screen monitoring session

## 🎮 Usage Guide

### System Tray Controls

- **Left Click**: Open dashboard
- **Right Click**: Show volume control
- **Double Click**: Toggle mute/unmute
- **Context Menu**: Access all features and settings

### Dashboard Features

- **Real-time Statistics**: Captures, mode, region, and frequency
- **Configure New Session**: Start fresh monitoring sessions
- **Frequency Control**: Adjust capture intervals (10 seconds to 7 days)
- **Webhook Configuration**: Set up HTTP notifications
- **Recent Captures**: Visual history with alarm indicators

### File Manager

- **Session Overview**: Browse all monitoring sessions
- **Export Options**: Text-only or complete ZIP exports
- **Storage Statistics**: Monitor disk usage and file counts
- **Session Cleanup**: Delete old sessions to free space

## 🔧 Configuration Options

### Capture Frequency

- **Range**: 10 seconds to 7 days
- **Units**: Seconds, minutes, hours, days
- **Default**: 5 minutes
- **Dynamic**: Change without restarting sessions

### Notification Mode Setup

```
Target: "michael jackson"
Sensitivity: High (detects text, images, references)
Response: [ALARM] + brief description or "Target not detected"
```

### Check-in Mode Setup

```
Narration: Continuous, verbose descriptions
Context: Maintains history of last 3 captures
Voice: Text-to-speech with natural speech patterns
```

### Webhook Configuration

```
URL: http://localhost:3003/webhook
Events: ALARM and/or CHECKIN
Retry: 3 attempts with exponential backoff
Circuit Breaker: Auto-disable after 5 failures
```

## 📊 Session Management

### Export Formats

- **Text Only**: Descriptions and timestamps in `.txt` format
- **Complete Archive**: ZIP file with descriptions and all screenshots

### Storage Structure

```
sessions/
├── [session-id]/
│   ├── screenshots/
│   │   ├── capture_001_[timestamp].png
│   │   └── capture_002_[timestamp].png
│   ├── descriptions.txt
│   └── session.log
```

### Data Retention

- **Automatic Cleanup**: Optional session deletion
- **Export Before Delete**: Preserve important sessions
- **Storage Monitoring**: Track disk usage in dashboard

## 🔗 Webhook Integration

### Payload Structure

```json
{
  "eventType": "ALARM" | "CHECKIN",
  "data": {
    "description": "AI-generated description",
    "screenshotPath": "/path/to/screenshot.png",
    "captureNumber": 42,
    "sessionId": "uuid-session-id",
    "eventTimestamp": "2024-01-01T12:00:00.000Z",
    "mode": "notification" | "checkin"
  }
}
```

### Example Webhook Server

A sample webhook server is included in `/webhook-ingestor/` with:

- Express.js server on port 3003
- Comprehensive logging and error handling
- Health check endpoints
- Security headers and validation

## 🛠️ Advanced Features

### Region Selection

1. Click "Select Target Region" in tray menu
2. Draw selection rectangle on screen
3. Visual overlay shows selected area
4. Monitor only the targeted region

### Volume Control

- **Integrated Controls**: System volume management
- **Quick Access**: Right-click tray for volume slider
- **Keyboard Shortcuts**: Arrow keys, spacebar, escape
- **Auto-hide**: Slider disappears after 5 seconds

### Flash Indicator

- **Visual Feedback**: Blue screen border flash on alarms
- **Duration**: 5 seconds with 0.5-second intervals
- **Concurrent**: Synchronized with alarm sound
- **Non-intrusive**: Transparent, click-through overlay

## 🔐 Security & Privacy

### API Key Management

- **Encrypted Storage**: AES encryption for stored keys
- **Development Mode**: Bypass for local development
- **Validation**: Test keys before saving
- **Secure Transmission**: HTTPS-only API communication

### Data Protection

- **Local Storage**: All data stored locally
- **No Cloud Sync**: Complete privacy control
- **Encrypted Settings**: User preferences encrypted
- **Session Isolation**: Each session in separate directory

## 🛠️ Troubleshooting

### Common Issues

**API Key Problems**

- Verify key has GPT-4 Vision access
- Check OpenAI account credits
- Test key in API key settings

**Screenshot Issues**

- Check Windows privacy settings
- Ensure screen recording permissions
- Try running as administrator

**Audio Problems**

- Verify sound.wav file exists
- Check Windows audio settings
- Test volume control functionality

**Performance Issues**

- Adjust capture frequency
- Clean up old sessions
- Monitor system resources

### Debug Information

- **Session Logs**: Detailed logging in each session folder
- **Console Output**: Real-time debugging information
- **Error Handling**: Comprehensive error reporting
- **Health Monitoring**: Webhook circuit breaker status

## 📱 System Requirements

### Minimum Requirements

- **OS**: Windows 10/11 (primary), macOS/Linux (experimental)
- **Memory**: 4GB RAM
- **Storage**: 1GB free space
- **Network**: Internet connection for OpenAI API

### Recommended

- **Memory**: 8GB RAM for smooth operation
- **Storage**: 5GB for extensive session history
- **Display**: Multiple monitors supported
- **Audio**: Speakers/headphones for alerts

## 🔄 Updates & Maintenance

### Regular Maintenance

- **Clean Sessions**: Export and delete old sessions
- **Monitor Storage**: Check disk usage in file manager
- **Update Dependencies**: Keep packages current
- **API Usage**: Monitor OpenAI token consumption

### Backup Recommendations

- **Export Sessions**: Regular exports of important sessions
- **Settings Backup**: Copy settings files before updates
- **Screenshot Archives**: Maintain external backups if needed

## 🆘 Support & Contributing

### Getting Help

1. Check the troubleshooting section
2. Review session logs for errors
3. Test with minimal configuration
4. Verify all permissions are granted

### Development

- **Architecture**: Electron + Node.js
- **AI Integration**: OpenAI Vision API
- **Storage**: File-based with encryption
- **UI Framework**: Vanilla HTML/CSS/JavaScript

---

**Built with ❤️ for accessibility, monitoring, and automation**

_Screen Narrator provides powerful AI-driven screen monitoring capabilities while maintaining complete user privacy and control._
