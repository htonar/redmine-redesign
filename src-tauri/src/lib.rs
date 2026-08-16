mod proxy;
mod tray;

// Manager - трейт с get_webview_window/manage/state, нужен для перехвата
// закрытия окна ниже (tray::setup сам импортирует его отдельно у себя).
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Автообновление (GitHub issue #2) - tauri-plugin-process нужен для
    // relaunch() после установки обновления, только desktop-таргеты (мобильных
    // сборок в планах нет, но mobile_entry_point выше уже присутствует - не
    // обвязываем условной компиляцией без необходимости, оба плагина сами по
    // себе desktop-only и no-op собрать для mobile не пытаются).
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    // OS push-уведомления (GitHub issue #3) - desktop-only, как остальные
    // плагины выше.
    .plugin(tauri_plugin_notification::init())
    // Открытие ссылок ("Открыть в Redmine") в системном браузере, а не
    // внутри webview - GitHub issue #24.
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // System tray (issue #5) - иконка, меню, badge непрочитанных.
      tray::setup(app.handle())?;

      // Закрытие окна сворачивает приложение в трей вместо завершения
      // процесса (issue #5, "Решено") - нужно, чтобы поллинг уведомлений
      // (useNotifications.ts) продолжал работать в фоне. Реальное завершение
      // процесса - только через "Выход" в меню трея (tray.rs, app.exit).
      if let Some(window) = app.get_webview_window("main") {
        // Клон дешёвый (WebviewWindow - хэндл поверх Arc) - нужен отдельно
        // от window, чтобы не двигать window в замыкание, пока сам вызов
        // on_window_event ещё держит &window как receiver.
        let window_to_hide = window.clone();
        window.on_window_event(move |event| {
          if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_to_hide.hide();
          }
        });
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      proxy::proxy_request,
      tray::set_tray_unread
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
