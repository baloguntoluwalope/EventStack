import { Injectable } from '@nestjs/common';

@Injectable()
export class SlugService {
  slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async resolveUnique(
    base: string,
    isTaken: (candidate: string) => Promise<boolean>,
  ): Promise<string> {
    const baseSlug = this.slugify(base);
    let candidate = baseSlug;
    let suffix = 1;

    while (await isTaken(candidate)) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
    return candidate;
  }
}