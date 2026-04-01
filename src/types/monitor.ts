/**
 * Monitor types for ZoneMinder API
 */

// The actual monitor configuration from ZoneMinder
export interface MonitorConfig {
  Id: number;
  Name: string;
  Type: string;
  Function: string;
  Enabled: number;
  Host: string | null;
  Port: string;
  Path: string;
  Width: number;
  Height: number;
  Colours: number;
  Deleted: boolean;
}

// The monitor status information
export interface MonitorStatus {
  MonitorId: number | null;
  Status: string | null;
  CaptureFPS: string | null;
  AnalysisFPS: string | null;
  CaptureBandwidth: number | null;
  UpdatedOn: string | null;
}

// The combined monitor object as used in the app
export interface Monitor {
  Id: number;
  Name: string;
  Type: string;
  Function: string;
  Enabled: boolean;
  Host: string;
  Port: string;
  Path: string;
  Width: number;
  Height: number;
  Colours: number;
  Status: string;
  CaptureFPS: string;
  AnalysisFPS: string;
  Deleted: boolean;
}

// API response structure from ZoneMinder
export interface MonitorItem {
  Monitor: MonitorConfig;
  Monitor_Status: MonitorStatus;
}

// ZoneMinder wraps the array in a monitors property
export interface MonitorsResponse {
  monitors: MonitorItem[];
}