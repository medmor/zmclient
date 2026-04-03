import { useEffect, useState, useCallback } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonBadge,
  IonRange,
  IonLabel,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { playOutline, pauseOutline, playForwardOutline, playBackOutline, videocamOutline, timeOutline, refreshOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { eventService, monitorService } from '../services';
import { tokenStorage } from '../services/api';
import { Event, Monitor } from '../types';
import './EventDetail.css';

// Playback speed options (ZoneMinder style)
const PLAYBACK_SPEEDS = [
  { label: '1/4x', value: 25 },
  { label: '1/2x', value: 50 },
  { label: '1x', value: 100 },
  { label: '2x', value: 200 },
  { label: '5x', value: 500 },
  { label: '10x', value: 1000 },
  { label: '16x', value: 1600 },
];

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [event, setEvent] = useState<Event | null>(null);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(true); // true = playing (stream starts playing automatically)
  const [playbackSpeed, setPlaybackSpeed] = useState(100); // Default 1x
  const [currentFrame, setCurrentFrame] = useState(1);
  const [streamKey, setStreamKey] = useState(0); // Used to force img reload
  const [connkey, setConnkey] = useState<number>(() => Math.floor(Math.random() * 1000000) + 100000); // Generate connkey on mount
  const [alarmFrames, setAlarmFrames] = useState<number[]>([]); // Frame IDs that are alarms
  const [streamUrl, setStreamUrl] = useState<string>(''); // For native platform blob URL

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get the token from tokenStorage (works on both web and native platforms)
        const tokens = await tokenStorage.getTokens();
        if (tokens) {
          setToken(tokens.access_token);
        }
        
        const eventData = await eventService.getEvent(parseInt(id));
        setEvent(eventData);
        
        // Extract alarm frame IDs from embedded Frame array
        if (eventData.Frame && Array.isArray(eventData.Frame)) {
          const alarmFrameIds = eventData.Frame
            .filter((f: { Type: string; FrameId: number }) => f.Type === 'Alarm')
            .map((f: { Type: string; FrameId: number }) => f.FrameId);
          setAlarmFrames(alarmFrameIds);
        }
        
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

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (connkey > 0 && token) {
        eventService.controlStream(Number(id), connkey, 'stop', token).catch(() => {
          // Ignore errors on cleanup
        });
      }
    };
  }, [connkey, token]);

  // Web platform: Set stream URL directly
  useEffect(() => {
    console.log('[EventDetail Web] useEffect triggered', { 
      isNative: Capacitor.isNativePlatform(), 
      hasToken: !!token, 
      hasEvent: !!event 
    });
    
    if (Capacitor.isNativePlatform() || !token || !event) return;
    
    const setWebStreamUrl = async () => {
      const url = await eventService.getEventStreamUrl(event.Id, token, {
        rate: playbackSpeed,
        frame: currentFrame,
        scale: 100,
        maxfps: 30,
        replay: 'none',
        connkey: connkey || undefined,
      });
      console.log('[EventDetail Web] Stream URL:', url);
      if (url) {
        setStreamUrl(url);
      }
    };
    
    setWebStreamUrl();
  }, [token, event, streamKey, playbackSpeed, currentFrame, connkey]);

  // Native platform: Fetch stream as blob to avoid Mixed Content issues
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !token || !event) return;
    
    let timeoutId: ReturnType<typeof setTimeout>;
    let objectUrl: string | null = null;
    
    const fetchStream = async (logDetails: boolean = false) => {
      try {
        const url = await getStreamUrl();
        if (logDetails) {
          console.log('[EventDetail] Stream URL:', url);
        }
        if (!url) {
          if (logDetails) {
            console.log('[EventDetail] No URL returned from getStreamUrl()');
          }
          return;
        }
        if (logDetails) {
          console.log('[EventDetail] Fetching stream from:', url);
        }
        const response = await fetch(url);
        if (logDetails) {
          console.log('[EventDetail] Response status:', response.status);
        }
        const blob = await response.blob();
        if (logDetails) {
          console.log('[EventDetail] Blob size:', blob.size, 'type:', blob.type);
        }
        objectUrl = URL.createObjectURL(blob);
        if (logDetails) {
          console.log('[EventDetail] Object URL:', objectUrl);
        }
        setStreamUrl(objectUrl);
      } catch (err) {
        console.error('[EventDetail] Failed to fetch stream:', err);
      }
    };
    
    // Initial fetch with logging
    fetchStream(true);
    
    // Poll for updates (stream is MJPEG, so we need to refresh)
    const pollInterval = setInterval(() => {
      fetchStream(false); // No logging for poll updates
    }, 100); // Fast polling for smooth stream
    
    return () => {
      clearInterval(pollInterval);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [token, event, streamKey, playbackSpeed, currentFrame, connkey]);

  // Poll stream status to sync playback position (recursive pattern like ZoneMinder)
  useEffect(() => {
    if (!token || connkey === 0 || !isStreaming || !event) return;
    
    let pollErrors = 0;
    const MAX_POLL_ERRORS = 3;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const pollStatus = async () => {
      try {
        const status = await eventService.queryStreamStatus(connkey, token);
        if (status) {
          pollErrors = 0; // Reset error count on success
          // Convert progress (seconds) to frame number using event's FPS
          if (event.Frames && event.Length) {
            const frameFromProgress = Math.round((status.progress / event.Length) * event.Frames);
            setCurrentFrame(Math.max(1, Math.min(frameFromProgress, event.Frames)));
          }
          // Sync playing state
          if (status.paused === isStreaming) {
            setIsStreaming(!status.paused);
          }
        }
      } catch (err) {
        pollErrors++;
        // Stop polling if too many errors
        if (pollErrors >= MAX_POLL_ERRORS) {
          return;
        }
      }
      // Schedule next poll (recursive pattern)
      if (pollErrors < MAX_POLL_ERRORS) {
        timeoutId = setTimeout(pollStatus, 2000);
      }
    };
    
    // Start polling after initial delay
    timeoutId = setTimeout(pollStatus, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [token, connkey, isStreaming, event]);

  const formatDuration = (length: number): string => {
    const minutes = Math.floor(length / 60);
    const seconds = Math.floor(length % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const handlePlayPause = async () => {
    if (!token || !event) return;
    
    if (!isStreaming) {
      // Resume paused stream
      try {
        await eventService.controlStream(event.Id, connkey, 'resume', token);
        setIsStreaming(true);
      } catch (err) {
        console.error('Failed to resume stream:', err);
      }
    } else {
      // Pause playing stream
      try {
        await eventService.controlStream(event.Id, connkey, 'pause', token);
        setIsStreaming(false);
      } catch (err) {
        console.error('Failed to pause stream:', err);
      }
    }
  };

  const openVideo = () => {
    // Blur active element before opening external window
    (document.activeElement as HTMLElement)?.blur();
    if (event && token) {
      window.open(eventService.getEventVideoUrl(event.Id, token), '_blank');
    }
  };

  // Get the stream URL with current playback settings
  const getStreamUrl = useCallback(async () => {
    if (!event || !token) return '';
    return await eventService.getEventStreamUrl(event.Id, token, {
      rate: playbackSpeed,
      frame: currentFrame,
      scale: 100,
      maxfps: 30,
      replay: 'none',
      connkey: connkey || undefined,
    });
  }, [event, token, playbackSpeed, currentFrame, connkey]);

  // Playback controls
  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    // Use CMD_VARPLAY to change speed without reloading stream
    if (token && connkey > 0) {
      try {
        await eventService.setPlaybackRate(connkey, speed, token);
      } catch (err) {
        console.error('Failed to change playback rate:', err);
      }
    }
  };

  const handleFrameChange = async (frame: number) => {
    setCurrentFrame(frame);
    // Use CMD_SEEK with offset (time in seconds) instead of frame number
    if (token && connkey > 0 && event && event.Frames && event.Length) {
      try {
        // Convert frame number to time offset
        const offset = (frame / event.Frames) * event.Length;
        await eventService.seekToOffset(connkey, offset, token);
      } catch (err) {
        console.error('Failed to seek to offset:', err);
      }
    }
  };

  const stepForward = async () => {
    if (!token || connkey === 0 || !event) return;
    try {
      await eventService.controlStream(event.Id, connkey, 'stepForward', token);
      setCurrentFrame(prev => Math.min(prev + 1, event?.Frames || prev));
    } catch (err) {
      console.error('Failed to step forward:', err);
    }
  };

  const stepBackward = async () => {
    if (!token || connkey === 0 || !event) return;
    try {
      await eventService.controlStream(event.Id, connkey, 'stepBack', token);
      setCurrentFrame(prev => Math.max(prev - 1, 1));
    } catch (err) {
      console.error('Failed to step backward:', err);
    }
  };

  const jumpToFrame = (frame: number) => {
    if (event && frame >= 1 && frame <= event.Frames) {
      setCurrentFrame(frame);
      setStreamKey(prev => prev + 1);
    }
  };

  // Handle back navigation with focus management
  const handleBack = () => {
    (document.activeElement as HTMLElement)?.blur();
    history.goBack();
  };

  if (isLoading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={handleBack}>
                <IonIcon slot="icon-only" icon={arrowBackOutline} />
              </IonButton>
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
              <IonButton onClick={handleBack}>
                <IonIcon slot="icon-only" icon={arrowBackOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle>Event Details</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="error-container">
            <IonText color="danger">
              <p>{error || 'Event not found'}</p>
            </IonText>
            <IonButton onClick={handleBack}>Go Back</IonButton>
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
            <IonButton onClick={handleBack}>
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Event {event.Id}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="event-viewer">
          {token && (
            <img
              key={streamKey}
              src={streamUrl || ''}
              alt={`Event ${event.Id}`}
              className="event-image"
            />
          )}
          
          {/* Playback Controls */}
          <div className="playback-controls">
            <div className="control-row">
              <IonButton 
                fill="clear" 
                onClick={stepBackward}
                disabled={currentFrame <= 1}
                title="Step Backward"
              >
                <IonIcon slot="icon-only" icon={playBackOutline} />
              </IonButton>
              
              <IonButton 
                onClick={handlePlayPause}
                title={isStreaming ? 'Pause' : 'Play'}
              >
                <IonIcon slot="icon-only" icon={isStreaming ? pauseOutline : playOutline} />
              </IonButton>
              
              <IonButton 
                fill="clear" 
                onClick={stepForward}
                disabled={event && currentFrame >= event.Frames}
                title="Step Forward"
              >
                <IonIcon slot="icon-only" icon={playForwardOutline} />
              </IonButton>
            </div>

            {/* Frame Progress Bar with Alarm Indicators */}
            {event && (
              <div className="frame-progress">
                <IonLabel>Frame: {currentFrame} / {event.Frames}</IonLabel>
                <div className="slider-container">
                  {/* Alarm frame indicators */}
                  <div className="alarm-markers">
                    {alarmFrames.map((frameId) => (
                      <div
                        key={frameId}
                        className="alarm-marker"
                        style={{ left: `${((frameId - 1) / (event.Frames - 1)) * 100}%` }}
                        title={`Alarm frame ${frameId}`}
                      />
                    ))}
                  </div>
                  <IonRange
                    min={1}
                    max={event.Frames}
                    value={currentFrame}
                    onIonChange={(e) => handleFrameChange(e.detail.value as number)}
                    color="primary"
                  />
                </div>
              </div>
            )}

            {/* Speed Selector */}
            <div className="speed-selector">
              <IonLabel>Speed:</IonLabel>
              <div className="speed-buttons">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <IonButton
                    key={speed.value}
                    size="small"
                    fill={playbackSpeed === speed.value ? 'solid' : 'outline'}
                    onClick={() => handleSpeedChange(speed.value)}
                  >
                    {speed.label}
                  </IonButton>
                ))}
              </div>
            </div>
          </div>

          <div className="viewer-actions">
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