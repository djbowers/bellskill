import { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

// eslint-disable-next-line react-refresh/only-export-components -- context object is intentionally co-located with its Provider; splitting the module is out of scope for the lint pass
export const SessionContext = createContext<Session>(undefined!);
export const SessionProvider = SessionContext;
// eslint-disable-next-line react-refresh/only-export-components -- consumer hook is intentionally co-located with its Provider; splitting the module is out of scope for the lint pass
export const useSession = () => useContext(SessionContext);
