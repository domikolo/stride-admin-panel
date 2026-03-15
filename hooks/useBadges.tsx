'use client';

import { createContext, useContext, useState } from 'react';

interface BadgesContextValue {
  liveCount: number;
  setLiveCount: (n: number) => void;
  unreadNotifCount: number;
  setUnreadNotifCount: (n: number) => void;
}

const BadgesContext = createContext<BadgesContextValue>({
  liveCount: 0,
  setLiveCount: () => {},
  unreadNotifCount: 0,
  setUnreadNotifCount: () => {},
});

export function BadgesProvider({ children }: { children: React.ReactNode }) {
  const [liveCount, setLiveCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  return (
    <BadgesContext.Provider value={{ liveCount, setLiveCount, unreadNotifCount, setUnreadNotifCount }}>
      {children}
    </BadgesContext.Provider>
  );
}

export const useBadges = () => useContext(BadgesContext);
