import confetti from "canvas-confetti";

/**
 * Мягкая геймификация - декоративный confetti-залп при закрытии задачи/
 * выходе на 100% готовности/закрытии всех долгов по трудозатратам (см.
 * CLAUDE.md, "Мягкая геймификация"). Чисто декоративный слой поверх обычных
 * состояний (status.is_closed, done_ratio, totalDeficit) - новых данных не
 * требует, ничего не меняет в логике сохранения.
 *
 * `disableForReducedMotion` - пользователи, попросившие браузер уменьшить
 * анимации (`prefers-reduced-motion`), не должны получать анимационный
 * "сюрприз" без спроса; canvas-confetti сам не запускает залп в этом случае.
 */
export function celebrate() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#dc2626", "#f59e0b", "#22c55e", "#3b82f6"],
    disableForReducedMotion: true,
  });
}
