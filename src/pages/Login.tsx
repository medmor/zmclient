/**
 * Login page for ZoneMinder authentication
 */
import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
  IonList,
  IonAlert,
  IonIcon,
} from '@ionic/react';
import { eyeOutline, eyeOffOutline, serverOutline } from 'ionicons/icons';
import { useAuth } from '../contexts';
import './Login.css';

const Login: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!baseUrl || !username || !password) {
      return;
    }

    try {
      await login({ username, password }, baseUrl);
    } catch {
      setShowError(true);
    }
  };

  const isFormValid = baseUrl.trim() !== '' && 
    username.trim() !== '' && 
    password.trim() !== '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ZoneMinder Login</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="ion-padding">
        <div className="login-container">
          <div className="login-logo">
            <IonIcon icon={serverOutline} className="logo-icon" />
            <h1>ZoneMinder</h1>
            <p>Mobile Client</p>
          </div>

          <form onSubmit={handleSubmit}>
            <IonList className="login-form">
              <IonItem>
                <IonLabel position="stacked">Server URL</IonLabel>
                <IonInput
                  type="url"
                  placeholder="https://zm-server.example.com"
                  value={baseUrl}
                  onIonInput={(e) => setBaseUrl(e.detail.value || '')}
                  disabled={isLoading}
                  required
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Username</IonLabel>
                <IonInput
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onIonInput={(e) => setUsername(e.detail.value || '')}
                  disabled={isLoading}
                  autocomplete="username"
                  required
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Password</IonLabel>
                <IonInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value || '')}
                  disabled={isLoading}
                  autocomplete="current-password"
                  required
                />
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                </IonButton>
              </IonItem>
            </IonList>

            {error && (
              <IonText color="danger">
                <p className="error-message">{error}</p>
              </IonText>
            )}

            <IonButton
              expand="block"
              type="submit"
              disabled={!isFormValid || isLoading}
              className="login-button"
            >
              {isLoading ? (
                <>
                  <IonSpinner name="crescent" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </IonButton>
          </form>
        </div>

        <IonAlert
          isOpen={showError}
          onDidDismiss={() => setShowError(false)}
          header="Login Failed"
          message={error || 'Unable to connect to ZoneMinder server. Please check your credentials and server URL.'}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;