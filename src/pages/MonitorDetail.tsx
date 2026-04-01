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
  IonBadge,
} from '@ionic/react';
import { monitorService } from '../services';
import { Monitor } from '../types';
import './MonitorDetail.css';

const MonitorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    const fetchMonitor = async () => {
      try {
        setIsLoading(true);
        const monitors = await monitorService.getMonitors();
        const foundMonitor = monitors.find((m) => m.Id === parseInt(id, 10));
        
        if (!foundMonitor) {
          setError('Monitor not found');
          return;
        }
        
        setMonitor(foundMonitor);
        
        // Get the token from localStorage (dev mode)
        // Use the correct storage key 'zm_auth_tokens'
        const storedValue = localStorage.getItem('zm_auth_tokens');
        
        if (storedValue) {
          const tokens = JSON.parse(storedValue);
          setToken(tokens.access_token);
          
          // Create the live stream URL with token
          // ZoneMinder live stream: /zm/cgi-bin/zms?mode=jpeg&monitor=<id>&token=<token>
          const streamUrl = `http://192.168.1.60/zm/cgi-bin/zms?mode=jpeg&monitor=${id}&token=${tokens.access_token}`;
          setImageUrl(streamUrl);
        } else {
          setError('Not authenticated');
          history.push('/login');
        }
      } catch (err) {
        console.error('Failed to fetch monitor:', err);
        setError(err instanceof Error ? err.message : 'Failed to load monitor');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMonitor();
  }, [id, history]);

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

  if (isLoading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/monitors" />
            </IonButtons>
            <IonTitle>Loading...</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <IonText>
              <p>Loading monitor...</p>
            </IonText>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error || !monitor) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/monitors" />
            </IonButtons>
            <IonTitle>Error</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="error-container">
            <IonText color="danger">
              <p>{error || 'Monitor not found'}</p>
            </IonText>
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
            <IonBackButton defaultHref="/monitors" />
          </IonButtons>
          <IonTitle>{monitor.Name}</IonTitle>
          <IonBadge slot="end" color={getStatusColor(monitor.Status)} style={{ marginRight: '10px' }}>
            {monitor.Status || 'Unknown'}
          </IonBadge>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="monitor-detail-container">
          <div className="live-stream">
            {imageUrl && (
              <img 
                src={imageUrl} 
                alt={monitor.Name}
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain' 
                }}
              />
            )}
          </div>
          
          <div className="monitor-name">
            <h2>{monitor.Name}</h2>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MonitorDetail;