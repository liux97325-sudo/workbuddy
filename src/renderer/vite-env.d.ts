/// <reference types="vite/client" />

import type { WorkBuddyApi } from "../shared/types.js";

declare global {
  interface Window {
    workBuddy?: WorkBuddyApi;
  }
}
