import { appConfig, defaultAvatar, profileTemplate } from "./config.js";
import { dom } from "./dom.js";
import { fetchJson } from "./utils.js";

const state = {
  users: [],
  usersLoadFailed: false,
  statusMap: {}
};

function normalizeUser(user) {
  return {
    ...profileTemplate,
    ...user,
    badges: Array.isArray(user?.badges) ? user.badges : [],
    icons: Array.isArray(user?.icons) ? user.icons : []
  };
}

function createInvisibleSlots(count, className) {
  return Array.from({ length: count }, () => `<span class="${className}" aria-hidden="true"></span>`).join("");
}

function createBadgeMarkup(badges) {
  if (!badges.length) {
    return `<div class="badges-placeholder" aria-hidden="true">${createInvisibleSlots(2, "badge-placeholder")}</div>`;
  }

  return badges.map((badge) => `
    <div class="badge-container">
      <img src="${badge.icon}" alt="${badge.name}" loading="lazy">
      <div class="tooltip">${badge.name}</div>
    </div>
  `).join("");
}

function getIconFallbackLabel(name) {
  const normalizedName = String(name || "").toLowerCase();
  const fallbackLabels = {
    instagram: "IG",
    pinterest: "PI",
    spotify: "SP",
    gunslol: "GL",
    roblox: "RB",
    x: "X",
    youtube: "YT",
    discord: "DC",
    twitch: "TW"
  };

  return fallbackLabels[normalizedName] || normalizedName.slice(0, 2).toUpperCase();
}

function getIconAssetName(name) {
  const normalizedName = String(name || "").toLowerCase();
  const specialAssets = {
    pinterest: "pinterest_glow_white.png",
    gunslol: "gunslol_glow_white.png"
  };

  return specialAssets[normalizedName] || `${normalizedName}_white.png`;
}

function createIconMarkup(icons) {
  return icons.slice(0, appConfig.iconSlots).map((icon) => `
    <button
      class="link"
      type="button"
      data-icon-name="${icon.name}"
      data-url="${icon.url}"
      aria-label="${icon.name}"
      title="${icon.name}"
    >
      <img src="icons/${getIconAssetName(icon.name)}" alt="${icon.name}" loading="lazy">
      <span class="link-label" aria-hidden="true">${getIconFallbackLabel(icon.name)}</span>
    </button>
  `).join("");
}

function bindCardInteractions(card) {
  const avatarImage = card.querySelector(".avatar img");
  avatarImage.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  avatarImage.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
  avatarImage.addEventListener("error", () => {
    if (avatarImage.src !== defaultAvatar) {
      avatarImage.src = defaultAvatar;
    }
  }, { once: true });

  card.querySelectorAll(".link[data-url]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.stopPropagation();
      window.open(link.dataset.url, "_blank", "noopener,noreferrer");
    });
  });

  card.querySelectorAll(".link img").forEach((iconImage) => {
    iconImage.addEventListener("error", () => {
      iconImage.closest(".link")?.classList.add("is-fallback");
    }, { once: true });
  });
}

function buildProfileCard(user, index) {
  const card = document.createElement("article");
  const visibleIconCount = Math.min(user.icons.length, appConfig.iconSlots);
  const isCompactLinks = visibleIconCount > 4;
  card.className = "profile";
  card.dataset.discordId = user.id || "";
  card.style.setProperty(
    "--card-delay",
    `${Math.min(index * appConfig.profileAnimationStepMs, appConfig.profileAnimationMaxDelayMs)}ms`
  );

  const bioMarkup = user.bio ? user.bio : '<span class="bio-placeholder" aria-hidden="true">.</span>';

  card.innerHTML = `
    <div class="profile-header">
      <div class="avatar-slot">
        <div class="avatar">
          <img src="${user.avatar || defaultAvatar}" alt="${user.name || user.username || "Perfil"}" loading="lazy" draggable="false">
          <div class="status offline"></div>
        </div>
      </div>

      <div class="identity-slot">
        <div class="nickname">${user.name || ""}</div>
        <div class="realname">${user.username || ""}</div>
      </div>
    </div>

    <div class="profile-content">
      <div class="badges-slot ${user.badges.length ? "" : "is-empty"}">
        <div class="badges">
          ${createBadgeMarkup(user.badges)}
        </div>
      </div>

      <div class="bio-slot ${user.bio ? "" : "is-empty"}">
        <div class="bio">${bioMarkup}</div>
      </div>
    </div>

    <div class="profile-footer">
      <div class="links-slot ${user.icons.length ? "" : "is-empty"} ${isCompactLinks ? "is-compact" : ""}">
        <div class="links ${isCompactLinks ? "is-compact" : ""}">
          ${createIconMarkup(user.icons)}
        </div>
      </div>
    </div>
  `;

  bindCardInteractions(card);
  return card;
}

function renderProfilesEmptyState(message) {
  dom.profiles.innerHTML = `
    <div class="profiles-empty-state" role="status">
      <span>${message}</span>
    </div>
  `;
}

export function renderProfilesError() {
  renderProfilesEmptyState("Nao foi possivel carregar os perfis.");
}

export async function loadUsers() {
  try {
    const data = await fetchJson("/users.json");
    if (!Array.isArray(data)) {
      throw new Error("users.json precisa conter um array de usuarios.");
    }

    state.users = data.map(normalizeUser);
    state.usersLoadFailed = false;
    return state.users;
  } catch (error) {
    console.error("Falha ao carregar users.json.", error);
    state.users = [];
    state.usersLoadFailed = true;
    renderProfilesError();
    return state.users;
  }
}

export function renderProfiles() {
  dom.profiles.innerHTML = "";

  if (!state.users.length) {
    renderProfilesEmptyState(
      state.usersLoadFailed
        ? "Nao foi possivel carregar os perfis."
        : "Nenhum perfil disponivel no momento."
    );
    return;
  }

  const profilesInner = document.createElement("div");
  profilesInner.className = "profiles-inner";

  const fragment = document.createDocumentFragment();
  state.users.forEach((user, index) => {
    fragment.appendChild(buildProfileCard(user, index));
  });

  profilesInner.appendChild(fragment);
  dom.profiles.appendChild(profilesInner);
  applyStatuses(state.statusMap);
}

export function applyStatuses(statusMap) {
  state.statusMap = { ...statusMap };

  document.querySelectorAll(".profile").forEach((card) => {
    const userId = card.dataset.discordId;
    const status = state.statusMap[userId] || "offline";
    const statusDiv = card.querySelector(".status");

    if (statusDiv) {
      statusDiv.className = `status ${status}`;
    }
  });
}

export function getSubscribedUserIds() {
  return state.users.map((user) => user.id).filter(Boolean);
}
