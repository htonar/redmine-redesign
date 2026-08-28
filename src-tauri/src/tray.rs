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
///
/// Точка намеренно крупная (радиус ~1/4 иконки) и с контрастным кольцом:
/// в трее Linux (Cinnamon/GNOME) иконка ужимается до ~16-22px, и прежний
/// радиус 1/5 без обводки на этом размере был почти не виден (issue #25).
fn badge_icon(base: &Image<'static>) -> Image<'static> {
  let width = base.width();
  let height = base.height();
  let mut rgba = base.rgba().to_vec();

  let radius = (width.min(height) as i32) / 4;
  // Кольцо-обводка вокруг точки - чтобы читалась и на светлом, и на тёмном
  // фоне трея.
  let ring = (radius / 3).max(1);
  let cx = width as i32 - radius - 1;
  let cy = height as i32 - radius - 1;
  // Белая заливка с тёмным кольцом. Базовая иконка приложения сама красная,
  // так что красная точка на ней сливалась бы (проверено рендером) -
  // контрастный "непрочитано"-индикатор здесь белый, а не бренд-красный.
  let fill = [255u8, 255, 255, 255];
  let ring_color = [30u8, 30, 30, 255];

  let outer = radius + ring;
  for y in 0..height as i32 {
    for x in 0..width as i32 {
      let dx = x - cx;
      let dy = y - cy;
      let dist_sq = dx * dx + dy * dy;
      let color = if dist_sq <= radius * radius {
        Some(fill)
      } else if dist_sq <= outer * outer {
        Some(ring_color)
      } else {
        None
      };
      if let Some(c) = color {
        let idx = ((y * width as i32 + x) * 4) as usize;
        rgba[idx..idx + 4].copy_from_slice(&c);
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

/// Переключает иконку трея между обычной и с бейджем непрочитанных и
/// обновляет tooltip - вызов с фронта при каждом изменении unreadCount
/// (см. src/lib/tray.ts).
///
/// Tooltip дублирует счётчик текстом: перерисовка самой иконки в трее Linux
/// (`libappindicator`) местами не подхватывается на лету, а текст tooltip
/// переживает любой бэкенд трея (issue #25).
#[tauri::command]
pub fn set_tray_unread(app: AppHandle, unread_count: u32) -> Result<(), String> {
  let icons = app.state::<Mutex<TrayIcons>>();
  let icons = icons.lock().map_err(|e| e.to_string())?;
  let icon = if unread_count > 0 {
    icons.badged.clone()
  } else {
    icons.normal.clone()
  };
  let tooltip = if unread_count > 0 {
    format!("Redfine - непрочитанных: {unread_count}")
  } else {
    "Redfine".to_string()
  };
  if let Some(tray) = app.tray_by_id(TRAY_ID) {
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
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
    .tooltip("Redfine")
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
