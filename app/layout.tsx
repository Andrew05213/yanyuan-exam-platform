import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "和知 AI｜日本研究与保送训练平台",
  description: "禹哲的私人保送备考空间：六校训练模板、笔试组卷、口试题库与云端档案。",
  icons: { icon: "/assets/mark.svg" },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
