export function range(length: number, start = 1) {
  return Array.from({ length }, (_, i) => i + start)
}
