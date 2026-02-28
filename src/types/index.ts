export interface Auction {
  seller: string;
  item: string;
  minBid: number;
  startBlock: number;
  endBlock: number;
  status: 'active' | 'revealing' | 'settled' | 'cancelled';
  bidCount: number;
}

export interface Bid {
  bidder: string;
  auctionId: number;
  commitment: string;
  revealed: boolean;
  amount?: number;
}

export interface AuctionStats {
  totalAuctions: number;
  activeAuctions: number;
  totalVolume: number;
}

export interface WalletState {
  address: string | null;
  connected: boolean;
  balance: number;
}

export interface TransactionResult {
  txId: string;
  success: boolean;
  error?: string;
}
