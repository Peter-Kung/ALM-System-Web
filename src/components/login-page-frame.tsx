import React, { ReactNode } from "react";

export function LoginPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="login-layout">
      <section className="login-panel stack" aria-label="Owner sign in panel">
        {children}
      </section>
    </div>
  );
}
