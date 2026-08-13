import { invoke } from "@tauri-apps/api/core";

/**
 * Замена fetch() для десктоп-сборки (Tauri) - вместо сетевого запроса из
 * webview (который Redmine режет по CORS, см. CLAUDE.md "CORS и
 * прокси-бэкенд") зовет Rust-команду `proxy_request`
 * (src-tauri/src/proxy.rs), которая форвардит запрос через reqwest - у него
 * нет понятия CORS вообще, поэтому отдельный прокси-сервер (server/) для
 * десктопа не нужен. Подключается в createRedmineClient() как кастомный
 * fetch для openapi-fetch и как фолбэк для rawFetch - см. src/api/client.ts.
 *
 * Совместима по сигнатуре с global fetch (принимает Request), поэтому
 * годится и для типизированного клиента (openapi-fetch зовет `fetch(request)`
 * с готовым Request), и для rawFetch (сам оборачивает url/init в Request).
 */
export async function tauriFetch(request: Request): Promise<Response> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });

  const bodyBase64 =
    request.body !== null
      ? arrayBufferToBase64(await request.arrayBuffer())
      : undefined;

  const result = await invoke<{
    status: number;
    content_type: string | null;
    body_base64: string;
  }>("proxy_request", {
    url: request.url,
    method: request.method,
    headers,
    bodyBase64,
  });

  // Blob, а не сырой Uint8Array - у TS/lib.dom.d.ts несовпадение типов между
  // Uint8Array<ArrayBufferLike> и BodyInit в некоторых версиях (не рантайм-
  // проблема, только типизация); Blob однозначно принимается везде.
  return new Response(new Blob([base64ToBytes(result.body_base64)]), {
    status: result.status,
    headers: result.content_type
      ? { "content-type": result.content_type }
      : undefined,
  });
}

// btoa/atob работают только с "бинарной строкой" (по символу на байт) - для
// произвольных файлов (вложения) нужно пройти через Uint8Array вручную, а не
// просто String.fromCharCode(...bytes) - на больших файлах это переполняет
// стек вызовов (spread по многотысячному массиву аргументов).
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
