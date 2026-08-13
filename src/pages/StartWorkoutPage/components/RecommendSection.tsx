import { SparklesIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

import {
  AnalyticsEvent,
  RecommendProgramError,
  RecommendSessionError,
  trackEvent,
  useRecommendProgram,
  useRecommendSession,
} from '~/api';
import { ProgramRecommendationPreviewDialog } from '~/components';
import { Button } from '~/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useEntitlement } from '~/contexts';
import type {
  Program,
  Recommendation,
  RecommendProgramResponse,
  RecommendSessionResponse,
} from '~/types';

import { RecommendationCard } from './RecommendationCard';
import { RecommendationPreviewDialog } from './RecommendationPreviewDialog';

type RecommendScope = 'session' | 'program';

export interface RecommendSectionProps {
  /** Loads the accepted session recommendation into the builder. `id` enables analytics attribution. */
  onAcceptSession: (recommendation: Recommendation, recommendationId: string) => void;
  /** Authenticated user id, for analytics (fire-and-forget). */
  userId?: string;
  /** Whether the program scope is offered at all (programs feature on). */
  showPrograms: boolean;
  /** The full program list, for resolving a recommended id to a card. */
  programs: Program[];
  /** True when every parallel slot is taken — degrades "start now" to queue. */
  slotsFull: boolean;
  /** Start the recommended program now (claims a free slot). */
  onEnrollNow: (programId: string) => void;
  /** Queue the recommended program to start when a slot frees up. */
  onQueue: (programId: string) => void;
}

/**
 * The hub's unified AI recommender: one tinted surface that recommends either
 * the next session or the next program. Premium users fetch and review a
 * recommendation; free users see a preview modal with an upgrade CTA — the
 * functions are never called for them. Results are held per scope so toggling
 * never discards a fetched recommendation.
 */
export const RecommendSection = ({
  onAcceptSession,
  userId,
  showPrograms,
  programs,
  slotsFull,
  onEnrollNow,
  onQueue,
}: RecommendSectionProps) => {
  const { effectiveAccess, isLoading: entitlementLoading } = useEntitlement();
  const isPremium = !entitlementLoading && effectiveAccess === 'premium';

  const [scope, setScope] = useState<RecommendScope>('session');

  const sessionMutation = useRecommendSession();
  const programMutation = useRecommendProgram();
  const [sessionResult, setSessionResult] =
    useState<RecommendSessionResponse | null>(null);
  const [programResult, setProgramResult] =
    useState<RecommendProgramResponse | null>(null);
  const [sessionPreviewOpen, setSessionPreviewOpen] = useState(false);
  const [programPreviewOpen, setProgramPreviewOpen] = useState(false);

  const track = (
    event: AnalyticsEvent,
    properties: Record<string, string | number | boolean | null> = {},
  ) => {
    if (userId) {
      void trackEvent({
        event,
        userId,
        properties: { surface: 'hub', ...properties },
      });
    }
  };

  const fetchSession = (event: AnalyticsEvent) => {
    track(event);
    sessionMutation.mutate(undefined, {
      onSuccess: (data) => setSessionResult(data),
      onError: (err) => {
        // A stale free-tier client could still get gated server-side; fall back
        // to the preview rather than showing a raw error.
        if (
          err instanceof RecommendSessionError &&
          err.code === 'premium_required'
        ) {
          setSessionResult(null);
          setSessionPreviewOpen(true);
        }
      },
    });
  };

  const fetchProgram = () => {
    track(AnalyticsEvent.ProgramRecommendationRequested);
    programMutation.mutate(undefined, {
      onSuccess: (data) => setProgramResult(data),
      onError: (err) => {
        if (
          err instanceof RecommendProgramError &&
          err.code === 'premium_required'
        ) {
          setProgramResult(null);
          setProgramPreviewOpen(true);
        }
      },
    });
  };

  const handleRecommendSession = () => {
    if (!isPremium) {
      track(AnalyticsEvent.RecommendationPreviewShown);
      setSessionPreviewOpen(true);
      return;
    }
    fetchSession(AnalyticsEvent.RecommendationRequested);
  };

  const handleRecommendProgram = () => {
    if (!isPremium) {
      track(AnalyticsEvent.RecommendationPreviewShown);
      setProgramPreviewOpen(true);
      return;
    }
    fetchProgram();
  };

  const handleAcceptSession = () => {
    if (!sessionResult) return;
    track(AnalyticsEvent.RecommendationAccepted, {
      movement_count: sessionResult.recommendation.blocks.length,
    });
    onAcceptSession(sessionResult.recommendation, sessionResult.id);
    setSessionResult(null);
    sessionMutation.reset();
  };

  const programRecommendation = programResult?.recommendation ?? null;
  const recommendedProgram = programRecommendation
    ? (programs.find((p) => p.id === programRecommendation.program_id) ?? null)
    : null;

  // The server decided the mode against a snapshot; if every slot has since
  // filled up, starting now is no longer possible, so fall back to queueing.
  const effectiveProgramMode =
    programRecommendation?.mode === 'concurrent' && slotsFull
      ? 'queue'
      : programRecommendation?.mode;

  const handleAcceptProgram = () => {
    if (!programRecommendation) return;
    track(AnalyticsEvent.ProgramRecommendationAccepted, {
      program_id: programRecommendation.program_id,
      mode: effectiveProgramMode ?? programRecommendation.mode,
    });
    if (effectiveProgramMode === 'queue') onQueue(programRecommendation.program_id);
    else onEnrollNow(programRecommendation.program_id);
    setProgramResult(null);
    programMutation.reset();
  };

  const handleDismissProgram = () => {
    if (programRecommendation) {
      track(AnalyticsEvent.ProgramRecommendationDismissed, {
        program_id: programRecommendation.program_id,
      });
    }
    setProgramResult(null);
    programMutation.reset();
  };

  const sessionError = (() => {
    if (!sessionMutation.isError) return null;
    const err = sessionMutation.error;
    if (err instanceof RecommendSessionError) {
      if (err.code === 'premium_required') return null; // shown via preview
      if (err.code === 'no_movements') {
        return 'Add a few movements to your library first, then try again.';
      }
      if (err.code === 'recommendation_failed') {
        return "Couldn't build a session right now — try again.";
      }
    }
    return 'Something went wrong — try again.';
  })();

  const programError = (() => {
    if (!programMutation.isError) return null;
    const err = programMutation.error;
    if (err instanceof RecommendProgramError) {
      if (err.code === 'premium_required') return null; // shown via preview
      if (err.code === 'no_candidates') {
        return "You're already running or have queued every program we'd suggest.";
      }
      if (err.code === 'recommendation_failed') {
        return "Couldn't pick a program right now — try again.";
      }
    }
    return 'Something went wrong — try again.';
  })();

  return (
    <section
      aria-label="AI recommendation"
      className="flex flex-col gap-1 rounded-md border border-primary/30 bg-primary/5 p-2"
    >
      <div className="flex items-center gap-1">
        <SparklesIcon className="h-2.5 w-2.5 shrink-0 text-primary" />
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recommended for you
        </h2>
        {showPrograms && (
          <Tabs
            className="ml-auto"
            value={scope}
            onValueChange={(value) => setScope(value as RecommendScope)}
          >
            <TabsList className="h-auto">
              <TabsTrigger className="px-1 py-0.5 text-xs" value="session">
                Session
              </TabsTrigger>
              <TabsTrigger className="px-1 py-0.5 text-xs" value="program">
                Program
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {scope === 'session' && (
        <>
          {sessionResult ? (
            <RecommendationCard
              recommendation={sessionResult.recommendation}
              footer={
                <Button className="flex-1" onClick={handleAcceptSession}>
                  Accept
                </Button>
              }
            />
          ) : (
            <Button
              className="w-full"
              variant="secondary"
              loading={sessionMutation.isPending}
              onClick={handleRecommendSession}
            >
              <SparklesIcon className="mr-1 h-2.5 w-2.5" />
              Recommend my next session
            </Button>
          )}
          {sessionError && (
            <p className="text-center text-xs text-destructive">
              {sessionError}
            </p>
          )}
        </>
      )}

      {scope === 'program' && (
        <>
          {programRecommendation ? (
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-2">
              <div className="flex items-baseline justify-between gap-1">
                <h3 className="text-sm font-semibold">
                  {recommendedProgram?.title ?? 'Recommended program'}
                </h3>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {effectiveProgramMode === 'queue'
                    ? 'Queue for later'
                    : 'Start alongside'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {programRecommendation.rationale}
              </p>
              <div className="flex gap-1">
                <Button className="flex-1" onClick={handleAcceptProgram}>
                  {effectiveProgramMode === 'queue' ? 'Add to queue' : 'Start now'}
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  loading={programMutation.isPending}
                  onClick={fetchProgram}
                >
                  Try another
                </Button>
                <Button variant="ghost" onClick={handleDismissProgram}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              variant="secondary"
              loading={programMutation.isPending}
              onClick={handleRecommendProgram}
            >
              <SparklesIcon className="mr-1 h-2.5 w-2.5" />
              Recommend a program
            </Button>
          )}
          {programError && (
            <p className="text-center text-xs text-destructive">
              {programError}
            </p>
          )}
        </>
      )}

      <RecommendationPreviewDialog
        open={sessionPreviewOpen}
        onOpenChange={setSessionPreviewOpen}
      />
      <ProgramRecommendationPreviewDialog
        open={programPreviewOpen}
        onOpenChange={setProgramPreviewOpen}
      />
    </section>
  );
};
