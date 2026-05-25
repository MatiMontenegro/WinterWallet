// Returns formatted token balance for the active address. Polls every 15s.

import { useReadContract } from "wagmi";
import { erc20Abi, formatUnits, type Address } from "viem";

export function useTokenBalance(token: Address | undefined, owner: Address | undefined, decimals: number) {
  const balance = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: {
      enabled: Boolean(token && owner),
      refetchInterval: 15_000,
    },
  });

  const raw = balance.data as bigint | undefined;
  const formatted = raw != null ? formatUnits(raw, decimals) : "0";

  return {
    raw,
    formatted,
    isLoading: balance.isLoading,
    error: balance.error,
    refetch: balance.refetch,
  };
}
