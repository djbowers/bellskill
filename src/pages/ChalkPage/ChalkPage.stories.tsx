import type React from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { ChalkMessage } from '~/types';

import { Composer } from './components/Composer';
import { EmptyState } from './components/EmptyState';
import { MessageList } from './components/MessageList';

/**
 * Static compositions of the chat surface — no network, no providers — so each
 * state is inspectable on its own and cheap to screenshot for a PR gallery.
 */
export default {
  title: 'Pages/ChalkPage',
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (Story: () => React.JSX.Element) => (
      <MemoryRouter initialEntries={['/chalk']}>
        <div className="flex h-[600px] flex-col border border-border">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};

const message = (over: Partial<ChalkMessage> & { id: string }): ChalkMessage => ({
  threadId: 't1',
  role: 'assistant',
  content: '',
  status: 'complete',
  error: null,
  createdAt: '2026-08-15T00:00:00Z',
  ...over,
});

const conversation: ChalkMessage[] = [
  message({ id: 'u1', role: 'user', content: 'Which patterns am I neglecting?' }),
  message({
    id: 'a1',
    content:
      "Your hinge hasn't been trained in 11 days — that's the one to fix. Everything else is inside its usual cadence, and squat is actually ahead of where it normally sits.\n\n- Swings, 10 sets of 10 @ 24kg\n- Or a heavier day: **5x5 deadlifts**, then swings as a finisher",
  }),
];

export const Empty = {
  render: () => (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md">
          <EmptyState onPick={() => {}} />
        </div>
      </div>
      <Composer onSend={() => {}} />
    </>
  ),
};

export const Conversation = {
  render: () => (
    <>
      <MessageList
        messages={conversation}
        pendingMessage={null}
        isSending={false}
      />
      <Composer onSend={() => {}} />
    </>
  ),
};

export const AwaitingReply = {
  render: () => (
    <>
      <MessageList
        messages={conversation}
        pendingMessage="Should I start Rite of Passage?"
        isSending
      />
      <Composer onSend={() => {}} disabled />
    </>
  ),
};

export const StoppedMidAnswer = {
  render: () => (
    <>
      <MessageList
        messages={[
          conversation[0],
          message({
            id: 'a2',
            status: 'aborted',
            content: 'Your hinge is the one that needs attention —',
          }),
        ]}
        pendingMessage={null}
        isSending={false}
      />
      <Composer onSend={() => {}} />
    </>
  ),
};
