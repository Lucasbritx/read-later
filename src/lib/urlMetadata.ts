export type ArticleDraft = {
  url: string;
  title: string;
  description: string;
  site_name: string;
};

const invalidUrlMessage = 'Enter a valid article URL.';

export function normalizeUrl(value: string): string {
  const trimmedValue = value.trim();
  const urlWithProtocol = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const url = new URL(urlWithProtocol);

    if (!url.hostname.includes('.')) {
      throw new Error(invalidUrlMessage);
    }

    return url.toString();
  } catch {
    throw new Error(invalidUrlMessage);
  }
}

export function buildArticleDraft(value: string): ArticleDraft {
  const url = normalizeUrl(value);
  const hostname = new URL(url).hostname;
  const host = hostname.replace(/^www\./i, '');

  return {
    url,
    title: host,
    description: '',
    site_name: host
  };
}
