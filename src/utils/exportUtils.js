export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, rows) {
  const csvContent = rows
    .map(row =>
      row.map(cell => {
        const str = String(cell == null ? '' : cell);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',')
    )
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildWinnersCsvRows(winnersHistory) {
  const rows = [['Prize', 'Winner', 'Draw Order']];
  winnersHistory.forEach((group, groupIndex) => {
    group.tickets.forEach(ticket => {
      rows.push([group.prize, ticket, groupIndex + 1]);
    });
  });
  return rows;
}

export function buildAuditLogCsvRows(auditLog) {
  const rows = [['Timestamp', 'Mode', 'Context', 'Selected', 'Remaining Count']];
  auditLog.forEach(entry => {
    rows.push([
      entry.timestamp,
      entry.mode,
      entry.context,
      entry.selected.join('; '),
      entry.remainingCount ?? '',
    ]);
  });
  return rows;
}

export function buildAssignmentCsvRows(lastAssignmentResult) {
  if (!lastAssignmentResult) return [];
  if (lastAssignmentResult.mode === 'team-divider') {
    const rows = [['Team', 'Member']];
    lastAssignmentResult.teams.forEach(team => {
      team.members.forEach(member => {
        rows.push([team.teamName, member]);
      });
    });
    return rows;
  }
  if (lastAssignmentResult.mode === 'role-selector') {
    const rows = [['Role', 'Participant']];
    lastAssignmentResult.assignments.forEach(assignment => {
      assignment.participants.forEach(participant => {
        rows.push([assignment.role, participant]);
      });
    });
    return rows;
  }
  return [];
}
