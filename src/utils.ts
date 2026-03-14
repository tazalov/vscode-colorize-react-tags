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
  const hue = (level * 60) % 360

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
