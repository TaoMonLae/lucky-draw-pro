const shuffle = (items, random = Math.random) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export function divideIntoTeams(participants = [], teamCount = 2, random = Math.random) {
  const safeTeamCount = Math.max(1, Math.min(teamCount, participants.length || 1));
  const teams = Array.from({ length: safeTeamCount }, (_, index) => ({
    teamName: `Team ${index + 1}`,
    members: [],
  }));

  const shuffled = shuffle(participants, random);
  shuffled.forEach((participant, index) => {
    teams[index % safeTeamCount].members.push(participant);
  });

  return teams;
}

export function assignRoles(participants = [], roleRules = [], options = {}, random = Math.random) {
  const { allowMultipleRoles = false } = options;
  const shuffled = shuffle(participants, random);
  const assignments = [];
  const used = new Set();
  let cursor = 0;

  roleRules.forEach(({ name, count }) => {
    const roleName = String(name || '').trim();
    const roleCount = Math.max(0, Number.parseInt(count, 10) || 0);
    if (!roleName || roleCount < 1) return;

    const picked = [];
    for (let i = 0; i < roleCount; i += 1) {
      if (allowMultipleRoles) {
        if (shuffled.length === 0) break;
        const participant = shuffled[cursor % shuffled.length];
        cursor += 1;
        picked.push(participant);
        continue;
      }

      while (cursor < shuffled.length && used.has(shuffled[cursor])) {
        cursor += 1;
      }

      if (cursor >= shuffled.length) break;
      const participant = shuffled[cursor];
      used.add(participant);
      picked.push(participant);
      cursor += 1;
    }

    assignments.push({ role: roleName, participants: picked });
  });

  return assignments;
}

export function getNoRepeatSet(history = []) {
  const seen = new Set();
  history.forEach((entry) => {
    (entry.selected || []).forEach((item) => seen.add(item));
  });
  return seen;
}

export function createAuditEntry({ mode, context, selected, remainingCount }) {
  return {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    mode,
    context,
    selected,
    remainingCount,
  };
}
