use std::sync::Mutex;

use tauri::{
  image::Image,
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Emitter, Manager,
};

const BASE_ICON_BYTES: &[u8] = include_bytes!("../icons/32x32.png");
const TRAY_ID: &str = "main";
/// Событие, которым фронт слушает клик "Залогировать время" в меню трея
/// (см. AppLayout.tsx, listen() из @tauri-apps/api/event).
const LOG_TIME_EVENT: &str = "tray://log-time";

/// Обе версии иконки трея кэшируются при старте (см. badge_icon ниже) -
/// set_tray_unread ниже только переключает между готовыми буферами, не
/// перерисовывает пиксели на каждый вызов.
struct TrayIcons {
  normal: Image<'static>,
  badged: Image<'static>,
}

/// Закрашивает кружок-индикатор непрочитанных в правом нижнем углу базовой
/// иконки. Без сглаживания - для точки такого размера незаметно, а лишний
/// крейт (image/imageproc) ради anti-aliasing не оправдан.
fn badge_icon(base: &Image<'static>) -> Image<'static> {
  let width = base.width();
  let height = base.height();
  let mut rgba = base.rgba().to_vec();

  let radius = (width.min(height) as i32) / 5;
  let cx = width as i32 - radius - 1;
  let cy = height as i32 - radius - 1;
  // Тёплый красный - тот же смысл, что у бейджа непрочитанных в Topbar
  // (NotificationsBell), не обязательно тот же токен темы (Rust-бинарник не
  // видит CSS-переменные).
  let color = [220u8, 38, 38, 255];

  for y in 0..height as i32 {
    for x in 0..width as i32 {
      let dx = x - cx;
      let dy = y - cy;
      if dx * dx + dy * dy <= radius * radius {
        let idx = ((y * width as i32 + x) * 4) as usize;
        rgba[idx..idx + 4].copy_from_slice(&color);
      }
    }
  }

  Image::new_owned(rgba, width, height)
}

fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

/// Переключает иконку трея между обычной и с бейджем непрочитанных - вызов
/// с фронта при каждом изменении unreadCount (см. src/lib/tray.ts).
#[tauri::command]
pub fn set_tray_unread(app: AppHandle, has_unread: bool) -> Result<(), String> {
  let icons = app.state::<Mutex<TrayIcons>>();
  let icons = icons.lock().map_err(|e| e.to_string())?;
  let icon = if has_unread {
    icons.badged.clone()
  } else {
    icons.normal.clone()
  };
  if let Some(tray) = app.tray_by_id(TRAY_ID) {
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
  }
  Ok(())
}

/// System tray (issue #5) - сворачивание в трей вместо закрытия (обработчик
/// CloseRequested - в lib.rs, рядом с созданием окна), badge непрочитанных
/// уведомлений, быстрый доступ "Залогировать время" без разворачивания окна.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
  let normal: Image<'static> = Image::from_bytes(BASE_ICON_BYTES)?;
  let badged = badge_icon(&normal);
  app.manage(Mutex::new(TrayIcons {
    normal: normal.clone(),
    badged,
  }));

  let open_item = MenuItemBuilder::with_id("open", "Открыть").build(app)?;
  let log_time_item =
    MenuItemBuilder::with_id("log-time", "Залогировать время").build(app)?;
  // Отдельный пункт, не PredefinedMenuItem::quit - "Выход" обязан реально
  // завершать процесс (app.exit), а не полагаться на дефолтное поведение.
  let quit_item = MenuItemBuilder::with_id("quit", "Выход").build(app)?;
  let menu = MenuBuilder::new(app)
    .items(&[&open_item, &log_time_item, &quit_item])
    .build()?;

  TrayIconBuilder::with_id(TRAY_ID)
    .icon(normal)
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      "open" => show_main_window(app),
      "log-time" => {
        show_main_window(app);
        let _ = app.emit(LOG_TIME_EVENT, ());
      }
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        show_main_window(tray.app_handle());
      }
    })
    .build(app)?;

  Ok(())
}
