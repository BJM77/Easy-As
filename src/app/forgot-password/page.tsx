import ForgotPasswordPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Forgot Password - Freight assist.online",
  description: "Reset your account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageContent />;
}
