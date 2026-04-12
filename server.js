const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const analyticsFilePath = path.join(dataDir, "analytics.json");
const defaultAnalytics = Object.freeze({
  siteViews: 0
});

let analyticsQueue = Promise.resolve();

app.use(express.json());
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function ensureAnalyticsFile() {
  try {
    await fs.access(analyticsFilePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await ensureDirectory(dataDir);
    await writeJsonFile(analyticsFilePath, defaultAnalytics);
  }
}

function normalizeAnalytics(data) {
  const siteViews = Number.isFinite(data?.siteViews) && data.siteViews >= 0
    ? Math.floor(data.siteViews)
    : defaultAnalytics.siteViews;

  return { siteViews };
}

async function readAnalytics() {
  await ensureAnalyticsFile();

  try {
    const rawAnalytics = await fs.readFile(analyticsFilePath, "utf8");
    return normalizeAnalytics(JSON.parse(rawAnalytics));
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn("analytics.json invalido. Reiniciando contador de visitas.");
      await writeJsonFile(analyticsFilePath, defaultAnalytics);
      return { ...defaultAnalytics };
    }

    throw error;
  }
}

async function incrementSiteViews() {
  const analytics = await readAnalytics();
  const nextAnalytics = {
    siteViews: analytics.siteViews + 1
  };

  await writeJsonFile(analyticsFilePath, nextAnalytics);
  return nextAnalytics;
}

function queueAnalyticsTask(task) {
  const taskPromise = analyticsQueue.then(task);
  analyticsQueue = taskPromise.catch(() => {});
  return taskPromise;
}

async function listMedia(folderName) {
  const folderPath = path.join(publicDir, folderName);

  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function createMediaRoute(route, folderName) {
  app.get(route, async (req, res) => {
    try {
      const files = await listMedia(folderName);
      res.json(files);
    } catch (error) {
      console.error(`Erro ao listar ${folderName}:`, error);
      res.status(500).json([]);
    }
  });
}

createMediaRoute("/api/videos", "video");
createMediaRoute("/api/audios", "audio");
createMediaRoute("/api/images", "images");

app.post("/api/analytics/view", async (req, res) => {
  try {
    const analytics = await queueAnalyticsTask(() => incrementSiteViews());
    res.status(200).json({
      success: true,
      siteViews: analytics.siteViews
    });
  } catch (error) {
    console.error("Erro ao atualizar analytics:", error);
    res.status(500).json({
      success: false,
      message: "Nao foi possivel atualizar analytics."
    });
  }
});

app.get("/api/lanyard/:userId", async (req, res) => {
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${encodeURIComponent(req.params.userId)}`);
    const data = await response.json();
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error("Erro ao consultar Lanyard:", error);
    res.status(502).json({ success: false, data: { discord_status: "offline" } });
  }
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
