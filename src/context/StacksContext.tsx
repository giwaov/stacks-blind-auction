"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { AppConfig, UserSession, showConnect, openContractCall } from "@stacks/connect";
import { StacksTestnet, StacksMainnet } from "@stacks/network";
import {
  uintCV,
  stringAsciiCV,
  stringUtf8CV,
  bufferCV,
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  callReadOnlyFunction,
  cvToJSON,
} from "@stacks/transactions";

// Contract details - update after deployment
const CONTRACT_ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"; // Replace with your address
const CONTRACT_NAME = "blind-auction";

// App config
const appConfig = new AppConfig(["store_write", "publish_data"]);

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

interface StacksContextType {
  userSession: UserSession;
  userData: any;
  isConnected: boolean;
  address: string | null;
  network: any;
  connect: () => void;
  disconnect: () => void;
  createAuction: (itemName: string, description: string, minBid: number, commitDuration: number, revealDuration: number) => Promise<any>;
  submitSealedBid: (auctionId: number, bidAmount: number, salt: string, deposit: number) => Promise<any>;
  revealBid: (auctionId: number, bidAmount: number, salt: string) => Promise<any>;
  claimPrize: (auctionId: number) => Promise<any>;
  withdrawDeposit: (auctionId: number) => Promise<any>;
  getAuction: (auctionId: number) => Promise<Auction | null>;
  getAuctionCount: () => Promise<number>;
  hashBid: (bidAmount: number, salt: string) => string;
}

const StacksContext = createContext<StacksContextType | undefined>(undefined);

export function StacksProvider({ children }: { children: ReactNode }) {
  const [userSession] = useState(() => new UserSession({ appConfig }));
  const [userData, setUserData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  
  // Use testnet for development
  const network = new StacksTestnet();

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const data = userSession.loadUserData();
      setUserData(data);
      setIsConnected(true);
      setAddress(data.profile.stxAddress.testnet);
    }
  }, [userSession]);

  const connect = useCallback(() => {
    showConnect({
      appDetails: {
        name: "Stacks Blind Auction",
        icon: window.location.origin + "/logo.png",
      },
      redirectTo: "/",
      onFinish: () => {
        const data = userSession.loadUserData();
        setUserData(data);
        setIsConnected(true);
        setAddress(data.profile.stxAddress.testnet);
      },
      userSession,
    });
  }, [userSession]);

  const disconnect = useCallback(() => {
    userSession.signUserOut();
    setUserData(null);
    setIsConnected(false);
    setAddress(null);
  }, [userSession]);

  const hashBid = useCallback((bidAmount: number, salt: string): string => {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${bidAmount}${salt}`);
    // In production, use proper sha256 from @stacks/transactions
    return Buffer.from(data).toString('hex').slice(0, 64);
  }, []);

  const createAuction = useCallback(async (
    itemName: string,
    description: string,
    minBid: number,
    commitDuration: number,
    revealDuration: number
  ) => {
    return openContractCall({
      network,
      anchorMode: AnchorMode.Any,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "create-auction",
      functionArgs: [
        stringAsciiCV(itemName),
        stringUtf8CV(description),
        uintCV(minBid * 1000000), // Convert to microSTX
        uintCV(commitDuration),
        uintCV(revealDuration),
      ],
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data) => {
        console.log("Auction created:", data);
      },
      onCancel: () => {
        console.log("Transaction cancelled");
      },
    });
  }, [network]);

  const submitSealedBid = useCallback(async (
    auctionId: number,
    bidAmount: number,
    salt: string,
    deposit: number
  ) => {
    const commitHash = hashBid(bidAmount, salt);
    
    return openContractCall({
      network,
      anchorMode: AnchorMode.Any,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "submit-sealed-bid",
      functionArgs: [
        uintCV(auctionId),
        bufferCV(Buffer.from(commitHash, 'hex')),
        uintCV(deposit * 1000000), // Convert to microSTX
      ],
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data) => {
        console.log("Bid submitted:", data);
      },
      onCancel: () => {
        console.log("Transaction cancelled");
      },
    });
  }, [network, hashBid]);

  const revealBid = useCallback(async (
    auctionId: number,
    bidAmount: number,
    salt: string
  ) => {
    return openContractCall({
      network,
      anchorMode: AnchorMode.Any,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "reveal-bid",
      functionArgs: [
        uintCV(auctionId),
        uintCV(bidAmount * 1000000),
        bufferCV(Buffer.from(salt)),
      ],
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data) => {
        console.log("Bid revealed:", data);
      },
      onCancel: () => {
        console.log("Transaction cancelled");
      },
    });
  }, [network]);

  const claimPrize = useCallback(async (auctionId: number) => {
    return openContractCall({
      network,
      anchorMode: AnchorMode.Any,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "claim-prize",
      functionArgs: [uintCV(auctionId)],
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data) => {
        console.log("Prize claimed:", data);
      },
      onCancel: () => {
        console.log("Transaction cancelled");
      },
    });
  }, [network]);

  const withdrawDeposit = useCallback(async (auctionId: number) => {
    return openContractCall({
      network,
      anchorMode: AnchorMode.Any,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "withdraw-deposit",
      functionArgs: [uintCV(auctionId)],
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data) => {
        console.log("Deposit withdrawn:", data);
      },
      onCancel: () => {
        console.log("Transaction cancelled");
      },
    });
  }, [network]);

  const getAuction = useCallback(async (auctionId: number): Promise<Auction | null> => {
    try {
      const result = await callReadOnlyFunction({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "get-auction",
        functionArgs: [uintCV(auctionId)],
        senderAddress: CONTRACT_ADDRESS,
      });
      
      const json = cvToJSON(result);
      if (!json.value) return null;
      
      const auction = json.value.value;
      return {
        id: auctionId,
        creator: auction.creator.value,
        itemName: auction["item-name"].value,
        itemDescription: auction["item-description"].value,
        minBid: parseInt(auction["min-bid"].value) / 1000000,
        commitEndBlock: parseInt(auction["commit-end-block"].value),
        revealEndBlock: parseInt(auction["reveal-end-block"].value),
        highestBid: parseInt(auction["highest-bid"].value) / 1000000,
        highestBidder: auction["highest-bidder"].value?.value || null,
        claimed: auction.claimed.value,
      };
    } catch (error) {
      console.error("Error fetching auction:", error);
      return null;
    }
  }, [network]);

  const getAuctionCount = useCallback(async (): Promise<number> => {
    try {
      const result = await callReadOnlyFunction({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "get-auction-count",
        functionArgs: [],
        senderAddress: CONTRACT_ADDRESS,
      });
      
      const json = cvToJSON(result);
      return parseInt(json.value);
    } catch (error) {
      console.error("Error fetching auction count:", error);
      return 0;
    }
  }, [network]);

  return (
    <StacksContext.Provider
      value={{
        userSession,
        userData,
        isConnected,
        address,
        network,
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
      }}
    >
      {children}
    </StacksContext.Provider>
  );
}

export function useStacks() {
  const context = useContext(StacksContext);
  if (context === undefined) {
    throw new Error("useStacks must be used within a StacksProvider");
  }
  return context;
}
