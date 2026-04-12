import { appConfig } from "./config.js";
import { dom } from "./dom.js";
import { playOverlayMedia } from "./media.js";

const DESKTOP_CAROUSEL_MEDIA = "(hover: hover) and (pointer: fine)";
const CAROUSEL_DRAG_FACTOR = 0.78;
const CAROUSEL_SNAP_LERP = 0.16;
const CAROUSEL_STOP_EPSILON = 0.0015;
const ACTIVE_DEPTH_LIMIT = 0.72;
const ACTIVE_DEPTH_TILT_X = 2.8;
const ACTIVE_DEPTH_TILT_Y = 4.2;
const ACTIVE_DEPTH_LIFT = 2.4;
const ACTIVE_DEPTH_Z = 6.6;

export function createUiController() {
  const state = {
    overlayDismissed: false,
    parallaxStarted: false,
    discordInviteOpen: false,
    carouselEnabled: false,
    cards: [],
    currentPosition: 0,
    targetPosition: 0,
    dragStartX: 0,
    dragStartPosition: 0,
    isDragging: false,
    suppressClick: false,
    rafId: 0,
    activeDepthTargetX: 0,
    activeDepthTargetY: 0,
    activeDepthCurrentX: 0,
    activeDepthCurrentY: 0
  };

  function getProfilesTrack() {
    return dom.profiles.querySelector(".profiles-inner");
  }

  function isDesktopCarouselEnabled() {
    return window.matchMedia(DESKTOP_CAROUSEL_MEDIA).matches;
  }

  function clampCarouselPosition(position) {
    const maxPosition = Math.max(0, state.cards.length - 1);
    return Math.max(0, Math.min(maxPosition, position));
  }

  function getCarouselMetrics() {
    const firstCard = state.cards[0];
    const cardWidth = firstCard?.offsetWidth || 302;
    const viewportWidth = dom.profiles.clientWidth || window.innerWidth;
    const spacing = Math.min(Math.max(cardWidth * 0.82, 210), viewportWidth * 0.42);

    return {
      cardWidth,
      viewportWidth,
      spacing
    };
  }

  function clearCarouselCardState() {
    state.cards.forEach((card) => {
      card.style.transform = "";
      card.style.opacity = "";
      card.style.filter = "";
      card.style.zIndex = "";
      card.classList.remove("is-active", "is-near", "is-far");
      card.removeAttribute("aria-hidden");
    });
  }

  function renderCarousel() {
    if (!state.carouselEnabled) {
      return;
    }

    const { spacing } = getCarouselMetrics();

    state.cards.forEach((card, index) => {
      const delta = index - state.currentPosition;
      const distance = Math.min(Math.abs(delta), 3.5);
      const direction = delta === 0 ? 0 : delta / Math.abs(delta);
      const spread = 1 - Math.min(distance * 0.08, 0.2);
      const translateX = delta * spacing * spread;
      const translateY = Math.min(distance * 14, 34);
      const translateZ = 170 - Math.min(distance, 2.5) * 150;
      const scale = 1 - Math.min(distance * 0.14, 0.34);
      const rotateY = -direction * Math.min(distance * 22, 38);
      const opacity = Math.max(0.12, 1 - distance * 0.28);
      const blur = distance < 0.2 ? 0 : Math.min(distance * 1.7, 4.8);
      const brightness = Math.max(0.54, 1 - distance * 0.16);
      const saturate = Math.max(0.7, 1 - distance * 0.1);
      const contrast = Math.min(1.08, 1 + Math.max(0, 0.35 - distance) * 0.18);
      const isActive = Math.abs(delta) < 0.5;
      const mouseTiltX = isActive ? -state.activeDepthCurrentY * ACTIVE_DEPTH_TILT_X : 0;
      const mouseTiltY = isActive ? state.activeDepthCurrentX * ACTIVE_DEPTH_TILT_Y : 0;
      const mouseLift = isActive ? Math.abs(state.activeDepthCurrentY) * ACTIVE_DEPTH_LIFT : 0;
      const mouseDepthZ = isActive
        ? (Math.abs(state.activeDepthCurrentX) + Math.abs(state.activeDepthCurrentY)) * ACTIVE_DEPTH_Z
        : 0;

      card.style.transform =
        `translate(-50%, -50%) translate3d(${translateX.toFixed(1)}px, ${(translateY - mouseLift).toFixed(1)}px, ${(translateZ + mouseDepthZ).toFixed(1)}px) rotateX(${mouseTiltX.toFixed(2)}deg) rotateY(${(rotateY + mouseTiltY).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.filter =
        `blur(${blur.toFixed(2)}px) brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
      card.style.zIndex = String(1000 - Math.round(distance * 100));

      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-near", Math.abs(delta) >= 0.5 && Math.abs(delta) < 1.5);
      card.classList.toggle("is-far", Math.abs(delta) >= 1.5);
      card.setAttribute("aria-hidden", Math.abs(delta) > 2.8 ? "true" : "false");
    });
  }

  function cancelCarouselAnimation() {
    if (!state.rafId) {
      return;
    }

    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  function stepCarouselAnimation() {
    state.rafId = 0;

    if (!state.carouselEnabled) {
      return;
    }

    if (!state.isDragging) {
      state.currentPosition += (state.targetPosition - state.currentPosition) * CAROUSEL_SNAP_LERP;

      if (Math.abs(state.targetPosition - state.currentPosition) < CAROUSEL_STOP_EPSILON) {
        state.currentPosition = state.targetPosition;
      }
    }

    state.activeDepthCurrentX += (state.activeDepthTargetX - state.activeDepthCurrentX) * 0.14;
    state.activeDepthCurrentY += (state.activeDepthTargetY - state.activeDepthCurrentY) * 0.14;

    if (Math.abs(state.activeDepthTargetX - state.activeDepthCurrentX) < 0.001) {
      state.activeDepthCurrentX = state.activeDepthTargetX;
    }

    if (Math.abs(state.activeDepthTargetY - state.activeDepthCurrentY) < 0.001) {
      state.activeDepthCurrentY = state.activeDepthTargetY;
    }

    renderCarousel();

    if (
      state.isDragging ||
      Math.abs(state.targetPosition - state.currentPosition) > CAROUSEL_STOP_EPSILON ||
      Math.abs(state.activeDepthTargetX - state.activeDepthCurrentX) > 0.001 ||
      Math.abs(state.activeDepthTargetY - state.activeDepthCurrentY) > 0.001
    ) {
      state.rafId = requestAnimationFrame(stepCarouselAnimation);
    }
  }

  function queueCarouselAnimation() {
    if (state.rafId) {
      return;
    }

    state.rafId = requestAnimationFrame(stepCarouselAnimation);
  }

  function snapCarouselToNearestCard() {
    state.targetPosition = clampCarouselPosition(Math.round(state.currentPosition));
    queueCarouselAnimation();
  }

  function handleCarouselPointerMove(event) {
    if (!state.isDragging) {
      return;
    }

    event.preventDefault();

    const { spacing } = getCarouselMetrics();
    const deltaX = event.clientX - state.dragStartX;

    if (Math.abs(deltaX) > 6) {
      state.suppressClick = true;
    }

    const dragStep = Math.max(spacing * CAROUSEL_DRAG_FACTOR, 180);
    const nextPosition = state.dragStartPosition - deltaX / dragStep;

    state.currentPosition = clampCarouselPosition(nextPosition);
    state.targetPosition = state.currentPosition;
    renderCarousel();
  }

  function updateActiveDepthFromPointer(event) {
    if (!state.carouselEnabled || state.isDragging) {
      return;
    }

    const rect = dom.profiles.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const normalizedY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    state.activeDepthTargetX = Math.max(-ACTIVE_DEPTH_LIMIT, Math.min(ACTIVE_DEPTH_LIMIT, normalizedX));
    state.activeDepthTargetY = Math.max(-ACTIVE_DEPTH_LIMIT, Math.min(ACTIVE_DEPTH_LIMIT, normalizedY));
    queueCarouselAnimation();
  }

  function resetActiveDepth() {
    state.activeDepthTargetX = 0;
    state.activeDepthTargetY = 0;
    queueCarouselAnimation();
  }

  function activateCenteredCard() {
    const activeCard = state.cards.find((card) => card.classList.contains("is-active"));
    if (!activeCard) {
      return;
    }

    const actions = Array.from(activeCard.querySelectorAll(".link[data-url]"));
    if (!actions.length) {
      return;
    }

    if (actions.length === 1) {
      actions[0].click();
      return;
    }

    actions[0].focus({ preventScroll: true });
  }

  function handleCarouselPointerUp() {
    if (!state.isDragging) {
      return;
    }

    state.isDragging = false;
    dom.profiles.classList.remove("is-dragging");

    window.removeEventListener("mousemove", handleCarouselPointerMove);
    window.removeEventListener("mouseup", handleCarouselPointerUp);

    snapCarouselToNearestCard();
  }

  function handleCarouselPointerDown(event) {
    if (!state.carouselEnabled || event.button !== 0) {
      return;
    }

    if (event.target.closest(".link, a, button")) {
      return;
    }

    state.isDragging = true;
    state.suppressClick = false;
    state.dragStartX = event.clientX;
    state.dragStartPosition = state.currentPosition;
    state.activeDepthTargetX = 0;
    state.activeDepthTargetY = 0;

    dom.profiles.classList.add("is-dragging");
    dom.profiles.focus({ preventScroll: true });

    window.addEventListener("mousemove", handleCarouselPointerMove);
    window.addEventListener("mouseup", handleCarouselPointerUp);
  }

  function handleCarouselClick(event) {
    if (!state.carouselEnabled) {
      return;
    }

    const card = event.target.closest(".profile");
    if (!card || !dom.profiles.contains(card)) {
      return;
    }

    if (state.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      state.suppressClick = false;
      return;
    }

    const cardIndex = state.cards.indexOf(card);
    if (cardIndex === -1) {
      return;
    }

    const activeIndex = Math.round(state.targetPosition);

    if (event.target.closest(".link, a, button")) {
      if (cardIndex !== activeIndex) {
        event.preventDefault();
        event.stopPropagation();
        state.targetPosition = cardIndex;
        queueCarouselAnimation();
      }
      return;
    }

    if (cardIndex !== activeIndex) {
      state.targetPosition = cardIndex;
      queueCarouselAnimation();
    }
  }

  function handleCarouselKeydown(event) {
    if (!state.carouselEnabled) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const interactiveTarget = event.target instanceof Element
      ? event.target.closest("input, textarea, select, [contenteditable='true'], .link, button, a")
      : null;

    if (interactiveTarget) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.targetPosition = clampCarouselPosition(Math.round(state.targetPosition) - 1);
      queueCarouselAnimation();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      state.targetPosition = clampCarouselPosition(Math.round(state.targetPosition) + 1);
      queueCarouselAnimation();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      activateCenteredCard();
    }
  }

  function handleCarouselResize() {
    setupProfileDragging();
  }

  function setDiscordInviteOpen(isOpen) {
    if (!dom.discordInvite || !dom.discordInviteLauncher) {
      return;
    }

    state.discordInviteOpen = isOpen;

    dom.discordInvite.classList.toggle("is-open", isOpen);
    dom.discordInvite.setAttribute("aria-hidden", String(!isOpen));
    dom.discordInviteLauncher.classList.toggle("show", !isOpen);
    dom.discordInviteLauncher.setAttribute("aria-expanded", String(isOpen));
  }

  function openDiscordInvite() {
    if (!state.overlayDismissed) {
      return;
    }

    setDiscordInviteOpen(true);
  }

  function closeDiscordInvite({ returnFocus = false } = {}) {
    if (!state.overlayDismissed) {
      return;
    }

    setDiscordInviteOpen(false);

    if (returnFocus) {
      dom.discordInviteLauncher?.focus({ preventScroll: true });
    }
  }

  function setupDiscordInviteToggle() {
    dom.discordInviteLauncher?.addEventListener("click", openDiscordInvite);
    dom.discordInviteClose?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeDiscordInvite({ returnFocus: true });
    });
  }

  function teardownProfileCarousel() {
    cancelCarouselAnimation();

    dom.profiles.classList.remove("carousel-mode", "is-dragging");
    dom.profiles.removeAttribute("tabindex");
    dom.profiles.removeAttribute("aria-label");
    dom.profiles.removeEventListener("mousedown", handleCarouselPointerDown);
    dom.profiles.removeEventListener("click", handleCarouselClick, true);
    dom.profiles.removeEventListener("mousemove", updateActiveDepthFromPointer);
    dom.profiles.removeEventListener("mouseleave", resetActiveDepth);
    dom.profiles.removeEventListener("keydown", handleCarouselKeydown);
    window.removeEventListener("mousemove", handleCarouselPointerMove);
    window.removeEventListener("mouseup", handleCarouselPointerUp);

    const track = getProfilesTrack();
    if (track) {
      track.classList.remove("carousel-track");
    }

    clearCarouselCardState();

    state.carouselEnabled = false;
    state.cards = [];
    state.currentPosition = 0;
    state.targetPosition = 0;
    state.isDragging = false;
    state.suppressClick = false;
    state.activeDepthTargetX = 0;
    state.activeDepthTargetY = 0;
    state.activeDepthCurrentX = 0;
    state.activeDepthCurrentY = 0;
  }

  function revealProfiles() {
    if (state.overlayDismissed) {
      return;
    }

    state.overlayDismissed = true;

    playOverlayMedia();

    document.body.classList.add("is-revealing");

    if (appConfig.removeBlur) {
      dom.overlay.style.backdropFilter = "blur(0px)";
      dom.overlay.style.webkitBackdropFilter = "blur(0px)";
    } else {
      dom.overlay.style.backdropFilter = "";
      dom.overlay.style.webkitBackdropFilter = "";
    }

    dom.profiles.classList.remove("hidden");
    dom.discordInviteLauncher?.classList.remove("hidden");
    dom.discordInvite?.classList.remove("hidden");

    requestAnimationFrame(() => {
      dom.profiles.classList.add("show");
      setDiscordInviteOpen(false);
      if (state.carouselEnabled) {
        dom.profiles.focus({ preventScroll: true });
      }
    });

    setTimeout(() => {
      dom.overlay.style.display = "none";
      document.body.classList.add("is-revealed");
    }, appConfig.overlayFadeMs);
  }

  function setupOverlay() {
    setupDiscordInviteToggle();

    dom.overlay.addEventListener("click", revealProfiles);
    dom.overlay.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        revealProfiles();
      }
    });
  }

  function setupProfileDragging() {
    const track = getProfilesTrack();

    window.removeEventListener("resize", handleCarouselResize);
    window.addEventListener("resize", handleCarouselResize);

    if (!track || !track.querySelector(".profile")) {
      teardownProfileCarousel();
      return;
    }

    if (!isDesktopCarouselEnabled()) {
      teardownProfileCarousel();
      return;
    }

    teardownProfileCarousel();

    state.cards = Array.from(track.querySelectorAll(".profile"));

    if (!state.cards.length) {
      return;
    }

    state.carouselEnabled = true;
    state.currentPosition = clampCarouselPosition(Math.round(state.targetPosition));
    state.targetPosition = state.currentPosition;
    state.activeDepthTargetX = 0;
    state.activeDepthTargetY = 0;
    state.activeDepthCurrentX = 0;
    state.activeDepthCurrentY = 0;

    dom.profiles.classList.add("carousel-mode");
    dom.profiles.tabIndex = 0;
    dom.profiles.setAttribute("aria-label", "Carrossel de perfis");
    track.classList.add("carousel-track");

    renderCarousel();

    dom.profiles.addEventListener("mousedown", handleCarouselPointerDown);
    dom.profiles.addEventListener("click", handleCarouselClick, true);
    dom.profiles.addEventListener("mousemove", updateActiveDepthFromPointer);
    dom.profiles.addEventListener("mouseleave", resetActiveDepth);
    dom.profiles.addEventListener("keydown", handleCarouselKeydown);
  }

  function setupParallax() {
    if (state.parallaxStarted || window.matchMedia("(hover: none)").matches) {
      return;
    }

    state.parallaxStarted = true;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    document.addEventListener("mousemove", (event) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;

      targetX = x * appConfig.parallaxIntensity;
      targetY = y * appConfig.parallaxIntensity;
    });

    function animate() {
      const profilesInner = getProfilesTrack();

      currentX += (targetX - currentX) * appConfig.parallaxLerp;
      currentY += (targetY - currentY) * appConfig.parallaxLerp;

      if (profilesInner) {
        profilesInner.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }

      requestAnimationFrame(animate);
    }

    animate();
  }

  return {
    revealProfiles,
    setupOverlay,
    setupProfileDragging,
    setupParallax
  };
}
