/**
 * Theme toggle component for switching between light, dark, and system themes
 */
import React from 'react';
import { IonButton, IonIcon, IonPopover, IonList, IonItem, IonLabel, IonRadio, IonRadioGroup } from '@ionic/react';
import { sunnyOutline, moonOutline, phonePortraitOutline, contrastOutline } from 'ionicons/icons';
import { useTheme } from '../contexts';

type ThemeMode = 'light' | 'dark' | 'system';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme();
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const getIcon = () => {
    if (theme === 'system') {
      return contrastOutline;
    }
    return isDark ? moonOutline : sunnyOutline;
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setPopoverOpen(false);
  };

  return (
    <>
      <IonButton
        fill="clear"
        onClick={(e) => {
          e.persist();
          setPopoverOpen(true);
        }}
      >
        <IonIcon slot="icon-only" icon={getIcon()} />
      </IonButton>
      <IonPopover
        isOpen={popoverOpen}
        onDidDismiss={() => setPopoverOpen(false)}
        className="theme-popover"
      >
        <IonList>
          <IonRadioGroup value={theme} onIonChange={(e) => handleThemeChange(e.detail.value)}>
            <IonItem>
              <IonIcon icon={sunnyOutline} slot="start" />
              <IonLabel>Light</IonLabel>
              <IonRadio slot="end" value="light" />
            </IonItem>
            <IonItem>
              <IonIcon icon={moonOutline} slot="start" />
              <IonLabel>Dark</IonLabel>
              <IonRadio slot="end" value="dark" />
            </IonItem>
            <IonItem>
              <IonIcon icon={phonePortraitOutline} slot="start" />
              <IonLabel>System</IonLabel>
              <IonRadio slot="end" value="system" />
            </IonItem>
          </IonRadioGroup>
        </IonList>
      </IonPopover>
    </>
  );
};

export default ThemeToggle;