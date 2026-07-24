import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { AddToWorkoutSection } from './AddToWorkoutSection';

const meta = {
  component: AddToWorkoutSection,
  decorators: [
    (Story) => (
      <div className="max-w-md bg-card p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddToWorkoutSection>;

export default meta;

type Story = StoryObj<typeof AddToWorkoutSection>;

export const AllOff: Story = {
  args: {
    complexSet: false,
    hasTitle: false,
    hasNotes: false,
    hasInterval: false,
    hasRest: false,
    showComplex: true,
    straightSets: false,
    onToggleComplex: () => {},
    onToggleInterval: () => {},
    onToggleNotes: () => {},
    onToggleRest: () => {},
    onToggleStraightSets: () => {},
    onToggleTitle: () => {},
  },
};

export const AllOn: Story = {
  args: {
    complexSet: true,
    hasTitle: true,
    hasNotes: true,
    hasInterval: true,
    hasRest: true,
    showComplex: true,
    straightSets: false,
    onToggleComplex: () => {},
    onToggleInterval: () => {},
    onToggleNotes: () => {},
    onToggleRest: () => {},
    onToggleStraightSets: () => {},
    onToggleTitle: () => {},
  },
};

export const StraightSets: Story = {
  args: {
    ...AllOff.args,
    straightSets: true,
  },
};

export const WithoutComplexToggle: Story = {
  args: {
    ...AllOff.args,
    showComplex: false,
  },
};

const InteractiveTemplate = ({
  showComplex,
}: {
  showComplex: boolean;
}) => {
  const [complexSet, setComplexSet] = useState(false);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasNotes, setHasNotes] = useState(false);
  const [hasInterval, setHasInterval] = useState(false);
  const [hasRest, setHasRest] = useState(false);
  const [straightSets, setStraightSets] = useState(false);

  return (
    <AddToWorkoutSection
      complexSet={complexSet}
      hasTitle={hasTitle}
      hasNotes={hasNotes}
      hasInterval={hasInterval}
      hasRest={hasRest}
      showComplex={showComplex}
      straightSets={straightSets}
      onToggleComplex={() => {
        setComplexSet((prev) => !prev);
        setStraightSets(false);
      }}
      onToggleTitle={() => setHasTitle((prev) => !prev)}
      onToggleNotes={() => setHasNotes((prev) => !prev)}
      onToggleInterval={() => setHasInterval((prev) => !prev)}
      onToggleRest={() => setHasRest((prev) => !prev)}
      onToggleStraightSets={() => {
        setStraightSets((prev) => !prev);
        setComplexSet(false);
      }}
    />
  );
};

export const Interactive: Story = {
  render: () => <InteractiveTemplate showComplex />,
};

export const InteractiveWithoutComplex: Story = {
  render: () => <InteractiveTemplate showComplex={false} />,
};
