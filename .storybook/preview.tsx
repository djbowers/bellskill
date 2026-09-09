import { Preview } from '@storybook/react';

import { handlers } from '../src/mocks';
import '../src/tailwind.css';
import { initialize, mswLoader } from './decorators/mswLoader';

// Initialize MSW
initialize({ onUnhandledRequest: 'bypass' });

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f0ede8' },
        { name: 'dark', value: '#0f0f0f' },
      ],
    },
    msw: { handlers },
  },
  loaders: [mswLoader],
};

export default preview;
