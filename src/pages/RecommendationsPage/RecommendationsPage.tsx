import { Page, PremiumGate } from '~/components';

/**
 * Placeholder premium surface (PROD-103 demo). The real AI recommendations
 * feature ships later; for now this gives PremiumGate something real to wrap so
 * the gate -> paywall flow is testable end to end.
 */
export const RecommendationsPage = () => {
  return (
    <PremiumGate featureName="AI Recommendations">
      <Page title="AI Recommendations">
        <p className="text-sm text-muted-foreground">
          Personalized session recommendations are coming soon. As a Premium
          member you'll get AI-tuned workouts based on your training history.
        </p>
      </Page>
    </PremiumGate>
  );
};
