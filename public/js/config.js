export const appConfig = Object.freeze({
  removeBlur: false,
  maxMusicVolume: 0.3,
  overlayFadeMs: 980,
  lanyardReconnectMs: 3000,
  profileAnimationStepMs: 280,
  profileAnimationMaxDelayMs: 1680,
  iconSlots: 4,
  parallaxIntensity: 20,
  parallaxLerp: 0.08
});

export const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%23111111'/%3E%3Ccircle cx='60' cy='45' r='22' fill='%23666'/%3E%3Cpath d='M24 100c8-18 24-28 36-28s28 10 36 28' fill='%23666'/%3E%3C/svg%3E";

export const profileTemplate = Object.freeze({
  id: "",
  name: "",
  username: "",
  avatar: "",
  badges: [],
  bio: "",
  icons: []
});
