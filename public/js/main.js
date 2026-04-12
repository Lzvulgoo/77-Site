import { trackSiteView } from "./analytics.js";
import { loadMedia } from "./media.js";
import { loadUsers, renderProfiles, getSubscribedUserIds, applyStatuses } from "./profiles.js";
import { createLanyardController } from "./lanyard.js";
import { createUiController } from "./ui.js";

let appStarted = false;

export async function initApp() {
  if (appStarted) {
    return;
  }

  appStarted = true;

  trackSiteView();

  const ui = createUiController();
  const lanyard = createLanyardController({
    getSubscribedUserIds,
    onStatusesChange: applyStatuses
  });

  ui.setupOverlay();

  await Promise.all([loadMedia(), loadUsers()]);
  renderProfiles();
  ui.setupProfileDragging();
  ui.setupParallax();
  await lanyard.bootstrap();
  lanyard.connect();

  window.addEventListener("beforeunload", () => {
    lanyard.cleanup();
  }, { once: true });
}
