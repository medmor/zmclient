import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonMenu,
  IonMenuButton,
  IonButtons,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/react';
import { logOutOutline, cameraOutline, videocamOutline, settingsOutline } from 'ionicons/icons';
import { useAuth } from '../contexts';
import './Home.css';

const Home: React.FC = () => {
  const { logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <IonPage>
      <IonMenu contentId="main-content">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Menu</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            <IonItem button routerLink="/home" routerDirection="root">
              <IonIcon icon={cameraOutline} slot="start" />
              <IonLabel>Monitors</IonLabel>
            </IonItem>
            <IonItem button routerLink="/events" routerDirection="root">
              <IonIcon icon={videocamOutline} slot="start" />
              <IonLabel>Events</IonLabel>
            </IonItem>
            <IonItem button routerLink="/settings" routerDirection="root">
              <IonIcon icon={settingsOutline} slot="start" />
              <IonLabel>Settings</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonMenu>

      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>ZoneMinder</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleLogout} disabled={isLoading}>
              <IonIcon icon={logOutOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent id="main-content" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">ZoneMinder</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="home-container">
          <div className="welcome-section">
            <IonIcon icon={cameraOutline} className="welcome-icon" />
            <h2>Welcome to ZoneMinder</h2>
            <p>Monitor your surveillance cameras from anywhere.</p>
          </div>

          <div className="quick-actions">
            <IonButton expand="block" routerLink="/monitors">
              <IonIcon icon={cameraOutline} slot="start" />
              View Monitors
            </IonButton>
            <IonButton expand="block" routerLink="/events" color="secondary">
              <IonIcon icon={videocamOutline} slot="start" />
              View Events
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
