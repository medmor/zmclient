import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonBadge,
} from '@ionic/react';
import { refreshOutline, videocamOutline, timeOutline, playOutline, stopOutline, openOutline } from 'ionicons/icons';
import { eventService, monitorService } from '../services';
import { Event, Monitor } from '../types';
import './Events.css';

const Events: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [streamingEvents, setStreamingEvents] = useState<Set<number>>(new Set());
  const PAGE_SIZE = 10;
  const history = useHistory();

  const fetchMonitors = async () => {
    try {
      const data = await monitorService.getMonitors();
      setMonitors(data);
    } catch (err) {
      console.error('Failed to fetch monitors:', err);
    }
  };

  const fetchEvents = async (pageNum: number = 1, append: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    
    try {
      // Get the token from localStorage
      const storedValue = localStorage.getItem('zm_auth_tokens');
      if (!storedValue) {
        throw new Error('No authentication token found');
      }
      const tokens = JSON.parse(storedValue);
      const authToken = tokens.access_token;
      setToken(authToken);
      
      const { events: newEvents, total } = await eventService.getEvents({
        monitorId: selectedMonitorId,
        limit: PAGE_SIZE,
        page: pageNum,
      });
      
      if (append) {
        setEvents(prev => [...prev, ...newEvents]);
      } else {
        setEvents(newEvents);
      }
      
      // Check if there are more events to load
      const loadedCount = append ? events.length + newEvents.length : newEvents.length;
      setHasMore(loadedCount < total);
      setPage(pageNum);
    } catch (err: unknown) {
      console.error('Failed to fetch events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  useEffect(() => {
    // Reset and fetch events when monitor filter changes
    setPage(1);
    setHasMore(true);
    fetchEvents(1, false);
  }, [selectedMonitorId]);

  const handleRefresh = () => {
    setPage(1);
    setHasMore(true);
    fetchEvents(1, false);
  };

  const handleMonitorChange = (monitorId: number | undefined) => {
    setSelectedMonitorId(monitorId);
  };

  const loadMore = async (event: CustomEvent<void>) => {
    if (!hasMore || isLoadingMore) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }
    
    await fetchEvents(page + 1, true);
    (event.target as HTMLIonInfiniteScrollElement).complete();
  };

  const formatDuration = (length: number): string => {
    const minutes = Math.floor(length / 60);
    const seconds = Math.floor(length % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getMonitorName = (monitorId: number): string => {
    const monitor = monitors.find(m => m.Id === monitorId);
    return monitor?.Name || `Monitor ${monitorId}`;
  };

  const toggleStream = (eventId: number) => {
    setStreamingEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const isStreaming = (eventId: number): boolean => {
    return streamingEvents.has(eventId);
  };

  const goToEventDetail = (eventId: number) => {
    // Blur active element to prevent focus on aria-hidden elements
    (document.activeElement as HTMLElement)?.blur();
    history.push(`/events/${eventId}`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Events</IonTitle>
          <IonButton slot="end" fill="clear" onClick={handleRefresh} disabled={isLoading}>
            <IonIcon slot="icon-only" icon={refreshOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {/* Monitor Filter */}
        <div className="filter-container">
          <IonSelect
            placeholder="All Monitors"
            value={selectedMonitorId}
            onIonChange={(e) => handleMonitorChange(e.detail.value)}
            interface="popover"
            className="monitor-select"
          >
            <IonSelectOption value={undefined}>All Monitors</IonSelectOption>
            {monitors.map((monitor) => (
              <IonSelectOption key={monitor.Id} value={monitor.Id}>
                {monitor.Name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </div>

        {isLoading ? (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <IonText>Loading events...</IonText>
          </div>
        ) : error ? (
          <div className="error-container">
            <IonText color="danger">
              <p>{error}</p>
            </IonText>
            <IonButton onClick={handleRefresh}>Retry</IonButton>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-container">
            <IonText color="medium">
              <p>No events found</p>
            </IonText>
          </div>
        ) : (
          <>
            <div className="events-list">
              {events.map((event) => (
                <IonCard key={event.Id} className="event-card">
                  <IonCardHeader>
                    <IonCardTitle className="event-title">
                      <IonBadge color="primary">{getMonitorName(event.MonitorId)}</IonBadge>
                      <span className="event-cause">{event.Cause}</span>
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div className="event-thumbnail">
                      {token && (
                        <img
                          src={isStreaming(event.Id) 
                            ? eventService.getEventStreamUrl(event.Id, token)
                            : eventService.getEventThumbnailUrl(event.Id, token)
                          }
                          alt={`Event ${event.Id}`}
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="event-actions">
                      <IonButton 
                        size="small" 
                        fill="outline"
                        onClick={() => toggleStream(event.Id)}
                      >
                        <IonIcon slot="icon-only" icon={isStreaming(event.Id) ? stopOutline : playOutline} />
                        {isStreaming(event.Id) ? 'Stop' : 'Play'}
                      </IonButton>
                      <IonButton 
                        size="small" 
                        fill="outline"
                        onClick={() => goToEventDetail(event.Id)}
                      >
                        <IonIcon slot="icon-only" icon={openOutline} />
                        Details
                      </IonButton>
                    </div>
                    <div className="event-details">
                      <div className="event-info">
                        <IonIcon icon={timeOutline} />
                        <span>{formatDateTime(event.StartTime)}</span>
                      </div>
                      <div className="event-stats">
                        <div className="stat">
                          <span className="stat-label">Duration:</span>
                          <span className="stat-value">{formatDuration(event.Length)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Frames:</span>
                          <span className="stat-value">{event.Frames}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Score:</span>
                          <span className="stat-value">{event.MaxScore}</span>
                        </div>
                      </div>
                      {event.Archived && (
                        <IonBadge color="warning" className="archive-badge">Archived</IonBadge>
                      )}
                      {event.Videoed && (
                        <IonBadge color="success" className="video-badge">
                          <IonIcon icon={videocamOutline} /> Video
                        </IonBadge>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>

            <IonInfiniteScroll onIonInfinite={loadMore} threshold="100px" disabled={!hasMore}>
              <IonInfiniteScrollContent
                loadingSpinner="crescent"
                loadingText="Loading more events..."
              />
            </IonInfiniteScroll>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Events;