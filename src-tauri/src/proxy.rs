//! Форвардинг запросов к Redmine из Rust вместо Node-прокси (server/) - см.
//! CLAUDE.md, раздел "Десктоп: прокси заменён на Tauri-команду".
//!
//! Зачем это вообще нужно: Redmine не отдает CORS-заголовки (см. CLAUDE.md,
//! "CORS и прокси-бэкенд"), поэтому обычный `fetch()` из webview браузером
//! блокируется - в веб-сборке это решает Node/Hono прокси (server/). Но CORS
//! - ограничение самого браузера/webview на JS-уровне; `reqwest` в Rust
//! никакого понятия о CORS не имеет, поэтому для десктоп-сборки прокси-сервер
//! не нужен вообще - фронт зовет эту команду через `invoke()` вместо
//! `fetch()`, см. src/api/client.ts (`createTauriFetch`).
//!
//! В отличие от Node-прокси, здесь не нужен allowlist хостов
//! (`ALLOWED_REDMINE_HOSTS`) - тот существовал, чтобы прокси-сервер, слушающий
//! сетевой порт, нельзя было превратить в открытый SSRF-релей для сторонних
//! сайтов. Tauri IPC не слушает сеть и недоступен снаружи приложения - вызвать
//! эту команду может только код самого webview, тот же trust boundary, что и
//! у остального приложения.

use base64::Engine;
use std::collections::HashMap;

/// Заголовки, которые есть смысл форвардить в обе стороны - тот же список,
/// что FORWARDED_REQUEST_HEADERS в server/src/index.ts.
const FORWARDED_REQUEST_HEADERS: &[&str] = &[
    "x-redmine-api-key",
    "authorization",
    "content-type",
    "x-redmine-switch-user",
];

#[derive(serde::Serialize)]
pub struct ProxyResponse {
    status: u16,
    /// Content-Type ответа, если есть - для восстановления Response на JS-стороне.
    content_type: Option<String>,
    /// Тело ответа, base64 - бинарно-безопасно в обе стороны (вложения,
    /// картинки), invoke() умеет передавать только JSON-совместимые значения.
    body_base64: String,
}

/// Форвардит один HTTP-запрос к Redmine 1:1, аналог `/proxy/*` в
/// server/src/index.ts. `url` - уже полный адрес до самого Redmine (не через
/// прокси-хост) - клиент строит его напрямую из baseUrl, отдельный
/// X-Redmine-Target здесь не нужен (в отличие от Node-прокси, где реальный
/// fetch шел на origin прокси-сервера, а не на Redmine).
#[tauri::command]
pub async fn proxy_request(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body_base64: Option<String>,
) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::new();

    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("Некорректный HTTP-метод: {e}"))?;

    let mut request = client.request(method, &url);

    for (name, value) in &headers {
        let name_lower = name.to_lowercase();
        if FORWARDED_REQUEST_HEADERS.contains(&name_lower.as_str()) {
            request = request.header(name, value);
        }
    }

    if let Some(body_b64) = body_base64 {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(body_b64)
            .map_err(|e| format!("Не удалось декодировать тело запроса: {e}"))?;
        request = request.body(bytes);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Не удалось связаться с Redmine: {e}"))?;

    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Не удалось прочитать ответ Redmine: {e}"))?;
    let body_base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(ProxyResponse {
        status,
        content_type,
        body_base64,
    })
}
