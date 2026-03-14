import {
  JsonRpcProvider,
  type TransactionRequest,
  Wallet,
  isAddress,
} from 'ethers';
import type { Logger } from 'pino';
import { CocoError } from '../errors.js';
import type {
  ConfirmationRequiredResult,
  LimitLedger,
  WalletConfig,
  WalletExecutionRequest,
  WalletExecutor,
} from '../types.js';

function isEnvVarName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value);
}

function toTransactionRequest(tx: Record<string, unknown>): TransactionRequest {
  return tx as TransactionRequest;
}

function getSubjectId(request: WalletExecutionRequest): string {
  return request.ctx.userId ?? request.ctx.sessionId;
}

function requirePrivateKeyEnv(config: WalletConfig): string {
  if (!config.privateKey) {
    throw new CocoError(
      'Wallet private key environment variable is required for this mode.',
      'wallet_private_key_missing',
    );
  }

  if (!isEnvVarName(config.privateKey)) {
    throw new CocoError(
      'wallet.privateKey must reference an environment variable name.',
      'wallet_private_key_invalid',
    );
  }

  const value = process.env[config.privateKey];
  if (!value) {
    throw new CocoError(
      `Environment variable ${config.privateKey} is not set.`,
      'wallet_private_key_unset',
    );
  }

  return value;
}

function buildConfirmationResult(
  request: WalletExecutionRequest,
  threshold: number,
): ConfirmationRequiredResult {
  return {
    type: 'confirmation_required',
    operation: request.operation,
    amountUsd: request.amountUsd ?? 0,
    threshold,
    tx: request.tx,
  };
}

export class DefaultWalletExecutor implements WalletExecutor {
  readonly #provider: JsonRpcProvider;
  readonly #ledger: LimitLedger;
  readonly #logger: Logger;

  constructor(rpcUrl: string, ledger: LimitLedger, logger: Logger) {
    this.#provider = new JsonRpcProvider(rpcUrl);
    this.#ledger = ledger;
    this.#logger = logger;
  }

  async resolveAddress(
    ctx: WalletExecutionRequest['ctx'],
  ): Promise<string | undefined> {
    const { wallet } = ctx.runtime.config;
    if (wallet.mode === 'unsigned') {
      return ctx.walletAddress;
    }

    if (wallet.mode === 'session-key') {
      return wallet.sessionKey?.signer;
    }

    const privateKey = requirePrivateKeyEnv(wallet);
    return new Wallet(privateKey).address;
  }

  async execute(request: WalletExecutionRequest) {
    const { wallet } = request.ctx.runtime.config;
    const limits = wallet.limits;

    if (wallet.mode === 'unsigned') {
      return {
        success: true,
        data: {
          type: 'unsigned_tx',
          tx: request.tx,
        },
        text: `Prepared unsigned ${request.operation} transaction.`,
      };
    }

    if (!limits) {
      throw new CocoError(
        'Wallet limits must be configured.',
        'wallet_limits_missing',
      );
    }

    if (request.amountUsd == null || Number.isNaN(request.amountUsd)) {
      throw new CocoError(
        'Unable to estimate USD value for transaction limit checks.',
        'price_unavailable',
      );
    }

    const subjectId = getSubjectId(request);
    await this.#ledger.ensureWithinLimits({
      subjectId,
      amountUsd: request.amountUsd,
      limits,
    });

    if (
      limits.requireConfirmAbove != null &&
      request.amountUsd > limits.requireConfirmAbove &&
      request.ctx.metadata.walletConfirmed !== true
    ) {
      return {
        success: true,
        data: buildConfirmationResult(request, limits.requireConfirmAbove),
        text: `Transaction needs explicit confirmation above $${limits.requireConfirmAbove}.`,
      };
    }

    if (wallet.mode === 'session-key') {
      const sessionKey = wallet.sessionKey;
      if (!sessionKey) {
        throw new CocoError(
          'session-key configuration is missing.',
          'session_key_missing',
        );
      }
      if (!isAddress(sessionKey.signer)) {
        throw new CocoError(
          'session-key signer must be a valid address.',
          'session_key_invalid',
        );
      }
      if (sessionKey.validUntil * 1000 < Date.now()) {
        throw new CocoError(
          'session-key authorization has expired.',
          'session_key_expired',
        );
      }
      if (!sessionKey.permissions.includes(request.operation)) {
        throw new CocoError(
          `session-key does not allow ${request.operation}.`,
          'session_key_permission_denied',
        );
      }

      return {
        success: false,
        error: 'session-key execution is not implemented yet.',
        code: 'not_implemented',
      };
    }

    const privateKey = requirePrivateKeyEnv(wallet);
    const signer = new Wallet(privateKey, this.#provider);
    const response = await signer.sendTransaction(
      toTransactionRequest(request.tx),
    );

    await this.#ledger.record({
      subjectId,
      toolId: request.toolId,
      txHash: response.hash,
      amountUsd: request.amountUsd,
      chainId: request.ctx.chainId,
      mode: wallet.mode,
    });

    if (wallet.mode === 'custodial' || wallet.mode === 'delegated') {
      this.#logger.info(
        {
          category: 'audit',
          walletMode: wallet.mode,
          sessionId: request.ctx.sessionId,
          userId: request.ctx.userId,
          toolId: request.toolId,
          operation: request.operation,
          amountUsd: request.amountUsd,
          chainId: request.ctx.chainId,
          txHash: response.hash,
        },
        'Wallet transaction broadcasted',
      );
    }

    return {
      success: true,
      data: {
        type: 'signed_tx',
        txHash: response.hash,
      },
      text: `Broadcasted ${request.operation} transaction ${response.hash}.`,
    };
  }
}
