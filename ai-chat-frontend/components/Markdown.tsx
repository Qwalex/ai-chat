'use client';

import { useMemo } from 'react';
import { marked } from 'marked';

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
    return marked.parse(content, { async: false }) as string;
  }, [content]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
};
