// Load .env for scripts run outside Next.js (worker, CLI tools).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
