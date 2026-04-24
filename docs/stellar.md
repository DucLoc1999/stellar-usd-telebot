Stellar Network (XLM): An open-source blockchain for enterprises and institutions, offering secure smart contracts, fast payments, and asset tokenization

Building on the Stellar network requires distinguishing between the **Horizon API** (the classic REST API for payments/accounts) and the **Stellar RPC** (the modern interface for Soroban smart contracts).

Below is the essential information for your development environment.

---

## 1. Network Configuration
| Feature | **Mainnet (Public)** | **Testnet** |
| :--- | :--- | :--- |
| **Network Passphrase** | `Public Global Stellar Network ; September 2015` | `Test SDF Network ; September 2015` |
| **Horizon URL** | `https://horizon.stellar.org` | `https://horizon-testnet.stellar.org` |
| **Stellar RPC (Soroban)** | Use providers (e.g., Ankr, QuickNode) | `https://soroban-testnet.stellar.org` |
| **Friendbot** | N/A | `https://friendbot.stellar.org` |

---

## 2. USD Token Addresses
On Stellar, tokens are identified by an **Asset Code** and an **Issuer Address**. The most widely used "USD" token is **USDC** issued by Centre (Circle).

### **USDC (Mainnet)**
* **Asset Code:** `USDC`
* **Issuer Address:** `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
* **Trustline:** Required before receiving.

### **USD (Testnet)**
Because Testnet resets regularly, "official" USD addresses can change. However, you can create your own for testing or use the common benchmark:
* **Asset Code:** `USD`
* **Issuer Address:** `GBY6GDUU6S6434V66K4I5C7Z6LTVH37O6Z37O6Z37O6Z37O6Z37O6Z37` (Example/Anchor)
* **Note:** You can use the [Stellar Laboratory](https://laboratory.stellar.org/) to issue a test USD asset in seconds.

---

## 3. Example Code: Transferring Tokens (Node.js)
This example uses `@stellar/stellar-sdk` to transfer a custom USD asset.

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function transferUSD() {
    // 1. Setup Server and Keys
    // Use Horizon for standard asset transfers
    const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
    const sourceKeys = StellarSdk.Keypair.fromSecret('SC...YOUR_SECRET_KEY');
    const destinationId = 'GD...RECEIVER_PUBLIC_KEY';

    // 2. Define the Asset (USD)
    const USD_ASSET = new StellarSdk.Asset(
        'USD', 
        'GBY6GDUU6S6434V66K4I5C7Z6LTVH37O6Z37O6Z37O6Z37O6Z37O6Z37' // Issuer
    );

    try {
        // 3. Load account to get current sequence number
        const account = await server.loadAccount(sourceKeys.publicKey());

        // 4. Build the Transaction
        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET,
        })
        .addOperation(StellarSdk.Operation.payment({
            destination: destinationId,
            asset: USD_ASSET,
            amount: '10.50', // Amount is a string
        }))
        .setTimeout(30)
        .build();

        // 5. Sign and Submit
        transaction.sign(sourceKeys);
        const result = await server.submitTransaction(transaction);
        console.log('Success! Results:', result);
    } catch (e) {
        console.error('Transfer failed!', e.response ? e.response.data : e);
    }
}

transferUSD();
```

---

### **Important Notes for Developers**
* **Trustlines:** Unlike Ethereum, a Stellar account **cannot** receive a token unless it first creates a "Trustline" to that specific asset/issuer.
* **XLM Balance:** Every account needs a small amount of native Lumens (XLM) to pay for transaction fees (usually 100 stroops or **0.00001 XLM**) and to cover the "Base Reserve" for trustlines.
* **SDK Versions:** Ensure you are using the latest version of `@stellar/stellar-sdk` (v11+), which includes full support for Soroban RPC features if you decide to move beyond simple payments.

