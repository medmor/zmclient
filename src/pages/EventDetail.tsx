import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonBadge,
} from '@ionic/react';
import { playOutline, stopOutline, videocamOutline, timeOutline, refreshOutline } from 'ionicons/icons';
import { eventService, monitorService } from '../services';
import { Event, Monitor } from '../types';
import './EventDetail.css';

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [event, setEvent] = useState<Event | null>(null);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get the token from localStorage
        const storedValue = localStorage.getItem('zm_auth_tokens');
        if (storedValue) {
          const tokens = JSON.parse(storedValue);
          setToken(tokens.access_token);
        }
        
        const eventData = await eventService.getEvent(parseInt(id));
        console.log('Event detail loaded:', eventData);
        setEvent(eventData);
        
        // Fetch monitor info
        const monitors = await monitorService.getMonitors();
        const relatedMonitor = monitors.find(m => m.Id === eventData.MonitorId);
        if (relatedMonitor) {
          setMonitor(relatedMonitor);
        }
      } catch (err: unknown) {
        console.error('Failed to fetch event:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const formatDuration = (length: number): string => {
    const minutes = Math.floor(length / 60);
    const seconds = Math.floor(length % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const toggleStream = () => {
    setIsStreaming(prev => !prev);
  };

  const openVideo = () => {
    if (event && token) {
      window.open(eventService.getEventVideoUrl(event.Id, token), '_blank');
    }
  };

  if (isLoading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/events" />
            </IonButtons>
            <IonTitle>Event Details</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <IonText>Loading event...</IonText>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error || !event) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/events" />
            </IonButtons>
            <IonTitle>Event Details</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="error-container">
            <IonText color="danger">
              <p>{error || 'Event not found'}</p>
            </IonText>
            <IonButton onClick={() => history.goBack()}>Go Back</IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/events" />
          </IonButtons>
          <IonTitle>Event {event.Id}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="event-viewer">
          {token && (
            <img
              src={isStreaming 
                ? eventService.getEventStreamUrl(event.Id, token)
                : eventService.getEventThumbnailUrl(event.Id, token)
              }
              alt={`Event ${event.Id}`}
              className="event-image"
            />
          )}
          <div className="viewer-actions">
            <IonButton onClick={toggleStream}>
              <IonIcon slot="icon-only" icon={isStreaming ? stopOutline : playOutline} />
              {isStreaming ? 'Stop' : 'Play Stream'}
            </IonButton>
            {event.Videoed && (
              <IonButton onClick={openVideo} color="secondary">
                <IonIcon slot="icon-only" icon={videocamOutline} />
                Open Video
              </IonButton>
            )}
          </div>
        </div>

        <IonCard>
          <IonCardContent>
            <div className="detail-section">
              <h3>Event Information</h3>
              {monitor && (
                <div className="detail-row">
                  <span className="label">Monitor:</span>
                  <IonBadge color="primary">{monitor.Name}</IonBadge>
                </div>
              )}
              <div className="detail-row">
                <span className="label">Cause:</span>
                <span className="value">{event.Cause || 'Motion'}</span>
              </div>
              {event.Notes && (
                <div className="detail-row">
                  <span className="label">Notes:</span>
                  <span className="value">{event.Notes}</span>
                </div>
              )}
            </div>

            <div className="detail-section">
              <h3>Timing</h3>
              <div className="detail-row">
                <IonIcon icon={timeOutline} />
                <span className="value">{formatDateTime(event.StartTime)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Duration:</span>
                <span className="value">{formatDuration(event.Length)}</span>
              </div>
            </div>

            <div className="detail-section">
              <h3>Statistics</h3>
              <div className="detail-row">
                <span className="label">Frames:</span>
                <span className="value">{event.Frames}</span>
              </div>
              <div className="detail-row">
                <span className="label">Alarm Frames:</span>
                <span className="value">{event.AlarmFrames}</span>
              </div>
              <div className="detail-row">
                <span className="label">Max Score:</span>
                <span className="value">{event.MaxScore}</span>
              </div>
              <div className="detail-row">
                <span className="label">Avg Score:</span>
                <span className="value">{event.AvgScore}</span>
              </div>
              <div className="detail-row">
                <span className="label">Resolution:</span>
                <span className="value">{event.Width} x {event.Height}</span>
              </div>
            </div>

            <div className="detail-section">
              <h3>Status</h3>
              <div className="status-badges">
                {event.Archived && (
                  <IonBadge color="warning">Archived</IonBadge>
                )}
                {event.Videoed && (
                  <IonBadge color="success">
                    <IonIcon icon={videocamOutline} /> Video Available
                  </IonBadge>
                )}
              </div>
            </div>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default EventDetail;