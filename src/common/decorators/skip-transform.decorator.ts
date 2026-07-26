import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Marks a route as returning raw content (XML, plain text, binary) that
 * must NOT be wrapped in the standard { success, data, timestamp } envelope.
 * Used for sitemap.xml, robots.txt, and any future non-JSON response.
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);