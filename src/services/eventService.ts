/**
 * Event service for ZoneMinder API
 */
import api from './api';
import { Event, EventsResponse, EventItem, EventsQueryParams } from '../types';

class EventService {
  /**
   * Get events with optional filtering and pagination
   */
  async getEvents(params: EventsQueryParams = {}): Promise<{ events: Event[]; total: number }> {
    try {
      const { monitorId, limit = 10, page = 1 } = params;
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (monitorId) {
        queryParams.append('MonitorId', monitorId.toString());
      }
      queryParams.append('limit', limit.toString());
      queryParams.append('page', page.toString());
      
      const response = await api.get<EventsResponse>(`/zm/api/events.json?${queryParams.toString()}`);
      
      // ZoneMinder returns { events: [...] }
      const eventItems = response.data.events;
      
      // Transform the nested structure into flat Event objects
      const events = eventItems.map((item: EventItem) => ({
        Id: item.Event.Id,
        MonitorId: item.Event.MonitorId,
        Name: item.Event.Name,
        Cause: item.Event.Cause || 'Motion',
        Notes: item.Event.Notes || '',
        StartTime: item.Event.StartTime,
        EndTime: item.Event.EndTime,
        Width: item.Event.Width,
        Height: item.Event.Height,
        Length: item.Event.Length,
        Frames: item.Event.Frames,
        AlarmFrames: item.Event.AlarmFrames,
        TotScore: item.Event.TotScore,
        AvgScore: item.Event.AvgScore,
        MaxScore: item.Event.MaxScore,
        Archived: item.Event.Archived === 1,
        Videoed: item.Event.Videoed === 1,
        DefaultVideo: item.Event.DefaultVideo || '',
        DefaultImage: item.Event.DefaultImage || '',
      }));
      
      // Get total count from pagination or estimate
      const total = response.data.pagination?.count || events.length;
      
      return { events, total };
    } catch (error) {
      console.error('Failed to fetch events:', error);
      throw error;
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(id: number): Promise<Event> {
    const response = await api.get(`/zm/api/events/${id}.json`);
    
    // ZoneMinder API returns { event: { Event: { ... }, Monitor: { ... }, ... } }
    // We need to extract the actual Event object from response.data.event.Event
    const eventData = response.data.event?.Event || response.data.Event;
    
    if (!eventData) {
      throw new Error('Event data not found in response');
    }
    
    return eventData;
  }

  /**
   * Get static event thumbnail URL (single frame)
   * Uses the index.php endpoint which returns a static image
   */
  getEventThumbnailUrl(eventId: number, token: string): string {
    return `http://192.168.1.60/zm/index.php?eid=${eventId}&fid=snapshot&view=image&token=${token}`;
  }

  /**
   * Get streaming event URL (MJPEG stream) with playback controls
   * @param eventId - Event ID
   * @param token - Authentication token
   * @param options - Playback options
   *   - rate: Playback speed (25=1/4x, 50=1/2x, 100=1x, 200=2x, 500=5x, 1000=10x, 1600=16x)
   *   - frame: Starting frame number (default: 1)
   *   - scale: Image scale factor (10=100%, 50=50%, 25=25%)
   *   - maxfps: Maximum frames per second (default: 30)
   *   - replay: Replay mode ('none', 'single', 'all')
   *   - connkey: Connection key for stream control (required for pause/play)
   */
  getEventStreamUrl(
    eventId: number,
    token: string,
    options: {
      rate?: number;
      frame?: number;
      scale?: number;
      maxfps?: number;
      replay?: 'none' | 'single' | 'all';
      connkey?: number;
    } = {}
  ): string {
    const { rate = 100, frame = 1, scale = 100, maxfps = 30, replay = 'none', connkey } = options;
    let url = `http://192.168.1.60/zm/cgi-bin/nph-zms?mode=jpeg&frame=${frame}&scale=${scale}&rate=${rate}&maxfps=${maxfps}&replay=${replay}&source=event&event=${eventId}&token=${token}`;
    if (connkey) {
      url += `&connkey=${connkey}`;
    }
    return url;
  }

  /**
   * Send control command to a stream (pause, resume, etc.)
   * Uses ZoneMinder's index.php endpoint with view=request&request=stream
   * @param eventId - The event ID (not used in command, but kept for API consistency)
   * @param connkey - The connection key of the stream to control
   * @param command - The control command (pause, resume, stop, etc.)
   * @param token - Authentication token
   */
  async controlStream(
    eventId: number,
    connkey: number,
    command: 'pause' | 'resume' | 'stop' | 'fastFwd' | 'fastRev' | 'stepBack' | 'stepForward',
    token: string
  ): Promise<void> {
    // ZoneMinder command constants (from zm_stream.h)
    // CMD_PAUSE=1, CMD_PLAY=2, CMD_STOP=3, CMD_FASTFWD=4, CMD_SLOWFWD=5, CMD_SLOWREV=6, CMD_FASTREV=7
    const commandMap: Record<string, number> = {
      'pause': 1,       // CMD_PAUSE
      'resume': 2,      // CMD_PLAY
      'stop': 3,        // CMD_STOP
      'fastFwd': 4,     // CMD_FASTFWD
      'stepForward': 5, // CMD_SLOWFWD
      'stepBack': 6,    // CMD_SLOWREV
      'fastRev': 7      // CMD_FASTREV
    };
    
    const cmdValue = commandMap[command];
    
    // Use ZoneMinder's stream control endpoint
    // Pattern from event.js: streamReq({command: CMD_PAUSE}) -> index.php?view=request&request=stream&connkey=...&command=...
    const params = new URLSearchParams({
      view: 'request',
      request: 'stream',
      connkey: connkey.toString(),
      command: cmdValue.toString(),
      token: token
    });
    
    const url = `/zm/index.php?${params.toString()}`;
    
    try {
      await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
    } catch {
      // Stream control is best-effort, ignore errors
    }
  }

  /**
   * Set playback rate for a stream (uses CMD_VARPLAY = 15)
   * This changes speed without reloading the stream
   * @param connkey - The connection key of the stream
   * @param rate - Playback rate (25=1/4x, 50=1/2x, 100=1x, 200=2x, 500=5x, 1000=10x, 1600=16x)
   * @param token - Authentication token
   */
  async setPlaybackRate(
    connkey: number,
    rate: number,
    token: string
  ): Promise<void> {
    // CMD_VARPLAY = 15 (from zm_stream.h enum: CMD_NONE=0...CMD_VARPLAY=15)
    const params = new URLSearchParams({
      view: 'request',
      request: 'stream',
      connkey: connkey.toString(),
      command: '15', // CMD_VARPLAY
      rate: rate.toString(),
      token: token
    });
    
    const url = `/zm/index.php?${params.toString()}`;
    
    try {
      await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
    } catch {
      // Stream control is best-effort, ignore errors
    }
  }

  /**
   * Get event video URL
   */
  getEventVideoUrl(eventId: number, token: string): string {
    return `http://192.168.1.60/zm/index.php?view=video&eid=${eventId}&token=${token}`;
  }
}

export const eventService = new EventService();