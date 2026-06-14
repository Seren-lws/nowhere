export async function generateEmbedding(
  text: string,
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<number[]> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/embeddings`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Embedding 请求失败 (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.data?.[0]?.embedding ?? [];
}
