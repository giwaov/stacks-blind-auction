"use client";

import { useState, useEffect, useCallback } from "react";
import { useStacks } from "@/context/StacksContext";

interface Auction {
  id: number;
  creator: string;
  itemName: string;
  itemDescription: string;
  minBid: number;
  commitEndBlock: number;
  revealEndBlock: number;
  highestBid: number;
  highestBidder: string | null;
  claimed: boolean;
}

// Colors
const colors = {
  primary: "#5546FF",
  primaryDark: "#4338CA",
  primaryLight: "#818CF8",
  secondary: "#FC6432",
  dark: "#0F0F23",
  surface: "#1A1A2E",
  surfaceLight: "#252542",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

export default function Home() {
  const {
    isConnected,
    address,
    connect,
    disconnect,
    createAuction,
    submitSealedBid,
    revealBid,
    claimPrize,
    withdrawDeposit,
    getAuction,
    getAuctionCount,
    hashBid,
  } = useStacks();

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "create" | "mybids">("browse");
  
  // Create auction form
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [minBid, setMinBid] = useState("");
  const [commitDuration, setCommitDuration] = useState("100");
  const [revealDuration, setRevealDuration] = useState("50");
  
  // Bid form
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidSalt, setBidSalt] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  
  // Stored bids (for reveal)
  const [storedBids, setStoredBids] = useState<Record<number, { amount: string; salt: string }>>({});

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const count = await getAuctionCount();
      const auctionList: Auction[] = [];
      
      for (let i = 0; i < count; i++) {
        const auction = await getAuction(i);
        if (auction) {
          auctionList.push(auction);
        }
      }
      
      setAuctions(auctionList);
    } catch (error) {
      console.error("Error fetching auctions:", error);
    }
    setLoading(false);
  }, [getAuction, getAuctionCount]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    
    try {
      await createAuction(
        itemName,
        itemDescription,
        parseFloat(minBid),
        parseInt(commitDuration),
        parseInt(revealDuration)
      );
      setItemName("");
      setItemDescription("");
      setMinBid("");
    } catch (error) {
      console.error("Error creating auction:", error);
    }
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuction || !isConnected) return;
    
    try {
      // Store bid locally for later reveal
      setStoredBids(prev => ({
        ...prev,
        [selectedAuction.id]: { amount: bidAmount, salt: bidSalt }
      }));
      
      await submitSealedBid(
        selectedAuction.id,
        parseFloat(bidAmount),
        bidSalt,
        parseFloat(depositAmount)
      );
      
      setBidAmount("");
      setBidSalt("");
      setDepositAmount("");
      setSelectedAuction(null);
    } catch (error) {
      console.error("Error submitting bid:", error);
    }
  };

  const handleRevealBid = async (auctionId: number) => {
    const stored = storedBids[auctionId];
    if (!stored) {
      alert("No stored bid found for this auction");
      return;
    }
    
    try {
      await revealBid(auctionId, parseFloat(stored.amount), stored.salt);
    } catch (error) {
      console.error("Error revealing bid:", error);
    }
  };

  const generateSalt = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
          >
            ⚡
          </div>
          <div>
            <h1 className="text-2xl font-bold">Stacks Blind Auction</h1>
            <p className="text-sm text-gray-400">Sealed-bid auctions on Bitcoin L2</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isConnected ? (
            <>
              <div className="px-4 py-2 rounded-lg" style={{ background: colors.surface }}>
                <span className="text-sm text-gray-400">Connected:</span>
                <span className="ml-2 font-mono">{truncateAddress(address || "")}</span>
              </div>
              <button
                onClick={disconnect}
                className="px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-400 transition"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              className="px-6 py-2 rounded-lg font-semibold transition"
              style={{ 
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["browse", "create", "mybids"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-6 py-2 rounded-lg font-medium transition"
            style={{
              background: activeTab === tab ? colors.primary : colors.surface,
              opacity: activeTab === tab ? 1 : 0.7,
            }}
          >
            {tab === "browse" ? "Browse Auctions" : tab === "create" ? "Create Auction" : "My Bids"}
          </button>
        ))}
        <button
          onClick={fetchAuctions}
          className="ml-auto px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-400 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "browse" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              Loading auctions...
            </div>
          ) : auctions.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-400 mb-4">No auctions found</p>
              <button
                onClick={() => setActiveTab("create")}
                style={{ color: colors.primary }}
                className="hover:underline"
              >
                Create the first auction →
              </button>
            </div>
          ) : (
            auctions.map((auction) => (
              <div
                key={auction.id}
                className="p-6 rounded-xl border border-gray-700"
                style={{ background: colors.surface }}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{auction.itemName}</h3>
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ 
                      background: auction.claimed 
                        ? colors.success + "20" 
                        : colors.warning + "20",
                      color: auction.claimed ? colors.success : colors.warning
                    }}
                  >
                    {auction.claimed ? "Ended" : "Active"}
                  </span>
                </div>
                
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {auction.itemDescription || "No description"}
                </p>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min Bid:</span>
                    <span className="font-mono">{auction.minBid} STX</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Highest Bid:</span>
                    <span className="font-mono">{auction.highestBid} STX</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Creator:</span>
                    <span className="font-mono text-xs">{truncateAddress(auction.creator)}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedAuction(auction)}
                    className="flex-1 py-2 rounded-lg font-medium transition hover:opacity-90"
                    style={{ background: colors.primary }}
                    disabled={!isConnected}
                  >
                    Place Bid
                  </button>
                  {storedBids[auction.id] && (
                    <button
                      onClick={() => handleRevealBid(auction.id)}
                      className="px-4 py-2 rounded-lg font-medium transition hover:opacity-90"
                      style={{ background: colors.secondary }}
                    >
                      Reveal
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "create" && (
        <div 
          className="max-w-lg mx-auto p-6 rounded-xl border border-gray-700"
          style={{ background: colors.surface }}
        >
          <h2 className="text-xl font-semibold mb-6">Create New Auction</h2>
          
          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Connect your wallet to create an auction</p>
              <button
                onClick={connect}
                className="px-6 py-2 rounded-lg font-semibold transition"
                style={{ background: colors.primary }}
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateAuction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Item Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none"
                  placeholder="e.g., Rare NFT Collection"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none min-h-24"
                  placeholder="Describe your item..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Minimum Bid (STX)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={minBid}
                  onChange={(e) => setMinBid(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none"
                  placeholder="10"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Commit Duration (blocks)</label>
                  <input
                    type="number"
                    value={commitDuration}
                    onChange={(e) => setCommitDuration(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Reveal Duration (blocks)</label>
                  <input
                    type="number"
                    value={revealDuration}
                    onChange={(e) => setRevealDuration(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full py-3 rounded-lg font-semibold transition hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
              >
                Create Auction
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === "mybids" && (
        <div 
          className="max-w-2xl mx-auto p-6 rounded-xl border border-gray-700"
          style={{ background: colors.surface }}
        >
          <h2 className="text-xl font-semibold mb-6">My Stored Bids</h2>
          
          {Object.keys(storedBids).length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No bids stored. Place a bid to see it here.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(storedBids).map(([auctionId, bid]) => (
                <div 
                  key={auctionId}
                  className="p-4 rounded-lg border border-gray-600"
                  style={{ background: colors.surfaceLight }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Auction #{auctionId}</p>
                      <p className="text-sm text-gray-400">
                        Bid: {bid.amount} STX | Salt: {bid.salt.slice(0, 8)}...
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevealBid(parseInt(auctionId))}
                      className="px-4 py-2 rounded-lg font-medium transition hover:opacity-90"
                      style={{ background: colors.secondary }}
                    >
                      Reveal Bid
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bid Modal */}
      {selectedAuction && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setSelectedAuction(null)}
        >
          <div 
            className="max-w-md w-full mx-4 p-6 rounded-xl border border-gray-700"
            style={{ background: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-2">Place Sealed Bid</h2>
            <p className="text-gray-400 text-sm mb-6">
              Bidding on: {selectedAuction.itemName}
            </p>
            
            <form onSubmit={handleSubmitBid} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Bid Amount (STX)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none"
                  placeholder={`Min: ${selectedAuction.minBid} STX`}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Secret Salt
                  <button
                    type="button"
                    onClick={() => setBidSalt(generateSalt())}
                    className="ml-2 text-xs px-2 py-1 rounded"
                    style={{ background: colors.surfaceLight }}
                  >
                    Generate
                  </button>
                </label>
                <input
                  type="text"
                  value={bidSalt}
                  onChange={(e) => setBidSalt(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none font-mono text-sm"
                  placeholder="Your secret salt (save this!)"
                  required
                />
                <p className="text-xs text-yellow-400 mt-1">
                  ⚠️ Save this salt! You'll need it to reveal your bid.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Deposit Amount (STX)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-transparent focus:border-indigo-500 outline-none"
                  placeholder="Must be >= bid amount"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Deposit is returned after auction ends (minus winning bid if you win)
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAuction(null)}
                  className="flex-1 py-3 rounded-lg font-medium border border-gray-600 hover:border-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg font-semibold transition hover:opacity-90"
                  style={{ background: colors.primary }}
                >
                  Submit Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-gray-700 text-center text-gray-400 text-sm">
        <p>Built with @stacks/connect & @stacks/transactions on Stacks</p>
        <p className="mt-1">Stacks Builder Rewards February 2026</p>
      </footer>
    </main>
  );
}
