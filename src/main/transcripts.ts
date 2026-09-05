import type { TokenTotals, UsageRecord } from "../shared/types";
import { totalTokens } from "../shared/tokenMath";

function positiveInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export interface CodexState {
  model: string;
  sessionId: string;
  workspace: string;
  lastSignature: string | null;
  sawMeta: boolean;
  suppressingFork: boolean;
  forkAnchor: number;
}

export function createCodexState(): CodexState {
  return {
    model: "",
    sessionId: "",
    workspace: "",
    lastSignature: null,
    sawMeta: false,
    suppressingFork: false,
    forkAnchor: 0,
  };
}

function isFork(payload: Record<string, unknown>): boolean {
  if (typeof payload.forked_from_id === "string") return true;
  const source = object(payload.source);
  const subagent = object(source?.subagent);
  const spawn = object(subagent?.thread_spawn);
  return typeof spawn?.parent_thread_id === "string";
}

export function parseCodexLine(line: string, state: CodexState): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  const root = object(parsed);
  const payload = object(root?.payload);
  if (root === null || payload === null) return null;

  if (root.type === "session_meta") {
    if (state.sawMeta) return null;
    state.sawMeta = true;
    const id = payload.id ?? payload.session_id;
    if (typeof id === "string") state.sessionId = id;
    if (typeof payload.cwd === "string") state.workspace = payload.cwd;
    const at = timestamp(root.timestamp);
    if (at !== null && isFork(payload)) {
      state.suppressingFork = true;
      state.forkAnchor = at;
    }
    return null;
  }

  if (root.type === "turn_context") {
    if (typeof payload.model === "string") state.model = payload.model;
    if (typeof payload.cwd === "string") state.workspace = payload.cwd;
    return null;
  }

  if (payload.type !== "token_count") return null;
  const info = object(payload.info);
  const last = object(info?.last_token_usage);
  if (last === null || state.model.length === 0) return null;
  const at = timestamp(root.timestamp);
  if (at === null) return null;

  const signature = JSON.stringify(last);
  if (signature === state.lastSignature) return null;
  state.lastSignature = signature;

  if (state.suppressingFork) {
    if (at - state.forkAnchor < 1_000) {
      state.forkAnchor = at;
      return null;
    }
    state.suppressingFork = false;
  }

  const inclusiveInput = positiveInt(last.input_tokens);
  const cachedInput = positiveInt(last.cached_input_tokens);
  const cacheWrite5m = positiveInt(last.cache_write_input_tokens);
  const output = positiveInt(last.output_tokens);
  const tokens: TokenTotals = {
    uncachedInput: Math.max(0, inclusiveInput - cachedInput - cacheWrite5m),
    cachedInput,
    cacheWrite5m,
    cacheWrite1h: 0,
    output,
    reasoning: Math.min(output, positiveInt(last.reasoning_output_tokens)),
  };
  if (totalTokens(tokens) === 0) return null;

  return {
    provider: "codex",
    timestamp: at,
    model: state.model,
    sessionId: state.sessionId,
    workspace: state.workspace,
    tokens,
    reportedCost: null,
    dedupeKey: null,
  };
}

export function parseClaudeLine(line: string): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  const root = object(parsed);
  if (root?.type !== "assistant") return null;
  const message = object(root.message);
  const usage = object(message?.usage);
  if (message === null || usage === null || typeof message.model !== "string") return null;
  const at = timestamp(root.timestamp);
  if (at === null || message.model === "<synthetic>") return null;

  const cacheCreation = object(usage.cache_creation);
  const totalCreation = positiveInt(usage.cache_creation_input_tokens);
  const cacheWrite1h = positiveInt(cacheCreation?.ephemeral_1h_input_tokens);
  const explicit5m = positiveInt(cacheCreation?.ephemeral_5m_input_tokens);
  const cacheWrite5m = Math.max(explicit5m, totalCreation - cacheWrite1h);
  const messageId = typeof message.id === "string" ? message.id : "";
  const requestId = typeof root.requestId === "string" ? root.requestId : "";

  return {
    provider: "claude",
    timestamp: at,
    model: message.model,
    sessionId: typeof root.sessionId === "string" ? root.sessionId : "",
    workspace: typeof root.cwd === "string" ? root.cwd : "",
    tokens: {
      uncachedInput: positiveInt(usage.input_tokens),
      cachedInput: positiveInt(usage.cache_read_input_tokens),
      cacheWrite5m,
      cacheWrite1h,
      output: positiveInt(usage.output_tokens),
      reasoning: 0,
    },
    reportedCost:
      typeof root.costUSD === "number" && Number.isFinite(root.costUSD) ? root.costUSD : null,
    dedupeKey: messageId || requestId ? `${messageId}:${requestId}` : null,
  };
}

