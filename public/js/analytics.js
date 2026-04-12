let siteViewTracked = false;

export async function trackSiteView() {
  if (siteViewTracked) {
    return;
  }

  siteViewTracked = true;

  try {
    const response = await fetch("/api/analytics/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{}",
      keepalive: true
    });

    if (!response.ok) {
      throw new Error(`Falha ao registrar visita: ${response.status}`);
    }
  } catch (error) {
    console.error("Falha ao registrar analytics de visita.", error);
  }
}
