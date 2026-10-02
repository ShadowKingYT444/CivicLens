let pendingClaim = "";

export function setPendingClaim(claim: string) {
  pendingClaim = claim;
}

export function peekPendingClaim() {
  return pendingClaim;
}

export function takePendingClaim() {
  const claim = pendingClaim;
  pendingClaim = "";
  return claim;
}
