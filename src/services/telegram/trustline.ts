import * as StellarSdk from 'stellar-sdk';
import { StellarNetwork, shortenUrl, resolveNetwork, NETWORK_CONFIGS } from './utils';
import { telegramConfig } from '../../config/app';

export { StellarNetwork };

export class StellarLinkHelper {
  private static readonly LAB_BASE_URL = 'https://lab.stellar.org';

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
    fee: StellarSdk.BASE_FEE + '0', // 100 x 10 =  this for network congestion
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

export async function buildPaymentTransactionLinks(
  sourceWallet: string,
  destAddress: string,
  amount: string,
  assetCode: string,
  assetIssuer: string,
  memo?: string
): Promise<TrustlineLinks> {
  const network = resolveNetwork();
  const networkPassphrase = NETWORK_CONFIGS[network].passphrase;
  const server = new StellarSdk.Horizon.Server(telegramConfig.horizonUrl);
  const account = await server.accounts().accountId(sourceWallet).call();
  const sourceAccount = new StellarSdk.Account(account.account_id, account.sequence);
  const asset = new StellarSdk.Asset(assetCode, assetIssuer);

  const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE + '0', // 100 x 10 =  this for network congestion
    networkPassphrase,
  }).addOperation(
    StellarSdk.Operation.payment({
      destination: destAddress,
      asset,
      amount,
    })
  );

  if (memo) {
    txBuilder.addMemo(StellarSdk.Memo.text(memo));
  }

  const tx = txBuilder.setTimeout(StellarSdk.TimeoutInfinite).build();

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
