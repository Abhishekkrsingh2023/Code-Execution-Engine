import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata = {
  title: "Code0 Staff Control Center — Admin & Moderator Portal",
  description: "Unified administrative telemetry, problem management, user governance, and audit operations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="ambient-glow-top" aria-hidden="true" />
        <div className="ambient-glow-bottom" aria-hidden="true" />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
