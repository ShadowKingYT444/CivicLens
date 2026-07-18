let pendingClaim = "";

export function setPendingClaim(claim: string) {
  pendingClaim = claim;
}

export function takePendingClaim() {
  const claim = pendingClaim;
  pendingClaim = "";
  return claim;
}
