import ForgotPasswordPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Forgot Password - Just Easy",
  description: "Reset your account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageContent />;
}
