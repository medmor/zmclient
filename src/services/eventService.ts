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
    const response = await api.get<{ Event: Event }>(`/zm/api/events/${id}.json`);
    return response.data.Event;
  }

  /**
   * Get static event thumbnail URL (single frame)
   * Uses the index.php endpoint which returns a static image
   */
  getEventThumbnailUrl(eventId: number, token: string): string {
    return `http://192.168.1.60/zm/index.php?eid=${eventId}&fid=snapshot&view=image&token=${token}`;
  }

  /**
   * Get streaming event URL (MJPEG stream)
   */
  getEventStreamUrl(eventId: number, token: string): string {
    return `http://192.168.1.60/zm/cgi-bin/nph-zms?mode=jpeg&source=event&event=${eventId}&token=${token}`;
  }

  /**
   * Get event video URL
   */
  getEventVideoUrl(eventId: number, token: string): string {
    return `http://192.168.1.60/zm/index.php?view=video&eid=${eventId}&token=${token}`;
  }
}

export const eventService = new EventService();