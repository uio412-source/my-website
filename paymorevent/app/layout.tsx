import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./responsive.css";
import "./customer-update.css";
import "./customer.css";
import "./database.css";
import "./issuer-ui.css";

export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover"};

export const metadata: Metadata = {
  title: "Paymorevent 페이모먼트 | 카드와 여행의 모든 혜택",
  description: "국내 신용·체크카드와 카드사·호텔 이벤트를 혜택 해시태그로 찾으세요. 연회비, 전월실적, 제외 조건과 공식 상품설명서를 한곳에서 확인합니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
