# Cashless

## Installation 

1. Install Ganache CLI

`npm install -g ganache-cli`

2. Clone this repo 
(First you must install git globally and be granted access to this repo)

```
git clone https://github.com/superarius/cashless.git
cd cashless
```

3. Start Ganache CLI (in a separate terminal)

```
ganache-cli --seed cashless-dev
```

Alternatively if you want to use Ganache GUI start a workspace with these parameters:

```
PORT NUMBER: 8545
MNEMONIC: better salmon blade brick cattle vintage slow earn renew news gold rabbit
```


4. Run tests (this will execute against local server)

```
node cashlessTest.js
```

## Scripts

Interaction with cashless contracts is currently handled with a number of Node.js scripts in the `/scripts` directory of this repository.

To use, enter the `/scripts` directory and follow the instructions below.

Note that the first argument for each command line script that interacts with the blockchain (all except encodeClaim and decodeClaim) is a `providerURL`. There are only three possibilites:

- `https://mainnet.infura.io/v3/<your-infura-project-id>`
- `https://ropsten.infura.io/v3/<your-infura-project-id>`
- `http://127.0.0.1:<port-running-local-blockchain>`

For `mainnet` or `ropsten` you need to use an infura provider (get your own infura project id by signing up at https://infura.io)

Passing a local port means you are using the `dev` network. When running in dev mode we assume the dev blockchain was started with same configuration as `ganache-cli --seed cashless-dev` and further assumes the first transaction was the deployment of cashless contracts with the private key at index 0 of that dev environment.

Note: All hex arguments (including private keys) must be 0x prefixed

### basicTxScript

A simple script for sending ether from an account you control (you need direct access to the private key) to any other account (any ethereum address). You can't set a custom gasPrice or gasLimit.

```
node basicTxScript.js <providerURL> <sender private key> <receiver address> <amount to send>
```

### deploymentScript

This script deploys the latest version of the cashless reserves contract and cashless library contract. 

**Unlesss you know exactly what and why you are doing it, you should not be running this script on mainnet.**

However, when starting a fresh dev server, this script should be run in dev mode before doing anything else, to generate the correct contract addresses for the reserves and library contracts.

```
node deploymentScript.js <providerURL> <privateKey> <gasPrice in wei>
```

Use eth gas station to pick a gasPrice that will be accepted. Remeber to convert it from gwei to wei for the command line argument.

### initReservesScript

This script is the standard way to initialize a reserves account with the cashless reserves contract. The eth account you use to sign and send the transaction will be the official reserves account owner (currently non-transferrable).

```
node initReservesScript.js <providerURL> <privateKey>
```

### signInitReservesScript and presignedInitReservesScript

Much like the above script, these two scripts are used to initialize a reserves account with the cashless reserves contract. Only use these two separate scripts if you want to separate the reserves account owner you are trying to initialize from the account that actually sends the transaction and pays the eth fees for initialization. Here are the steps:

1. First, use the private key from the account that will become the reserves account owner to sign the necessary initialization data (without sending any transaction to the blockchain yet):

```
node signInitReservesScript.js <providerURL> <privateKey>
```

This will output a JSON string of the initializing signature.

2. Pass the JSON signature to the owner of the account who will send the transaction (and pay the fees). Along with the signature pass the address of the signer (the address of the reserves account to initialize). If you are just using one of your own other accounts for the fees, ignore this step.

3. Finally, the owner of the transaction sending account uses this script to push the transaction and complete the reserves account initialization:

```
node presignedInitReservesScript.js <providerURL> <privateKey> <new reserves address> '<signature JSON>'
```

This way someone can securely pay the fees to initialize the account on your behalf.

### fundReservesScript

After initializing reserves, you can fund your reserves account with a specified amount of ether. This transaction must be sent from the existing reserves account owner's address to be accepted.

```
node fundReservesScript.js <providerURL> <privateKey> <amount in ether>
```

### getReservesScript

This script simply fetches the current balance and other basic data of a particular reserves account.

```
node getReservesScript.js <providerURL> <reserves address>
```

### withdrawReservesScript

This script simply remits eth in reserves to any address desired (only the reserves account owner can authorize this). Withdrawl incurs a small fee to the contract which is calculated under the hood and comes out of the desired amount withdrawn so the remitted amount is actually ~1% less than the amount requested.

```
node withdrawReservesScript.js <providerURL> <privateKey> <amount in ether>
```

### encodeClaimScript

This is a helper script (no interaction with blockchain) to encode a claim JSON into the proper serialized hex claim format.

```
node encodeClaimScript.js '<claim JSON>'
```

The fields in a claim JSON are as follows:

- amountEth (string, a decimal amount of ether)
- disputeDuration (int, number of seconds for dispute period)
- vestTimestamp (int, unix timestamp for when claim vests)
- voidTimestamp (int, unix timestamp for when claim voids)
- senderAddress (string, ethereum address)
- receiverAddress (string, ethereum address all 0s for no receiver address)
- claimName (string, 0x prefixed hex digest of 256 bit hash)
- loopID (string, 0x prefixed hex digest of 256 bit hash)
- receiverAlias (string, 0x prefixed hex digest of 256 bit hash all 0s for no receiver alias)
- nonce (int, 1-255)

example:

```
{"amountEth":"1.0", "disputeDuration": 0, "vestTimestamp": 1595274514, "voidTimestamp": 1596274534, "senderAddress": "0x0cBa9455600735CE7D0c8bCb08b9b419B5f87bE4", "receiverAddress": "0x0000000000000000000000000000000000000000", "claimName": "0xff000000000000000000000000000000000000000000000000000000000000ff", "loopID": "0x0000000000000000000000000000000000000000000000000000000000000000", "receiverAlias": "0x558bb489c74920c02fa545fad9fe07e5b2013345b70f9db196f09243e75546d8", "nonce":1}
```

returns: the serilaized claim (in hex)

### decoddeClaimScript

The inverse helper script of the script above. This takes serialized claim data and outputs a more human readable json of the claim details.

```
node decodeClaimScript.js <claimData>
```

### signClaimScript

This script takes claim data and signs the claim with a given privateKey. 

```
node signClaimScript.js <providerURL> <privateKey> <claimData>
```

Only when sending and receiving parties both sign a valid claim correctly and the claim is submitted after the vestTimestamp and is not challenged during a dispute period, do claims actually settle and transfer eth from one reserves to another.

### proposeSettlementScript

This script takes a claim and the two signatures (sender and receiver's) and pushes them to the blockchain to 'settle' the claim.

```
node proposeSettlementScript.js <providerURL> <privateKey> <claimData> '<sender signature JSON>' '<receiver signature JSON>'
```

(If the claim's disputePeriod is 0 the claim settles immediatley else there is a period of time where a counter-claim with a higher nonce can be sent to the blockchain to invalidate the existing claim before settlement)

### issuePendingAliasScript

This script takes an `alias` and reserves those particular bytes for use as a reserves account alias, without yet setting the reserves address that this alias attaches to. Only the reserves account who issues the pending alias can finally commit the alias to some **existing** reserves address.

```
node issuePendingAliasScript.js <providerURL> <privateKey> <name>
```

The alias is always the 256 bit hash of some name string (tthe last command line argument). The hashfunc used by this script is hardcoded as SHA256 but in reality any 256 bit hash function will do.

### commitPendingAliasScript

This script commits a pending alias to a reserves account. It can only be executed by the same reserves account that issued the pending alias.

```
node commitPendingAliasScript.js <providerURL> <privateKey> <name> <chosen reserves Address>
```

This script assumes that the previous script was used to issue the pending alias i.e. that SHA256 was the hash function used when issuing the pending alias for a given name string. (This script cannot currently handle custom hash functions for the name, but the blockchain contract certainly can.)