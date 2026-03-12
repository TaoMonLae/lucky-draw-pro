export function parseEntries(inputValue, drawMode) {
  if (drawMode !== 'numbers') {
    return { entries: Array.from(new Set(inputValue.split(',').map((s) => s.trim()).filter(Boolean))) };
  }

  const input = inputValue.trim();
  if (input.includes('-') && !input.includes(',')) {
    const parts = input.split('-').map((p) => p.trim());
    if (parts.length !== 2) return { error: 'Invalid range format. Please use "start-end".' };
    const [startStr, endStr] = parts;
    const startNum = parseInt(startStr, 10);
    const endNum = parseInt(endStr, 10);
    if (Number.isNaN(startNum) || Number.isNaN(endNum) || startNum >= endNum) return { error: 'Invalid range. Start must be less than end.' };
    const padding = startStr.length;
    if (padding > 10) return { error: 'Ticket numbers cannot exceed 10 digits.' };
    if (endNum - startNum + 1 > 40000) return { error: 'Range is too large. Please use a range of 40,000 tickets or less.' };
    return { entries: Array.from({ length: endNum - startNum + 1 }, (_, i) => String(startNum + i).padStart(padding, '0')) };
  }

  return { entries: Array.from(new Set(inputValue.split(',').map((s) => s.trim()).filter(Boolean))) };
}
