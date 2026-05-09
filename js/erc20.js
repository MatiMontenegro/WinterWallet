// Minimal ERC-20 helpers. Uses the standard interface — works with USDC,
// USDT, DAI, and any other compliant token.

import { ethers } from "https://esm.sh/ethers@6.13.5";
import { getProvider, getSigner, getCachedAddress } from "./wallet.js";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export function readContract(address) {
  return new ethers.Contract(address, ERC20_ABI, getProvider());
}

export function writeContract(address) {
  return new ethers.Contract(address, ERC20_ABI, getSigner());
}

export async function getTokenBalance(tokenAddress, owner) {
  const c = readContract(tokenAddress);
  const [decimals, raw] = await Promise.all([
    c.decimals(),
    c.balanceOf(owner ?? getCachedAddress()),
  ]);
  return { raw, decimals: Number(decimals), formatted: ethers.formatUnits(raw, decimals) };
}

export async function getTokenMeta(tokenAddress) {
  const c = readContract(tokenAddress);
  const [name, symbol, decimals] = await Promise.all([
    c.name().catch(() => ""),
    c.symbol().catch(() => "???"),
    c.decimals().catch(() => 18),
  ]);
  return { name, symbol, decimals: Number(decimals) };
}

export async function sendToken(tokenAddress, to, amount, decimals) {
  if (!ethers.isAddress(to)) throw new Error("Invalid recipient address.");
  const c = writeContract(tokenAddress);
  const value = ethers.parseUnits(String(amount), decimals);
  return c.transfer(to, value);
}
