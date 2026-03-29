import { Inter } from "next/font/google";
import "./globals.css";
import ChatWidget from '../components/ChatWidget';

// This defines the font variable that was missing
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Action League",
  description: "Private Betting League",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}