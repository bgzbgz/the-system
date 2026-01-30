/**
 * Slug Generator Utility
 * Spec: 016-backend-api
 *
 * Generate URL-safe identifiers for jobs and tools
 */

/**
 * Generate a URL-safe slug from a string
 *
 * Rules:
 * - Lowercase
 * - Replace spaces with hyphens
 * - Remove special characters except hyphens
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 * - Max length 100 characters
 *
 * @param input - The string to convert to a slug
 * @returns URL-safe slug
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove characters that aren't alphanumeric or hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Collapse multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-|-$/g, '')
    // Limit length
    .slice(0, 100);
}

/**
 * Generate a unique slug by appending a random suffix
 *
 * @param input - The string to convert to a slug
 * @param suffix - Optional custom suffix (default: random 6 chars)
 * @returns URL-safe unique slug
 */
export function generateUniqueSlug(input: string, suffix?: string): string {
  const baseSlug = generateSlug(input);
  const uniqueSuffix = suffix || generateRandomSuffix(6);

  // Combine with hyphen, ensuring max length
  const combined = `${baseSlug}-${uniqueSuffix}`;
  return combined.slice(0, 100);
}

/**
 * Generate a random alphanumeric suffix
 *
 * @param length - Length of the suffix
 * @returns Random alphanumeric string
 */
export function generateRandomSuffix(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate that a string is a valid slug
 *
 * @param slug - The slug to validate
 * @returns true if valid slug format
 */
export function isValidSlug(slug: string): boolean {
  // Must be lowercase alphanumeric with hyphens only
  // No leading/trailing hyphens, no consecutive hyphens
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length <= 100;
}

/**
 * Generate a slug from a file name (removing extension)
 *
 * @param fileName - The file name to convert
 * @returns URL-safe slug based on file name
 */
export function slugFromFileName(fileName: string): string {
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  return generateSlug(nameWithoutExt);
}
