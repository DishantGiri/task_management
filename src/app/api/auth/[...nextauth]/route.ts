import dns from "node:dns";
import net from "node:net";
import { handlers } from "@/lib/auth";

try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof net.setDefaultAutoSelectFamily === "function") {
    net.setDefaultAutoSelectFamily(false);
  }
} catch {
  // Ignore if unsupported
}

export const { GET, POST } = handlers;
