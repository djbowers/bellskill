import {
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from '@radix-ui/react-icons';
import { useState } from 'react';

import {
  useSpotifyConnection,
  useSpotifyControls,
  useSpotifyNowPlaying,
} from '~/api';

/**
 * Fixed-bottom remote control for the user's Spotify playback during a
 * workout. Music plays in the Spotify app, not here — this only shows the
 * current track and sends Connect commands. Renders nothing until the user
 * has linked Spotify; while connected it polls now-playing every 5s.
 */
export const SpotifyMiniPlayer = () => {
  const { data: connection } = useSpotifyConnection();
  const connected = connection?.connected ?? false;
  const { data: nowPlaying } = useSpotifyNowPlaying(connected);
  const { mutate: control } = useSpotifyControls();
  const [premiumRequired, setPremiumRequired] = useState(false);

  if (!connected || !nowPlaying || nowPlaying.connected === false) return null;

  const handleControl = (action: 'play' | 'pause' | 'next' | 'previous') => {
    control(action, {
      onSuccess: (result) => {
        if (result.error === 'premium_required') setPremiumRequired(true);
      },
    });
  };

  const containerClasses =
    'fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-background px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]';

  if (nowPlaying.noActiveDevice || !nowPlaying.track) {
    return (
      <Docked className={containerClasses}>
        <a
          href="https://open.spotify.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <SpotifyGlyph />
          Open Spotify to start music
        </a>
      </Docked>
    );
  }

  const { track, isPlaying } = nowPlaying;

  return (
    <Docked className={containerClasses}>
      <div className="flex items-center gap-2">
        {track.albumArtUrl ? (
          <img
            src={track.albumArtUrl}
            alt=""
            className="h-4 w-4 rounded object-cover"
          />
        ) : (
          <SpotifyGlyph />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{track.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {track.artists}
            {premiumRequired && ' · controls need Spotify Premium'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous track"
            onClick={() => handleControl('previous')}
            className="p-1 text-foreground disabled:opacity-40"
            disabled={premiumRequired}
          >
            <TrackPreviousIcon className="h-2 w-2" />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={() => handleControl(isPlaying ? 'pause' : 'play')}
            className="rounded-full bg-primary p-1.5 text-primary-foreground disabled:opacity-40"
            disabled={premiumRequired}
          >
            {isPlaying ? (
              <PauseIcon className="h-2 w-2" />
            ) : (
              <PlayIcon className="h-2 w-2" />
            )}
          </button>
          <button
            type="button"
            aria-label="Next track"
            onClick={() => handleControl('next')}
            className="p-1 text-foreground disabled:opacity-40"
            disabled={premiumRequired}
          >
            <TrackNextIcon className="h-2 w-2" />
          </button>
        </div>
      </div>
    </Docked>
  );
};

/**
 * Fixed-bottom bar plus an in-flow spacer of matching height so page content
 * (the finish controls) is never hidden behind it.
 */
const Docked = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) => (
  <>
    <div aria-hidden className="h-6" />
    <div className={className}>{children}</div>
  </>
);

const SpotifyGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 shrink-0 fill-[#1DB954]"
    aria-hidden="true"
  >
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.57-1.05 8.5-.6 11.66 1.34.35.22.46.68.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.54-1.8c4.36-1.32 9.78-.68 13.49 1.6.44.27.58.85.31 1.29zm.13-3.4C15.24 8.33 8.87 8.12 5.17 9.24a1.13 1.13 0 1 1-.65-2.16c4.24-1.28 11.28-1.03 15.72 1.6a1.13 1.13 0 0 1-1.14 1.94z" />
  </svg>
);
