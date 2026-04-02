# ZoneMinder API Integration

## Overview

ZmClient integrates with ZoneMinder's REST API (version 1.38+). This document details the API endpoints used and their implementation in the client.

## Authentication

### Login

**Endpoint**: `POST /zm/api/host/login.json`

**Request**:
```http
Content-Type: application/x-www-form-urlencoded

user=<username>&pass=<password>
```

**Response**:
```json
{
  "access_token": "<session_token>",
  "refresh_token": "<refresh_token>"
}
```

**Implementation** (`src/services/authService.ts`):
```typescript
const params = new URLSearchParams();
params.append('user', credentials.username);
params.append('pass', credentials.password);

const response = await api.post<AuthTokens>(
  '/zm/api/host/login.json',
  params,
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
);
```

### Logout

**Endpoint**: `POST /zm/api/host/logout.json`

Clears the server session and local authentication state.

## Monitors

### List Monitors

**Endpoint**: `GET /zm/api/monitors.json`

**Response**:
```json
{
  "monitors": [
    {
      "Monitor": {
        "Id": 1,
        "Name": "Front Door",
        "Type": "Remote",
        "Function": "Modect",
        "Enabled": 1,
        "Width": 1920,
        "Height": 1080
      },
      "Monitor_Status": {
        "Status": "Connected",
        "CaptureFPS": "10.5"
      }
    }
  ]
}
```

**Implementation** (`src/services/monitorService.ts`):
```typescript
const response = await api.get<MonitorsResponse>('/zm/api/monitors.json');
// Transform nested structure to flat Monitor objects
const monitors = response.data.monitors.map((item) => ({
  Id: item.Monitor.Id,
  Name: item.Monitor.Name,
  Status: item.Monitor_Status?.Status || 'Unknown',
  // ...
}));
```

## Events

### List Events

**Endpoint**: `GET /zm/api/events.json`

**Query Parameters**:

| Parameter | Description | Default |
|-----------|-------------|---------|
| MonitorId | Filter by monitor | - |
| limit | Results per page | 10 |
| page | Page number | 1 |
| sort | Sort field | StartTime |
| direction | Sort direction | desc |

**Response**:
```json
{
  "events": [
    {
      "Event": {
        "Id": 123,
        "MonitorId": 1,
        "Name": "Motion Detected",
        "StartTime": "2024-01-15 10:30:00",
        "Length": 45.5,
        "Frames": 455,
        "AlarmFrames": 12
      }
    }
  ],
  "pagination": {
    "count": 100,
    "page": 1,
    "limit": 10
  }
}
```

**Implementation** (`src/services/eventService.ts`):
```typescript
const queryParams = new URLSearchParams();
queryParams.append('sort', 'StartTime');
queryParams.append('direction', 'desc');  // Newest first
queryParams.append('limit', limit.toString());
queryParams.append('page', page.toString());

const response = await api.get<EventsResponse>(
  `/zm/api/events.json?${queryParams.toString()}`
);
```

### Get Event Details

**Endpoint**: `GET /zm/api/events/{id}.json`

**Response**:
```json
{
  "event": {
    "Event": {
      "Id": 123,
      "MonitorId": 1,
      "Length": 45.5,
      "Frames": 455
    },
    "Frame": [
      { "FrameId": 1, "Type": "Normal", "Score": 0 },
      { "FrameId": 50, "Type": "Alarm", "Score": 85 },
      { "FrameId": 51, "Type": "Alarm", "Score": 92 }
    ],
    "Monitor": { ... }
  }
}
```

**Frame Types**:
- `Normal`: Regular frame
- `Alarm`: Motion detected frame
- `Bulk`: Bulk frame (low detail)

**Implementation** (`src/services/eventService.ts`):
```typescript
const response = await api.get(`/zm/api/events/${id}.json`);
const eventData = response.data.event?.Event;
// Attach Frame array for alarm indicators
if (response.data.event?.Frame) {
  eventData.Frame = response.data.event.Frame;
}
return eventData;
```

## Event Streaming

### MJPEG Stream

**Endpoint**: `GET /zm/cgi-bin/nph-zms`

**Parameters**:

| Parameter | Description | Example |
|-----------|-------------|----------|
| mode | Stream mode | jpeg |
| source | Source type | event |
| event | Event ID | 123 |
| token | Auth token | abc123 |
| connkey | Connection key | 12345 |
| rate | Playback speed | 100 (1x) |
| frame | Starting frame | 1 |
| scale | Image scale | 100 |
| maxfps | Max frame rate | 30 |
| replay | Replay mode | none |

**Implementation** (`src/services/eventService.ts`):
```typescript
getEventStreamUrl(eventId: number, token: string, options = {}) {
  const { rate = 100, frame = 1, scale = 100, maxfps = 30, replay = 'none', connkey } = options;
  return `/zm/cgi-bin/nph-zms?mode=jpeg&frame=${frame}&scale=${scale}&rate=${rate}&maxfps=${maxfps}&replay=${replay}&source=event&event=${eventId}&token=${token}&connkey=${connkey}`;
}
```

### Stream Control

**Endpoint**: `POST /zm/index.php?view=request&request=stream`

**Parameters**:

| Parameter | Description | Example |
|-----------|-------------|----------|
| connkey | Connection key | 12345 |
| command | Command ID | 1 (pause) |
| token | Auth token | abc123 |

**Commands** (from `zm_stream.h`):

| Command | ID | Description |
|---------|-----|-------------|
| CMD_PAUSE | 1 | Pause playback |
| CMD_PLAY | 2 | Resume playback |
| CMD_STOP | 3 | Stop stream |
| CMD_FASTFWD | 4 | Fast forward |
| CMD_SLOWFWD | 5 | Step forward one frame |
| CMD_SLOWREV | 6 | Step backward one frame |
| CMD_FASTREV | 7 | Fast reverse |
| CMD_SEEK | 14 | Seek to position |
| CMD_VARPLAY | 15 | Set playback rate |
| CMD_QUERY | 99 | Query stream status |

**Implementation** (`src/services/eventService.ts`):
```typescript
async controlStream(connkey: number, command: string, token: string) {
  const commandMap = {
    'pause': 1,
    'resume': 2,
    'stop': 3,
    'fastFwd': 4,
    'stepForward': 5,
    'stepBack': 6,
    'fastRev': 7
  };
  
  const params = new URLSearchParams();
  params.append('connkey', connkey.toString());
  params.append('command', commandMap[command].toString());
  
  await api.post(`/zm/index.php?view=request&request=stream&token=${token}`, params);
}
```

### Set Playback Rate

**Endpoint**: Same as Stream Control with `command=15`

**Additional Parameters**:

| Parameter | Description | Example |
|-----------|-------------|----------|
| rate | Playback rate | 200 (2x) |

**Rate Values**:

| Rate | Value |
|------|-------|
| 1/4x | 25 |
| 1/2x | 50 |
| 1x | 100 |
| 2x | 200 |
| 5x | 500 |
| 10x | 1000 |
| 16x | 1600 |

### Seek to Position

**Endpoint**: Same as Stream Control with `command=14`

**Additional Parameters**:

| Parameter | Description | Example |
|-----------|-------------|----------|
| offset | Time offset (seconds) | 10.5 |

### Query Stream Status

**Endpoint**: Same as Stream Control with `command=99`

**Response**:
```json
{
  "status": "Playing",
  "paused": false,
  "progress": 15.5
}
```

## Error Handling

### Common Errors

| Status | Error | Handling |
|--------|-------|----------|
| 401 | Unauthorized | Re-authenticate with stored credentials |
| 403 | Forbidden | Redirect to login |
| 404 | Not Found | Show error message |
| 500 | Server Error | Show error message, retry if applicable |

### Error Response Format

```json
{
  "success": false,
  "data": {
    "message": "Error description"
  }
}
```

## CORS Configuration

For development, the Vite proxy handles CORS. For production, configure ZoneMinder to allow cross-origin requests:

```apache
# Apache configuration
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization"
```

## Rate Limiting

ZoneMinder API does not implement rate limiting by default. However, the client implements:

- Request timeouts (30 seconds)
- Automatic retry on network failure (1 retry)
- Debounced requests for rapid user actions