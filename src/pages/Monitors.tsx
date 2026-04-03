import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonBadge,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/react';
import { refreshOutline, videocamOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { monitorService, tokenStorage } from '../services';
import { Monitor } from '../types';
import './Monitors.css';

const Monitors: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const history = useHistory();

  const fetchMonitors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get the token using tokenStorage (handles both native and web platforms)
      const tokens = await tokenStorage.getTokens();
      
      if (tokens?.access_token) {
        setToken(tokens.access_token);
      }
      
      // Fetch monitors - token is added automatically by API interceptor
      const data = await monitorService.getMonitors();
      setMonitors(data);
    } catch (err: unknown) {
      console.error('Failed to fetch monitors:', err);
      setError(err instanceof Error ? err.message : 'Failed to load monitors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  // Fetch thumbnail image as blob using CapacitorHttp-patched fetch
  // This bypasses Mixed Content restrictions for HTTP images on native
  // On web, uses Vite proxy to avoid CORS
  const fetchThumbnail = async (monitorId: number, authToken: string) => {
    try {
      // Use platform-aware URL:
      // - Native: absolute URL (CapacitorHttp patches fetch to bypass Mixed Content)
      // - Web: relative URL (Vite proxy handles CORS)
      const baseUrl = Capacitor.isNativePlatform()
        ? 'http://192.168.1.60'
        : '';
      
      // mode=single returns a single JPEG frame instead of MJPEG stream
      const url = `${baseUrl}/zm/cgi-bin/nph-zms?mode=single&monitor=${monitorId}&scale=50&token=${authToken}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setImageUrls(prev => ({ ...prev, [monitorId]: objectUrl }));
    } catch (err) {
      console.error(`Failed to load thumbnail for monitor ${monitorId}:`, err);
    }
  };

  // Fetch thumbnails when monitors and token are available
  useEffect(() => {
    if (token && monitors.length > 0) {
      monitors.forEach(m => fetchThumbnail(m.Id, token));
    }
    
    // Cleanup: revoke object URLs when component unmounts
    return () => {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [token, monitors]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'connected':
        return 'success';
      case 'idle':
        return 'warning';
      case 'error':
      case 'failed':
        return 'danger';
      default:
        return 'medium';
    }
  };

  const handleMonitorClick = (monitorId: number) => {
    history.push(`/monitors/${monitorId}`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Monitors</IonTitle>
          <IonButton slot="end" fill="clear" onClick={fetchMonitors} disabled={isLoading}>
            <IonIcon slot="icon-only" icon={refreshOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {isLoading ? (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <IonText>
              <p>Loading monitors...</p>
            </IonText>
          </div>
        ) : error ? (
          <div className="error-container">
            <IonText color="danger">
              <p>{error}</p>
            </IonText>
            <IonButton onClick={fetchMonitors}>Retry</IonButton>
          </div>
        ) : monitors.length === 0 ? (
          <div className="empty-container">
            <IonIcon icon={videocamOutline} style={{ fontSize: '48px', color: 'var(--ion-color-medium)' }} />
            <IonText color="medium">
              <p>No monitors found</p>
            </IonText>
          </div>
        ) : (
          <IonGrid>
            <IonRow>
              {monitors.map((monitor) => (
                <IonCol size="12" size-md="6" size-lg="4" key={monitor.Id}>
                  <div 
                    className="monitor-thumbnail" 
                    onClick={() => handleMonitorClick(monitor.Id)}
                  >
                    <div className="thumbnail-image-container">
                      {imageUrls[monitor.Id] ? (
                        <img 
                          src={imageUrls[monitor.Id]} 
                          alt={monitor.Name}
                          className="thumbnail-image"
                        />
                      ) : (
                        <div className="thumbnail-placeholder">
                          <IonIcon icon={videocamOutline} />
                        </div>
                      )}
                    </div>
                    <div className="thumbnail-info">
                      <div className="thumbnail-name">{monitor.Name}</div>
                      <IonBadge color={getStatusColor(monitor.Status)}>
                        {monitor.Status || 'Unknown'}
                      </IonBadge>
                    </div>
                  </div>
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Monitors;