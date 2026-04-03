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
import { Capacitor } from '@capacitor/core';
import { monitorService } from '../services';
import { tokenStorage } from '../services/api';
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
    let streamInterval: NodeJS.Timeout | null = null;
    let objectUrlToRevoke: string | null = null;

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
        
        // Get the token using tokenStorage (works on both web and native platforms)
        const tokens = await tokenStorage.getTokens();
        
        if (tokens && tokens.access_token) {
          setToken(tokens.access_token);
          
          // Get baseUrl from tokenStorage instead of hardcoding
          const baseUrl = await tokenStorage.getBaseUrl();
          
          if (Capacitor.isNativePlatform()) {
            if (!baseUrl) {
              console.error('No base URL configured for monitor stream');
              setError('Server URL not configured');
              return;
            }
            
            // On native platforms, fetch frames periodically using fetch()
            const fetchFrame = async () => {
              try {
                // Use mode=single to get a single JPEG frame
                const url = `${baseUrl}/zm/cgi-bin/nph-zms?mode=single&monitor=${id}&token=${tokens.access_token}`;
                const response = await fetch(url);
                if (response.ok) {
                  const blob = await response.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  
                  // Revoke previous URL to avoid memory leaks
                  if (objectUrlToRevoke) {
                    URL.revokeObjectURL(objectUrlToRevoke);
                  }
                  objectUrlToRevoke = objectUrl;
                  setImageUrl(objectUrl);
                }
              } catch (err) {
                console.error('Failed to fetch stream frame:', err);
              }
            };

            // Fetch initial frame
            await fetchFrame();
            setIsLoading(false);
            
            // Poll for new frames every 1 second for live stream effect
            streamInterval = setInterval(fetchFrame, 1000);
          } else {
            // On web, use direct MJPEG stream URL
            const streamUrl = baseUrl 
              ? `${baseUrl}/zm/cgi-bin/zms?mode=jpeg&monitor=${id}&token=${tokens.access_token}`
              : `/zm/cgi-bin/zms?mode=jpeg&monitor=${id}&token=${tokens.access_token}`;
            setImageUrl(streamUrl);
          }
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

    // Cleanup: revoke object URL and clear interval
    return () => {
      if (streamInterval) {
        clearInterval(streamInterval);
      }
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
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