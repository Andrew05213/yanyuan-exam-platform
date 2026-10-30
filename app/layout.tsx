import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "燕园备考 · 六校模拟与口试",
  description: "六校保送备考空间：六校训练模板、笔试组卷、口试题库与云端档案。",
  icons: { icon: "/assets/mark.svg" },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
