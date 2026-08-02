import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

export interface CreateProgramFormProps {
  title: string;
  onTitleChange: (title: string) => void;
  onCreate: () => void;
  isPending: boolean;
}

export const CreateProgramForm = ({
  title,
  onTitleChange,
  onCreate,
  isPending,
}: CreateProgramFormProps) => (
  <Card>
    <CardContent className="flex flex-col gap-2 pt-2">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="program-title">Title</Label>
        <Input
          id="program-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Dry Fighting Weight"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Weeks and days per week are set by the sessions you add next.
      </p>
      <Button
        onClick={onCreate}
        disabled={title.trim().length === 0 || isPending}
      >
        {isPending ? 'Creating…' : 'Create and add sessions'}
      </Button>
    </CardContent>
  </Card>
);
