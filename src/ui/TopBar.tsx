import { Button } from "./ds";

// Signed-in account and logout, top right of every screen after login.
export function TopBar({
  email,
  onLogout,
}: {
  email: string;
  onLogout: () => void;
}) {
  return (
    <div className="topbar">
      <span className="topbar-email">{email}</span>
      <Button variant="ghost" size="sm" iconLeft="log-out" onClick={onLogout}>
        ログアウト
      </Button>
    </div>
  );
}
