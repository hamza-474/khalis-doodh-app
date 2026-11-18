export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Our own email + password sign-in page (replaces the Manus OAuth redirect).
// Call from an event handler or effect at the moment you want to navigate.
export const startLogin = () => {
  window.location.href = "/login";
};
