import { AuthView } from "@neondatabase/auth/react";
import { useParams } from "react-router-dom";
import "./auth.css";

export default function AuthPage() {
  const { path = "sign-in" } = useParams();

  return (
    <main className="auth-shell">
      <div className="auth-brand"><span>CELEB</span>STOCKZ</div>
      <section className="auth-card">
        <p className="auth-eyebrow">STKZ ACCESS</p>
        <AuthView
          path={path}
          redirectTo="/"
          credentials={{ forgotPassword: true }}
        />
      </section>
    </main>
  );
}