# Screen Narrator Webhook Ingestor

A simple Express.js server that receives webhook notifications from the Screen Narrator application.

## Features

- Receives POST requests on port 3003
- Logs ALARM and CHECKIN events with detailed information
- Provides health check endpoint
- Secure with Helmet.js security headers
- CORS enabled for cross-origin requests
- Request logging with Morgan
- File-based logging for persistence

## Installation

1. Navigate to the webhook-ingestor directory:

```bash
cd webhook-ingestor
```

2. Install dependencies:

```bash
npm install
```

## Running the Server

### Development Mode (with auto-restart)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## Endpoints

### POST /webhook

Main webhook endpoint that receives notifications from Screen Narrator.

**Request Format:**

```json
{
  "eventType": "ALARM" | "CHECKIN",
  "data": {
    "description": "Event description",
    "screenshotPath": "path/to/screenshot.png",
    "captureNumber": 123,
    "sessionId": "session-uuid",
    "eventTimestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "message": "ALARM event received and logged",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "eventType": "ALARM",
  "received": true
}
```

### GET /health

Health check endpoint to verify server status.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "Screen Narrator Webhook Ingestor",
  "version": "1.0.0"
}
```

### POST /test

Test endpoint for debugging webhook requests.

## Logging

- **Console Logging**: All webhook events are logged to the console with detailed formatting
- **File Logging**: Events are also logged to daily log files in the `logs/` directory
- **Request Logging**: HTTP requests are logged using Morgan middleware

## Security

- Helmet.js for security headers
- CORS protection
- Request body size limit (10MB)
- Input validation for webhook events

## Example Usage

Test the webhook endpoint using curl:

```bash
# Test ALARM event
curl -X POST http://localhost:3003/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "ALARM",
    "data": {
      "description": "Queue number detected: 5",
      "screenshotPath": "/path/to/screenshot.png",
      "captureNumber": 42,
      "sessionId": "abc123",
      "eventTimestamp": "2024-01-01T12:00:00.000Z"
    }
  }'

# Test CHECKIN event
curl -X POST http://localhost:3003/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "CHECKIN",
    "data": {
      "description": "User working on email",
      "screenshotPath": "/path/to/screenshot.png",
      "captureNumber": 43,
      "sessionId": "abc123",
      "eventTimestamp": "2024-01-01T12:05:00.000Z"
    }
  }'
```

## Configuration

The server runs on port 3003 by default. You can modify the `PORT` constant in `server.js` to change this.

## Error Handling

The server includes comprehensive error handling for:

- Invalid request format
- Missing required fields
- Invalid event types
- Server errors

All errors return appropriate HTTP status codes and JSON error responses.
