export function buildWinnerSlides(winnersHistory) {
  if (!Array.isArray(winnersHistory)) return [];

  return winnersHistory.flatMap((group, prizeIndex) => {
    if (!group || !Array.isArray(group.tickets)) return [];
    const prize = typeof group.prize === 'string' && group.prize.trim()
      ? group.prize.trim()
      : `Prize ${prizeIndex + 1}`;

    return group.tickets.map((ticket, ticketIndex) => ({
      id: `${prizeIndex}-${ticketIndex}-${String(ticket)}`,
      prize,
      winner: String(ticket),
      prizeIndex,
      ticketIndex,
    }));
  });
}
