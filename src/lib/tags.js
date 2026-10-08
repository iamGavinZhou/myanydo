/** Tag = "{TAG_SET_NAME}:{TAG}", e.g. priority:low, scene:work */

export function parseTag(tag) {
  const i = tag.indexOf(':');
  if (i < 0) return { set: tag, value: '' };
  return { set: tag.slice(0, i), value: tag.slice(i + 1) };
}

export function makeTag(set, value) {
  return `${set.trim()}:${value.trim()}`;
}

export function isValidTag(tag) {
  return /^[^:\s]+:[^:\s]+$/.test(tag);
}

const PALETTE = [
  { bg: '#FBE9E1', fg: '#B23A17', dot: '#E4572E' }, // vermilion
  { bg: '#E8F0E7', fg: '#41704C', dot: '#7C9A82' }, // sage
  { bg: '#E4EDF4', fg: '#2C5372', dot: '#3E6C8E' }, // blue
  { bg: '#FAEFD9', fg: '#8A6414', dot: '#D9A441' }, // gold
  { bg: '#F2E7E8', fg: '#7E4348', dot: '#A26769' }, // rosewood
  { bg: '#E9EBF1', fg: '#454F68', dot: '#6B7A8F' }, // slate
  { bg: '#F4EAD9', fg: '#7A5533', dot: '#B0845A' }, // caramel
  { bg: '#E7F0EE', fg: '#2F6B62', dot: '#4F9C8E' }  // teal
];

export function tagColors(tag) {
  const { set } = parseTag(tag);
  let h = 0;
  for (let i = 0; i < set.length; i++) h = (h * 31 + set.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
