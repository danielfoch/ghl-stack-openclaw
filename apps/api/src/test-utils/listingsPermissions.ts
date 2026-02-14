export function canUpdateListingPrice(params: { sellerAgentId: string; actorAgentId: string }): boolean {
  return params.sellerAgentId === params.actorAgentId;
}
