import { appConfig } from "./config.js";
import { dom } from "./dom.js";
import { fetchJson, random } from "./utils.js";

function setBodyBackgroundImage(imageName) {
  document.body.style.backgroundImage = `url("/images/${encodeURIComponent(imageName)}")`;
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundRepeat = "no-repeat";
}

export async function loadMedia() {
  const { music, video } = dom;

  try {
    const [videos, audios, images] = await Promise.all([
      fetchJson("/api/videos"),
      fetchJson("/api/audios"),
      fetchJson("/api/images")
    ]);

    const hasImages = Array.isArray(images) && images.length > 0;
    const hasVideos = Array.isArray(videos) && videos.length > 0;
    const shouldUseImage = hasImages && (!hasVideos || Math.random() > 0.5);

    if (Array.isArray(audios) && audios.length > 0) {
      music.src = `/audio/${encodeURIComponent(random(audios))}`;
      music.load();
    }

    if (shouldUseImage) {
      video.removeAttribute("src");
      video.load();
      video.classList.add("hidden-media");
      setBodyBackgroundImage(random(images));
      return;
    }

    if (hasVideos) {
      video.src = `/video/${encodeURIComponent(random(videos))}`;
      video.classList.remove("hidden-media");
      document.body.style.backgroundImage = "";
      video.load();
      return;
    }

    if (hasImages) {
      video.removeAttribute("src");
      video.load();
      video.classList.add("hidden-media");
      setBodyBackgroundImage(random(images));
    }
  } catch (error) {
    console.error("Falha ao carregar a midia de fundo.", error);
  }
}

export async function playOverlayMedia() {
  const { music, video } = dom;

  if (video.src && !video.classList.contains("hidden-media")) {
    video.currentTime = 0;
    video.play().catch(() => {});
  }

  if (!music.src) {
    return;
  }

  music.volume = 0;
  music.currentTime = 0;
  music.play().catch(() => {});

  let currentVolume = 0;
  const fade = setInterval(() => {
    currentVolume = Math.min(currentVolume + 0.05, appConfig.maxMusicVolume);
    music.volume = currentVolume;

    if (currentVolume >= appConfig.maxMusicVolume) {
      clearInterval(fade);
    }
  }, 100);
}
