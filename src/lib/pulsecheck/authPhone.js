function normalizeAuthPhone(value) {
  const phone = String(value).trim().replace(/[\s().-]/g, '');
  const national = phone.replace(/^\+?1(?=\d{10}$)/, '');
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new Error('Enter a valid 10-digit US or Canadian phone number.');
  return `+1${national}`;
}
module.exports = { normalizeAuthPhone };
