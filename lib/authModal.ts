// lib/authModal.ts

type Listener = (isOpen: boolean) => void;

let isOpen = false;
let listeners: Listener[] = [];

// Call this from anywhere to open the login modal
export function openAuthModal() {
  isOpen = true;
  listeners.forEach((fn) => fn(isOpen));
}

// Call this to close the modal
export function closeAuthModal() {
  isOpen = false;
  listeners.forEach((fn) => fn(isOpen));
}

// Used by the manager to keep in sync
export function subscribeAuthModal(listener: Listener) {
  listeners.push(listener);
  // Immediately send current state so the UI is in sync
  listener(isOpen);

  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}
