import * as StellarSdk from 'stellar-sdk';
import axios from 'axios';
import { telegramConfig } from '../../config/app';
import { logger } from '../../config/logger';

export enum StellarNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

export class StellarLinkHelper {
  private static readonly LAB_BASE_URL = 'https://lab.stellar.org';

  // Stellar Lab custom URL encoding:
  // - horizonUrl: double-encoded
  // - passphrase: spaces -> %20, semicolons -> /; (escape with /)
  // - xdr blob: slashes -> // (doubled), everything else literal
  private static encodePassphrase(passphrase: string): string {
    return passphrase.replace(/ /g, '%20').replace(/;/g, '/;');
  }

  private static encodeXdrBlob(xdr: string): string {
    return xdr.replace(/\//g, '//');
  }

  static getSignLink(xdr: string, network: StellarNetwork = StellarNetwork.MAINNET): string {
    const config = this.getNetworkConfig(network);
    const horizon = this.encodeXdrBlob(config.horizon);
    const rpc = this.encodeXdrBlob(config.rpc);
    const encodedPassphrase = this.encodePassphrase(config.passphrase);
    const encodedXdr = this.encodeXdrBlob(xdr);

    return `${this.LAB_BASE_URL}/transaction/sign?$=network$id=${config.id}&label=${config.label}&horizonUrl=${horizon}&rpcUrl=${rpc}&passphrase=${encodedPassphrase};&transaction$sign$activeView=overview&importXdr=${encodedXdr};;`;
  }

  static getWalletLink(xdr: string): string {
    return `web+stellar:tx?xdr=${encodeURIComponent(xdr)}`;
  }

  static getViewLink(xdr: string, network: StellarNetwork = StellarNetwork.MAINNET): string {
    const config = this.getNetworkConfig(network);
    const horizon = this.encodeXdrBlob(config.horizon);
    const rpc = this.encodeXdrBlob(config.rpc);
    const encodedPassphrase = this.encodePassphrase(config.passphrase);
    const encodedXdr = this.encodeXdrBlob(xdr);
    return `${this.LAB_BASE_URL}/xdr/view?$=network$id=${config.id}&label=${config.label}&horizonUrl=${horizon}&rpcUrl=${rpc}&passphrase=${encodedPassphrase};&xdr$blob=${encodedXdr};;`;
  }

  private static getNetworkConfig(network: StellarNetwork) {
    if (network === StellarNetwork.MAINNET) {
      return {
        id: 'mainnet',
        label: 'Mainnet',
        horizon: 'https://horizon.stellar.org',
        rpc: 'https://stellar-soroban-public.nodies.app',
        passphrase: StellarSdk.Networks.PUBLIC,
      };
    }
    return {
      id: 'testnet',
      label: 'Testnet',
      horizon: 'https://horizon-testnet.stellar.org',
      rpc: 'https://soroban-testnet.stellar.org',
      passphrase: StellarSdk.Networks.TESTNET,
    };
  }
}

export interface TrustlineLinks {
  xdr: string;
  webSignUrl: string;
  viewUrl: string;
}

async function shortenUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      { timeout: 5000 }
    );
    return response.data as string;
  } catch (error) {
    logger.warn({ error }, 'Failed to shorten URL, using original');
    return url;
  }
}

function resolveNetwork(): StellarNetwork {
  const val = (telegramConfig.stellarNetwork || 'public').toLowerCase();
  return val === 'testnet' ? StellarNetwork.TESTNET : StellarNetwork.MAINNET;
}

const NETWORK_CONFIGS = {
  [StellarNetwork.MAINNET]: {
    passphrase: StellarSdk.Networks.PUBLIC,
  },
  [StellarNetwork.TESTNET]: {
    passphrase: StellarSdk.Networks.TESTNET,
  },
};

export async function buildTrustlineLinks(
  walletAddress: string,
  assetCode: string,
  assetIssuer: string
): Promise<TrustlineLinks> {
  const network = resolveNetwork();
  const networkPassphrase = NETWORK_CONFIGS[network].passphrase;
  const server = new StellarSdk.Horizon.Server(telegramConfig.horizonUrl);
  const account = await server.accounts().accountId(walletAddress).call();
  const sourceAccount = new StellarSdk.Account(account.account_id, account.sequence);
  const asset = new StellarSdk.Asset(assetCode, assetIssuer);

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset,
      })
    )
    .setTimeout(StellarSdk.TimeoutInfinite)
    .build();

  const xdr = tx.toXDR();
  const [webSignUrl, viewUrl] = await Promise.all([
    shortenUrl(StellarLinkHelper.getSignLink(xdr, network)),
    shortenUrl(StellarLinkHelper.getViewLink(xdr, network)),
  ]);

  return {
    xdr,
    webSignUrl,
    viewUrl,
  };
}
