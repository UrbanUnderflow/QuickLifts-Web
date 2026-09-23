/** Date unsigned instruments without changing historical agreements or vesting dates. */
export function dateEdnaInstrument(content: string): string {
  let result = content.replace(/^(Document date: )[^\n]+\n\n/m, '');
  result = result.replace(/^([^\n]+)\n/, '$1\n\nDocument date: September 23, 2026\n');
  result = result.replace('The agreed grant-reference date and Vesting Commencement Date are September 11, 2026.', 'The grant-reference date is September 23, 2026. The Vesting Commencement Date remains September 11, 2026.');
  result = result.replace('Grant-reference and vesting commencement date: September 11, 2026.', 'Grant-reference date: September 23, 2026.\nVesting commencement date: September 11, 2026.');
  result = result.replace(/(issued as of )September (?:9|11|12),\s*2026/gi, '$1September 23, 2026');
  result = result.replace(/(issued and effective as of )September (?:9|11|12),\s*2026/gi, '$1September 23, 2026');
  return result;
}
