/**
 * Функция генерации пастельных цветов
 * @param level уровень вложенности
 * @param saturation насыщенность
 * @param lightness яркость
 * @returns hsl цвет
 */
export function getColorForLevel(
  level: number,
  saturation: number,
  lightness: number,
): string {
  // Золотое сечение ~ 137.5 градусов (0.618 * 360)
  const goldenAngle = 137.5

  const hue = (level * goldenAngle) % 360

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
