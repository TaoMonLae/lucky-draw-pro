export function updatePrizeName(prizes, index, name) {
  if (!Array.isArray(prizes)) return [];
  return prizes.map((prize, prizeIndex) => prizeIndex === index
    ? { ...prize, name }
    : prize);
}
