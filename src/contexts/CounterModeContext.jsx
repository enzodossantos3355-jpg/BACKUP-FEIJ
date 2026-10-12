import { createContext, useContext, useState } from "react";

const CounterModeContext = createContext({
  isOpen: false,
  open: () => {},
  close: () => {},
  setOpen: () => {},
});

export function CounterModeProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <CounterModeContext.Provider value={{ isOpen, open, close, setOpen: setIsOpen }}>
      {children}
    </CounterModeContext.Provider>
  );
}

export const useCounterMode = () => useContext(CounterModeContext);
export default CounterModeContext;
