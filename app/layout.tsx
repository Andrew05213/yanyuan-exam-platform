import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "博雅怀石",
  description: "日本文学研习、读书笔记与高校保送训练。",
  icons: { icon: "/assets/mark.svg" },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
