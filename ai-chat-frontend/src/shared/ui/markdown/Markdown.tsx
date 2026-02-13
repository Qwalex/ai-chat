'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const escapeHtml = (value: string): string =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const Markdown = ({ content }: { content: string }) => {
  const html = useMemo(() => {
    if (typeof marked.parse !== 'function') {
      return escapeHtml(content).replaceAll('\n', '<br />');
    }
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [content]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
};
