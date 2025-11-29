import { ethers } from "ethers";
import { config } from "@/config/env";

// Provider for Monad network
export const provider = new ethers.JsonRpcProvider(config.monad.rpcUrl);

// Backend wallet for signing transactions
export const getBackendWallet = () => {
  if (!config.wallet.privateKey) {
    throw new Error("BACKEND_WALLET_PRIVATE_KEY not configured");
  }
  return new ethers.Wallet(config.wallet.privateKey, provider);
};

// Contract ABIs (these would normally be generated from compiled contracts)
// For now, we'll define minimal ABIs needed for interactions

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

export const REWARD_DISTRIBUTOR_ABI = [
  "function airdrop(address token, address[] recipients, uint256[] amounts) returns (bool)",
  "function airdropEqual(address token, address[] recipients, uint256 amount) returns (bool)",
  "event AirdropExecuted(address indexed token, uint256 recipientCount, uint256 totalAmount)",
];

export const VENDOR_REGISTRY_ABI = [
  "function registerVendor(address vendorAddress, string memory businessName) returns (bool)",
  "function isVendor(address vendorAddress) view returns (bool)",
  "function getVendorInfo(address vendorAddress) view returns (string memory, uint256)",
  "event VendorRegistered(address indexed vendor, string businessName)",
];

export const ENS_REGISTRAR_ABI = [
  "function registerSubdomain(string memory label, address owner) returns (bool)",
  "function setSubnodeRecord(bytes32 parentNode, string memory label, address owner, address resolver, uint64 ttl) returns (bytes32)",
  "function setResolver(bytes32 node, address resolver) returns (void)",
  "event NewSubdomain(bytes32 indexed node, address indexed owner, string label)",
];

// Helper to get contract instance
export const getContract = (address: string, abi: any[]) => {
  return new ethers.Contract(address, abi, provider);
};

// Helper to get contract instance with signer
export const getContractWithSigner = (address: string, abi: any[]) => {
  const wallet = getBackendWallet();
  return new ethers.Contract(address, abi, wallet);
};

// Helper to wait for transaction confirmation
export const waitForTransaction = async (txHash: string) => {
  const receipt = await provider.waitForTransaction(txHash);
  return receipt;
};

