import { act, renderHook } from '@testing-library/react';

import {
  ProgramSessionProvider,
  useProgramSession,
} from './ProgramSessionContext';

describe('ProgramSessionContext', () => {
  it('degrades to a null session and a no-op setter outside the provider', () => {
    const { result } = renderHook(() => useProgramSession());

    expect(result.current[0]).toBeNull();
    act(() => {
      result.current[1]({ userProgramId: 'up-1', programSessionId: 'ps-1' });
    });
    expect(result.current[0]).toBeNull();
  });

  it('holds the pending session a program start stashes, until it is cleared', () => {
    const { result } = renderHook(() => useProgramSession(), {
      wrapper: ProgramSessionProvider,
    });

    expect(result.current[0]).toBeNull();

    act(() => {
      result.current[1]({ userProgramId: 'up-1', programSessionId: 'ps-1' });
    });
    expect(result.current[0]).toEqual({
      userProgramId: 'up-1',
      programSessionId: 'ps-1',
    });

    // A subsequent non-program start passes null, clearing the stale session.
    act(() => {
      result.current[1](null);
    });
    expect(result.current[0]).toBeNull();
  });
});
