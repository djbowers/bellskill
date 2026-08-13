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
import { ExampleProgramRecommendation } from '~/examples';

const PREVIEW = new ExampleProgramRecommendation();

/**
 * Shown to free users who tap "Recommend a program": a real-looking example of
 * what a recommendation delivers, plus an upgrade CTA.
 */
export const ProgramRecommendationPreviewDialog = ({
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
