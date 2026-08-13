mod proxy;

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
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![proxy::proxy_request])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
