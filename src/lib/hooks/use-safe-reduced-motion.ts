"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * The reduced-motion preference, safe to branch on during render.
 *
 * `useReducedMotion` reads a media query. There is no media query on the
 * server, so it returns `false` during SSR and the user's real setting in the
 * browser. Any JSX that branches on it therefore produces different markup on
 * the two sides, and React throws away the entire tree with a hydration error.
 *
 * The failure is invisible unless you go looking for it: it only affects
 * people who have "reduce motion" enabled at the OS level, so it survives
 * every round of casual testing by anyone who does not.
 *
 * `useSyncExternalStore` is the primitive built for this split. React uses the
 * server snapshot while hydrating and the client snapshot afterwards, so the
 * two renders agree by construction and the real preference applies on the
 * very next render — before any animation it would suppress could play.
 */

/** No external store to watch: the value flips once, when hydration ends. */
const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function useSafeReducedMotion(): boolean {
  const preference = useReducedMotion();
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer);

  return hydrated ? Boolean(preference) : false;
}
