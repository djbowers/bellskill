import { useNavigate } from 'react-router-dom';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { ExampleRecommendation } from '~/examples';

import { RecommendationCard } from './RecommendationCard';

const PREVIEW = new ExampleRecommendation();

interface RecommendationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown to free users who tap "Recommend my next session": a real-looking
 * example of what a recommendation delivers, plus an upgrade CTA. The function
 * is never called for free users — gating is enforced both here and server-side.
 */
export const RecommendationPreviewDialog = ({
  open,
  onOpenChange,
}: RecommendationPreviewDialogProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI session recommendations</DialogTitle>
          <DialogDescription>
            Premium reads your history, goal, and how you feel today, then
            programs a session like this. Tap Accept and start lifting.
          </DialogDescription>
        </DialogHeader>

        <RecommendationCard recommendation={PREVIEW} />

        <DialogFooter>
          <Button className="w-full" onClick={() => navigate('/paywall')}>
            See what&apos;s included
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
