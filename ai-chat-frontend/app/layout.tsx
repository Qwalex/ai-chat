import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI онлайн бесплатно — ИИ онлайн, множество моделей | Чат с ИИ',
  description:
    'ИИ онлайн бесплатно: веб‑чат с выбором множества нейросетей — Kimi, DeepSeek, Qwen, GPT, Mistral и другие. AI онлайн без регистрации.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
        <link rel="shortcut icon" href="/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
