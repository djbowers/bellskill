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
    hasNotes: false,
    hasInterval: false,
    hasRest: false,
    showComplex: true,
    onToggleComplex: () => {},
    onToggleInterval: () => {},
    onToggleNotes: () => {},
    onToggleRest: () => {},
  },
};

export const AllOn: Story = {
  args: {
    complexSet: true,
    hasNotes: true,
    hasInterval: true,
    hasRest: true,
    showComplex: true,
    onToggleComplex: () => {},
    onToggleInterval: () => {},
    onToggleNotes: () => {},
    onToggleRest: () => {},
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

  return (
    <AddToWorkoutSection
      complexSet={complexSet}
      hasTitle={hasTitle}
      hasNotes={hasNotes}
      hasInterval={hasInterval}
      hasRest={hasRest}
      showComplex={showComplex}
      onToggleComplex={() => setComplexSet((prev) => !prev)}
      onToggleTitle={() => setHasTitle((prev) => !prev)}
      onToggleNotes={() => setHasNotes((prev) => !prev)}
      onToggleInterval={() => setHasInterval((prev) => !prev)}
      onToggleRest={() => setHasRest((prev) => !prev)}
    />
  );
};

export const Interactive: Story = {
  render: () => <InteractiveTemplate showComplex />,
};

export const InteractiveWithoutComplex: Story = {
  render: () => <InteractiveTemplate showComplex={false} />,
};
