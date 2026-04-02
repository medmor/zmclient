# ZmClient

A mobile client for ZoneMinder built with Ionic React and Capacitor.

## Overview

ZmClient is a mobile application that connects to a ZoneMinder surveillance server, allowing you to view monitors, browse events, and watch event recordings on your mobile device.

## Features

- **Authentication**: Secure login to ZoneMinder servers with credential storage
- **Monitor List**: View all configured monitors with real-time status
- **Event Browser**: Browse recorded events sorted by time (newest first)
- **Event Playback**: Stream event recordings with full playback controls
  - Play/Pause
  - Step forward/backward frame by frame
  - Variable playback speed (1/4x to 16x)
  - Seek to any position
- **Alarm Frame Indicators**: Visual markers on the progress bar showing alarm frames

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Mobile Framework**: Ionic React + Capacitor
- **State Management**: React Query (TanStack Query)
- **HTTP Client**: Axios
- **Routing**: React Router v5
- **Platform**: Android (Capacitor)

## Prerequisites

- Node.js 18+
- npm or yarn
- ZoneMinder 1.38+ server with API enabled
- Android Studio (for Android builds)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd zmclient

# Install dependencies
npm install

# Start development server
npm run dev
```

## Development

### Web Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`. The Vite dev server proxies API requests to handle CORS.

### Android Development

```bash
# Build web assets
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Running Tests

```bash
# Unit tests
npm run test.unit

# E2E tests
npm run test.e2e
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts (AuthContext)
├── hooks/          # Custom React hooks
├── pages/          # Page components
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Monitors.tsx
│   ├── MonitorDetail.tsx
│   └── EventDetail.tsx
├── services/       # API services
│   ├── api.ts          # Axios client with interceptors
│   ├── authService.ts  # Authentication
│   ├── monitorService.ts
│   └── eventService.ts
├── types/          # TypeScript interfaces
│   ├── auth.ts
│   ├── monitor.ts
│   └── event.ts
└── theme/          # CSS variables and styling
```

## Configuration

### ZoneMinder Server

1. Ensure ZoneMinder API is enabled
2. Configure CORS if running development server separately
3. Note your server URL for login

### Environment Variables

Create a `.env` file for local development:

```env
VITE_ZM_BASE_URL=http://your-zoneminder-server
```

## API Integration

ZmClient connects to ZoneMinder's REST API:

| Endpoint | Description |
|----------|-------------|
| `/zm/api/host/login.json` | Authentication |
| `/zm/api/monitors.json` | List monitors |
| `/zm/api/events.json` | List events |
| `/zm/api/events/{id}.json` | Event details |
| `/zm/cgi-bin/nph-zms` | MJPEG stream |
| `/zm/index.php?view=request&request=stream` | Stream control |

See [docs/API.md](docs/API.md) for detailed API documentation.

## Troubleshooting

### Authentication Issues

- Verify ZoneMinder API is enabled
- Check credentials and server URL
- Ensure CORS is configured for cross-origin requests

### Stream Not Playing

- Verify the event has recorded frames
- Check that the authentication token is valid
- Ensure the stream URL is correct

### Build Errors

```bash
# Clean and rebuild
rm -rf node_modules
npm install
npm run build
```

## License

[Your License Here]

## Contributing

[Contributing Guidelines]