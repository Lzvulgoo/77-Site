export function random(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}: ${response.status}`);
  }

  return response.json();
}
