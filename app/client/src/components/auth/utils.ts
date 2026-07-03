const disposableDomains: string[] = [
  'aminating.com',
  'mailshan.com',
  'pixoledge.net',
  'draughtier.com',
  'imfaya.com',
  'fxzig.com',
  'gopicta.com',
  'denipl.com',
  'forexzig.com',
  'eubonus.com'
];

/**
 * Checks if an email address uses a disposable email domain
 * @param email - The email address to check
 * @returns true if the email domain is disposable, false otherwise
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Extract domain from email
  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const domain = parts[1].toLowerCase().trim();

  // Check if domain is in the disposable domains list
  return disposableDomains.includes(domain);
}
