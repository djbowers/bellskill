import { SparklesIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

import {
  AnalyticsEvent,
  RecommendSessionError,
  trackEvent,
  useRecommendSession,
} from '~/api';
import { Button } from '~/components/ui/button';
import { useEntitlement } from '~/contexts';
import type { Recommendation, RecommendSessionResponse } from '~/types';

import { RecommendationCard } from './RecommendationCard';
import { RecommendationPreviewDialog } from './RecommendationPreviewDialog';

interface RecommendSessionSectionProps {
  /** Loads the accepted recommendation into the builder. `id` enables analytics attribution. */
  onAccept: (recommendation: Recommendation, recommendationId: string) => void;
  /** Authenticated user id, for analytics (fire-and-forget). */
  userId?: string;
}

/**
 * "Recommend my next session" entry point. Premium users fetch and review a
 * recommendation (Accept pre-populates the form); free users see a preview
 * modal with an upgrade CTA — the function is never called for them.
 */
export const RecommendSessionSection = ({
  onAccept,
  userId,
}: RecommendSessionSectionProps) => {
  const { effectiveAccess, isLoading: entitlementLoading } = useEntitlement();
  const isPremium = !entitlementLoading && effectiveAccess === 'premium';

  const mutation = useRecommendSession();
  const [result, setResult] = useState<RecommendSessionResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const track = (event: AnalyticsEvent, properties = {}) => {
    if (userId) void trackEvent({ event, userId, properties });
  };

  const handleRecommend = () => {
    if (!isPremium) {
      track(AnalyticsEvent.RecommendationPreviewShown);
      setPreviewOpen(true);
      return;
    }
    track(AnalyticsEvent.RecommendationRequested);
    mutation.mutate(undefined, {
      onSuccess: (data) => setResult(data),
      onError: (err) => {
        // A stale free-tier client could still get gated server-side; fall back
        // to the preview rather than showing a raw error.
        if (
          err instanceof RecommendSessionError &&
          err.code === 'premium_required'
        ) {
          setResult(null);
          setPreviewOpen(true);
        }
      },
    });
  };

  const handleAccept = () => {
    if (!result) return;
    track(AnalyticsEvent.RecommendationAccepted, {
      movement_count: result.recommendation.blocks.length,
    });
    onAccept(result.recommendation, result.id);
    setResult(null);
    mutation.reset();
  };

  const errorMessage = (() => {
    if (!mutation.isError) return null;
    const err = mutation.error;
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

  return (
    <section aria-label="AI recommendation" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recommended for you
      </h2>
      {result ? (
        <RecommendationCard
          recommendation={result.recommendation}
          footer={
            <Button className="flex-1" onClick={handleAccept}>
              Accept
            </Button>
          }
        />
      ) : (
        <Button
          className="w-full"
          variant="secondary"
          loading={mutation.isPending}
          onClick={handleRecommend}
        >
          <SparklesIcon className="mr-1 h-2.5 w-2.5" />
          Recommend my next session
        </Button>
      )}

      {errorMessage && (
        <p className="text-center text-xs text-destructive">{errorMessage}</p>
      )}

      <RecommendationPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </section>
  );
};
