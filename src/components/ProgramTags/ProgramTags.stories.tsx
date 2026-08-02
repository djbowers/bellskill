import { ProgramTags } from './ProgramTags';

export default {
  component: ProgramTags,
};

export const Default = {
  args: { tags: ['strength', 'hypertrophy', 'conditioning'] },
};

/** Tags render in PROGRAM_FOCUS_TAGS order, not the order they were passed. */
export const Reordered = {
  args: { tags: ['mobility', 'power', 'strength'] },
};

export const SingleTag = {
  args: { tags: ['endurance'] },
};

/** User-authored programs carry no tags and render nothing. */
export const Untagged = {
  args: { tags: [] },
};
