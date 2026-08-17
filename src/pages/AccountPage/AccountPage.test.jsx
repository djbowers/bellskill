import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';

import * as stories from './AccountPage.stories';

const { Default } = composeStories(stories);

describe('account page', () => {
  beforeEach(() => {
    render(<Default />);
  });

  test("renders user's email address", async () => {
    const emailInput = await screen.findByRole('textbox', { name: 'Email' });
    expect(emailInput).toHaveDisplayValue('luke@skywalker.com');
  });

  test('renders the data export section', async () => {
    const exportButton = await screen.findByRole('button', {
      name: 'Export my data',
    });
    expect(exportButton).toBeInTheDocument();
  });
});
