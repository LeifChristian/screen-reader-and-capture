const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3003;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Request logging
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Utility function to log webhook events
function logWebhookEvent(eventType, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        eventType,
        data,
        receivedAt: new Date().toLocaleString()
    };

    // Log to console
    console.log(`\n🔔 WEBHOOK RECEIVED [${eventType}] - ${timestamp}`);
    console.log('─'.repeat(60));

    if (eventType === 'ALARM') {
        console.log(`🚨 ALARM TRIGGERED!`);
        console.log(`📝 Description: ${data.description}`);
        console.log(`📸 Screenshot: ${data.screenshotPath || 'N/A'}`);
        console.log(`🔢 Capture #: ${data.captureNumber || 'N/A'}`);
    } else if (eventType === 'CHECKIN') {
        console.log(`✅ CHECK-IN EVENT`);
        console.log(`📝 Description: ${data.description}`);
        console.log(`📸 Screenshot: ${data.screenshotPath || 'N/A'}`);
        console.log(`🔢 Capture #: ${data.captureNumber || 'N/A'}`);
    }

    console.log(`🎯 Session: ${data.sessionId || 'N/A'}`);
    console.log(`⏰ Event Time: ${data.eventTimestamp || 'N/A'}`);
    console.log('─'.repeat(60));

    // Log to file
    const logFile = path.join(logsDir, `webhook-${new Date().toISOString().split('T')[0]}.log`);
    const logLine = `${timestamp} [${eventType}] ${JSON.stringify(data)}\n`;

    fs.appendFileSync(logFile, logLine);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Screen Narrator Webhook Ingestor',
        version: '1.0.0'
    });
});

// Main webhook endpoint
app.post('/webhook', (req, res) => {
    try {
        const { eventType, data } = req.body;

        // Validate request
        if (!eventType || !data) {
            return res.status(400).json({
                error: 'Invalid request format',
                message: 'eventType and data are required',
                timestamp: new Date().toISOString()
            });
        }

        // Validate event type
        if (!['ALARM', 'CHECKIN'].includes(eventType)) {
            return res.status(400).json({
                error: 'Invalid event type',
                message: 'eventType must be ALARM or CHECKIN',
                timestamp: new Date().toISOString()
            });
        }

        // Log the webhook event
        logWebhookEvent(eventType, data);

        // Send successful response
        res.status(200).json({
            status: 'success',
            message: `${eventType} event received and logged`,
            timestamp: new Date().toISOString(),
            eventType,
            received: true
        });

    } catch (error) {
        console.error('Error processing webhook:', error);

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process webhook',
            timestamp: new Date().toISOString()
        });
    }
});

// Generic POST endpoint for testing
app.post('/test', (req, res) => {
    console.log('\n🧪 TEST WEBHOOK RECEIVED');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    res.json({
        status: 'test received',
        timestamp: new Date().toISOString(),
        headers: req.headers,
        body: req.body
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'Endpoint not found',
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /health',
            'POST /webhook',
            'POST /test'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);

    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Screen Narrator Webhook Ingestor Server');
    console.log('═'.repeat(50));
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
    console.log('═'.repeat(50));
    console.log('📝 Logs will be saved to:', path.join(__dirname, 'logs'));
    console.log('⏰ Server started at:', new Date().toLocaleString());
    console.log('\n🎯 Waiting for webhook events...\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
}); 