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
import { monitorService } from '../services';
import { Monitor } from '../types';
import './Monitors.css';

const Monitors: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const history = useHistory();

  const fetchMonitors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get the token from localStorage (dev mode) or use the token from monitorService
      // The token is already added as a query parameter by the API interceptor
      // So we just need to fetch monitors - the token will be included automatically
      
      // For the thumbnail URLs, we need the token
      // Use localStorage directly in development mode
      const storedValue = localStorage.getItem('zm_auth_tokens');
      if (storedValue) {
        const tokens = JSON.parse(storedValue);
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

  // Generate thumbnail URL with low FPS (1 frame per second)
  const getThumbnailUrl = (monitorId: number) => {
    // ZoneMinder image path: /zm/cgi-bin/zms?mode=jpeg&monitor=<id>&token=<token>
    // For low FPS, we can use the nph-zms endpoint with scale parameter
    return `http://192.168.1.60/zm/cgi-bin/zms?mode=jpeg&monitor=${monitorId}&scale=50&token=${token}`;
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
                      {token ? (
                        <img 
                          src={getThumbnailUrl(monitor.Id)} 
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