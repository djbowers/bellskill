import { ArrowUpTrayIcon } from '@heroicons/react/20/solid';
import { DevicePhoneMobileIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

import { useFeatures } from '~/hooks';
import { cn } from '~/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const features = useFeatures();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);

    const isMobileDevice =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    setIsMobile(isMobileDevice);

    const hasBeenDismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = hasBeenDismissed ? parseInt(hasBeenDismissed) : 0;
    const daysSinceDismissed =
      (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    if (
      isMobileDevice &&
      !isStandaloneMode &&
      (!hasBeenDismissed || daysSinceDismissed > 7)
    ) {
      setShowPrompt(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- native install-prompt handler wired to the captured beforeinstallprompt event; retained for the not-yet-surfaced Android/desktop install button
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowPrompt(false);
      }

      setDeferredPrompt(null);
    } else {
      // iOS Safari never fires beforeinstallprompt, so there's no native prompt
      showInstallInstructions();
    }
  };

  const showInstallInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let instructions = '';

    if (isIOS) {
      instructions = 'Tap the Share button and then "Add to Home Screen"';
    } else if (isAndroid) {
      instructions = 'Tap the menu (⋮) and select "Add to Home screen"';
    } else {
      instructions =
        'Look for "Add to Home Screen" or "Install App" in your browser menu';
    }

    alert(`To install this app:\n\n${instructions}`);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt || !isMobile || isStandalone) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed left-4 right-4 z-50 mx-auto max-w-sm',
        // Lift above the fixed bottom nav on mobile when it is enabled; the bar
        // is desktop-hidden, so restore the default offset at `sm`. 80px is the
        // 64px bar height plus ~16px of intentional breathing room above it, not
        // an off-by-one against the bar.
        features.bottomNav
          ? 'bottom-[calc(80px+env(safe-area-inset-bottom,0))] sm:bottom-4'
          : 'bottom-4',
      )}
    >
      <div className="relative rounded-lg border border-border bg-card p-3 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute right-1 top-1 p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-2.5 w-2.5" />
        </button>

        <div className="flex items-center space-x-3 pr-2.5">
          <div className="flex-shrink-0">
            <DevicePhoneMobileIcon className="h-2.5 w-2.5 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-card-foreground">
              Install BellSkill
            </p>
            <p className="inline text-xs text-muted-foreground">
              Tap the <ArrowUpTrayIcon className="inline h-2 w-2" /> share
              button below, then select &quot;Add to Home Screen&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
