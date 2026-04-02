/**
 * Event types for ZoneMinder API
 */

// Event frame information
export interface EventFrame {
  FrameId: number;
  Type: string;
  Timestamp: string;
  Delta: number;
  Score: number;
}

// The actual event data from ZoneMinder
export interface EventData {
  Id: number;
  MonitorId: number;
  Name: string;
  Cause: string;
  Notes: string;
  StartTime: string;
  EndTime: string;
  Width: number;
  Height: number;
  Length: number;
  Frames: number;
  AlarmFrames: number;
  TotScore: number;
  AvgScore: number;
  MaxScore: number;
  Archived: number;
  Videoed: number;
  Uploaded: number;
  Emailed: number;
  Messaged: number;
  Executed: number;
  DefaultVideo: string;
  DefaultImage: string;
  Frame?: EventFrame[]; // Frame data included in event response
}

// API response structure from ZoneMinder
export interface EventItem {
  Event: EventData;
}

export interface EventsResponse {
  events: EventItem[];
  pagination?: {
    count: number;
    page: number;
    limit: number;
  };
}

// The combined event object as used in the app
export interface Event {
  Id: number;
  MonitorId: number;
  MonitorName?: string;
  Name: string;
  Cause: string;
  Notes: string;
  StartTime: string;
  EndTime: string;
  Width: number;
  Height: number;
  Length: number;
  Frames: number;
  AlarmFrames: number;
  TotScore: number;
  AvgScore: number;
  MaxScore: number;
  Archived: boolean;
  Videoed: boolean;
  DefaultVideo: string;
  DefaultImage: string;
  Frame?: EventFrame[]; // Frame data included in event response
}

// Query parameters for fetching events
export interface EventsQueryParams {
  monitorId?: number;
  limit?: number;
  page?: number;
  sort?: string;
}