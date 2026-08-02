import { PROGRAM_FOCUS_TAGS, ProgramFocusTag } from '~/types';

const TAG_LABELS: Record<ProgramFocusTag, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  power: 'Power',
  conditioning: 'Conditioning',
  endurance: 'Endurance',
  skill: 'Skill',
  mobility: 'Mobility',
};

interface Props {
  tags: ProgramFocusTag[];
  className?: string;
}

/**
 * The focus-tag chips under a program's title. Rendered in
 * {@link PROGRAM_FOCUS_TAGS} order rather than each program's own order, so a
 * list of cards reads consistently. Renders nothing for an untagged program.
 */
export const ProgramTags = ({ tags, className }: Props) => {
  const ordered = PROGRAM_FOCUS_TAGS.filter((tag) => tags.includes(tag));
  if (ordered.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-0.5 ${className ?? ''}`}>
      {ordered.map((tag) => (
        <li
          key={tag}
          // Bordered rather than bg-secondary: the browse rows use bg-secondary
          // as their hover state, which would swallow a filled chip.
          className="rounded border px-0.5 text-xs font-normal text-muted-foreground"
        >
          {TAG_LABELS[tag]}
        </li>
      ))}
    </ul>
  );
};
