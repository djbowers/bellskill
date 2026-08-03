import { SparklesIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AnalyticsEvent,
  RecommendProgramError,
  trackEvent,
  useRecommendProgram,
} from '~/api';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useEntitlement } from '~/contexts';
import { ExampleProgramRecommendation } from '~/examples';
import type { Program, RecommendProgramResponse } from '~/types';

const PREVIEW = new ExampleProgramRecommendation();

interface RecommendProgramSectionProps {
  /** The full program list, for resolving the recommended id to a card. */
  programs: Program[];
  /** True when every parallel slot is taken — degrades "start now" to queue. */
  slotsFull: boolean;
  /** Start the program now (claims a slot; the page owns replace routing). */
  onEnrollNow: (programId: string) => void;
  /** Queue the program to start when a slot frees up. */
  onQueue: (programId: string) => void;
  /** Authenticated user id, for analytics (fire-and-forget). */
  userId?: string;
}

/**
 * "Recommend a program" entry point. Premium users get an AI pick from the
 * shared catalog — one program, plus whether to run it alongside the current
 * stack or queue it. Free users see a preview with an upgrade CTA — the
 * function is never called for them.
 */
export const RecommendProgramSection = ({
  programs,
  slotsFull,
  onEnrollNow,
  onQueue,
  userId,
}: RecommendProgramSectionProps) => {
  const { effectiveAccess, isLoading: entitlementLoading } = useEntitlement();
  const isPremium = !entitlementLoading && effectiveAccess === 'premium';

  const mutation = useRecommendProgram();
  const [result, setResult] = useState<RecommendProgramResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const track = (event: AnalyticsEvent, properties = {}) => {
    if (userId) void trackEvent({ event, userId, properties });
  };

  const fetchRecommendation = () => {
    track(AnalyticsEvent.ProgramRecommendationRequested);
    mutation.mutate(undefined, {
      onSuccess: (data) => setResult(data),
      onError: (err) => {
        // A stale free-tier client could still get gated server-side; fall back
        // to the preview rather than showing a raw error.
        if (
          err instanceof RecommendProgramError &&
          err.code === 'premium_required'
        ) {
          setResult(null);
          setPreviewOpen(true);
        }
      },
    });
  };

  const handleRecommend = () => {
    if (!isPremium) {
      track(AnalyticsEvent.RecommendationPreviewShown, {
        surface: 'programs',
      });
      setPreviewOpen(true);
      return;
    }
    fetchRecommendation();
  };

  const recommendation = result?.recommendation ?? null;
  const recommendedProgram = recommendation
    ? (programs.find((p) => p.id === recommendation.program_id) ?? null)
    : null;

  // The server decided the mode against a snapshot; if every slot has since
  // filled up, starting now is no longer possible, so fall back to queueing.
  const effectiveMode =
    recommendation?.mode === 'concurrent' && slotsFull
      ? 'queue'
      : recommendation?.mode;

  const handleAccept = () => {
    if (!recommendation) return;
    track(AnalyticsEvent.ProgramRecommendationAccepted, {
      program_id: recommendation.program_id,
      mode: effectiveMode ?? recommendation.mode,
    });
    if (effectiveMode === 'queue') onQueue(recommendation.program_id);
    else onEnrollNow(recommendation.program_id);
    setResult(null);
    mutation.reset();
  };

  const handleDismiss = () => {
    if (recommendation) {
      track(AnalyticsEvent.ProgramRecommendationDismissed, {
        program_id: recommendation.program_id,
      });
    }
    setResult(null);
    mutation.reset();
  };

  const errorMessage = (() => {
    if (!mutation.isError) return null;
    const err = mutation.error;
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
    <section aria-label="AI program recommendation" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recommended for you
      </h2>

      {recommendation ? (
        <div className="flex flex-col gap-2 rounded-lg border p-2">
          <div className="flex items-baseline justify-between gap-1">
            <h3 className="text-sm font-semibold">
              {recommendedProgram?.title ?? 'Recommended program'}
            </h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {effectiveMode === 'queue'
                ? 'Queue for later'
                : 'Start alongside'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {recommendation.rationale}
          </p>
          <div className="flex gap-1">
            <Button className="flex-1" onClick={handleAccept}>
              {effectiveMode === 'queue' ? 'Add to queue' : 'Start now'}
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              loading={mutation.isPending}
              onClick={fetchRecommendation}
            >
              Try another
            </Button>
            <Button variant="ghost" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="w-full"
          variant="secondary"
          loading={mutation.isPending}
          onClick={handleRecommend}
        >
          <SparklesIcon className="mr-1 h-2.5 w-2.5" />
          Recommend a program
        </Button>
      )}

      {errorMessage && (
        <p className="text-center text-xs text-destructive">{errorMessage}</p>
      )}

      <ProgramRecommendationPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </section>
  );
};

/**
 * Shown to free users who tap "Recommend a program": a real-looking example of
 * what a recommendation delivers, plus an upgrade CTA.
 */
const ProgramRecommendationPreviewDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI program recommendations</DialogTitle>
          <DialogDescription>
            Premium reads your training history, movement-pattern balance, and
            current programs, then picks your next program — like this:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 rounded-lg border p-2">
          <div className="flex items-baseline justify-between gap-1">
            <h3 className="text-sm font-semibold">Easy Strength</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              Queue for later
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{PREVIEW.rationale}</p>
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={() => navigate('/paywall')}>
            See what&apos;s included
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
