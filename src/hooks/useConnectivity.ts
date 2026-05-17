import { useState, useEffect } from "react";
import {
  getConnectivity,
  subscribeToConnectivity,
  type ConnectivityState,
} from "@/reliability/connectivity";

export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>(getConnectivity);
  useEffect(() => subscribeToConnectivity(setState), []);
  return state;
}
