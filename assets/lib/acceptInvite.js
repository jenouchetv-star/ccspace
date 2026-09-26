// Chike's Creative Space - admin accept-invite validation
//
// The flow that gets somebody in, through to the point they have an
// account: an invited admin follows the link Supabase's own invite email
// sent them, lands on #/admin/accept-invite, and sets a password. This is
// the one deterministic gate in that flow - the check that decides
// whether the app even attempts the network calls (sb.auth.updateUser(),
// then the accept_invite RPC that flips their profile to "active") that
// actually create the account, or stops short with a message instead.
//
// Deliberately not testing the network calls themselves: those need a
// real Supabase project, which is exactly what this test suite is meant
// to run without. This gate is what's worth protecting with a test - if
// it ever stopped rejecting a too-short or mismatched password, a
// half-set-up account could reach the server, not just fail cleanly in
// the browser.

export function validateNewPassword(password, confirmPassword) {
  if (password.length < 8) return "Password needs to be at least 8 characters.";
  if (password !== confirmPassword) return "Passwords don't match.";
  return null;
}
