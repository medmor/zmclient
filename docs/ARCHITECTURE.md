# Architecture Overview

## Application Architecture

ZmClient follows a layered architecture pattern:

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  (Pages, Components, Contexts)          │
├─────────────────────────────────────────┤
│           Service Layer                  │
│  (authService, monitorService,          │
│   eventService)                          │
├─────────────────────────────────────────┤
│           API Layer                      │
│  (Axios client with interceptors)        │
├─────────────────────────────────────────┤
│           Storage Layer                  │
│  (Capacitor Preferences / localStorage)  │
└─────────────────────────────────────────┘
```

## Key Components

### Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Login   │────▶│ authService  │────▶│ ZoneMinder  │
│  Page    │     │              │     │   API       │
└──────────┘     └──────────────┘     └─────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │   Store      │
                 │ Credentials  │
                 │ (Preferences)│
                 └──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ AuthContext  │
                 │ (React State)│
                 └──────────────┘
```

### API Client (api.ts)

The API client handles:
- **Request Interception**: Adds authentication token to requests
- **Response Interception**: Handles authentication errors and re-authentication
- **Token Storage**: Manages token persistence using Capacitor Preferences

```typescript
// Token storage flow
tokenStorage.getTokens() → Preferences.get() / localStorage
tokenStorage.setTokens() → Preferences.set() / localStorage
```

### Stream Control

Event playback uses ZoneMinder's stream control API:

```
┌──────────────┐     POST      ┌─────────────┐
│ EventDetail  │──────────────▶│ Stream API  │
│   Page       │               │             │
└──────────────┘               └─────────────┘
       │                              │
       │ connkey                      │
       │ (unique ID)                  │
       │                              │
       ▼                              ▼
┌──────────────┐              ┌─────────────┐
│  MJPEG       │◀─────────────│   Stream    │
│  <img>       │   frames     │   Server    │
└──────────────┘              └─────────────┘
```

**Stream Commands** (from `zm_stream.h`):

| Command | Value | Description |
|---------|-------|-------------|
| CMD_PAUSE | 1 | Pause stream |
| CMD_PLAY | 2 | Resume stream |
| CMD_STOP | 3 | Stop stream |
| CMD_FASTFWD | 4 | Fast forward |
| CMD_SLOWFWD | 5 | Step forward |
| CMD_SLOWREV | 6 | Step backward |
| CMD_FASTREV | 7 | Fast reverse |
| CMD_SEEK | 14 | Seek to position |
| CMD_VARPLAY | 15 | Set playback rate |
| CMD_QUERY | 99 | Query status |

### State Management

- **React Query**: Server state (monitors, events)
- **React Context**: Authentication state
- **Local State**: Component-specific state (playback controls)

## Data Flow

### Loading Events

```
Monitors.tsx
    │
    ▼
monitorService.getMonitors()
    │
    ▼
GET /zm/api/monitors.json
    │
    ▼
Transform response
    │
    ▼
Display monitor list
```

### Event Playback

```
EventDetail.tsx
    │
    ├──▶ eventService.getEvent(id)
    │         │
    │         ▼
    │    GET /zm/api/events/{id}.json
    │         │
    │         ▼
    │    Extract Frame array for alarm indicators
    │
    ├──▶ getStreamUrl() → MJPEG stream URL
    │
    └──▶ controlStream() → Playback commands
              │
              ▼
         POST /zm/index.php?view=request&request=stream
```

## Type Definitions

### Core Types

```typescript
// Authentication
interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

// Monitor
interface Monitor {
  Id: number;
  Name: string;
  Status: string;
  CaptureFPS: string;
  // ...
}

// Event
interface Event {
  Id: number;
  MonitorId: number;
  StartTime: string;
  Length: number;
  Frames: number;
  Frame?: EventFrame[];  // Alarm frame data
  // ...
}

// Event Frame
interface EventFrame {
  FrameId: number;
  Type: 'Alarm' | 'Normal' | 'Bulk';
  Score: number;
}
```

## Error Handling

The API client implements automatic error recovery:

1. **401 Unauthorized**: Attempt re-authentication with stored credentials
2. **Network Errors**: Propagate to UI with error messages
3. **Timeout Errors**: 30-second timeout with fallback handling

## Performance Considerations

- **Image Caching**: Browser handles MJPEG stream caching
- **Polling**: Stream status polled every 2 seconds
- **Lazy Loading**: Events loaded on-demand with pagination