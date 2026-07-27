import { Label } from './label';
import { Switch } from './switch';

export default {
  component: Switch,
};

export const Default = {
  name: 'Switch',
  args: {
    defaultChecked: true,
  },
};

const states = [
  { label: 'On', props: { defaultChecked: true } },
  { label: 'Off', props: { defaultChecked: false } },
  { label: 'On, disabled', props: { defaultChecked: true, disabled: true } },
  { label: 'Off, disabled', props: { defaultChecked: false, disabled: true } },
];

export const AllStates = () => (
  <div className="flex flex-col gap-2">
    {states.map(({ label, props }) => (
      <div key={label} className="flex items-center gap-1">
        <Switch {...props} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    ))}
  </div>
);

export const SettingsRow = () => (
  <div className="flex max-w-[24rem] items-start justify-between gap-2">
    <div className="flex flex-col gap-0.5">
      <Label htmlFor="story-auto-repeat">Repeat automatically</Label>
      <span id="story-auto-repeat-help" className="text-xs text-muted-foreground">
        When on, finishing the last session starts the program over instead of
        ending it. Progress by adding weight over time.
      </span>
    </div>
    <Switch
      id="story-auto-repeat"
      className="mt-0.5"
      aria-describedby="story-auto-repeat-help"
      defaultChecked
    />
  </div>
);
