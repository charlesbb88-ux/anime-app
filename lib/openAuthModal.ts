// lib/openAuthModal.ts
export function openAuthModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("open-auth-modal"));
  }
}
