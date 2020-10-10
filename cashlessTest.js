const cashless = require('./cashless');
const testKeys = require('./testKeys.js');
const ethers = require('ethers');
const fs = require('fs');

const providerURL = 'http://127.0.0.1:8545';
const provider = new ethers.providers.JsonRpcProvider(providerURL);
const emptyBytes32 = Buffer.alloc(32);

var randomHash = () => {
	var resultString = '';
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for ( var i = 0; i < 12; i++ ) {
	  resultString += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return cashless.hashString(resultString);
}

var now = () => {
	return Math.round(new Date().getTime() / 1000);
}

var deployCashless = async wallet => {
    let e = JSON.parse(fs.readFileSync('build/contracts/USDTest.json'));
	let lib = JSON.parse(fs.readFileSync('build/contracts/CashlessLibPub.json'));
	let c = JSON.parse(fs.readFileSync('build/contracts/Cashless.json'));
	let factory = new ethers.ContractFactory(lib["abi"], lib["bytecode"], wallet);
	let deployTx = factory.getDeployTransaction();
	deployTx.gasLimit = 600000;
	console.log("Deploying lib...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
        let receipt = await provider.getTransactionReceipt(tx.hash);
        console.log("cashless lib address:", receipt.contractAddress);
	} catch(e) {
		console.log('error deploying lib:', e.message);
		return
    }
    factory = new ethers.ContractFactory(e["abi"], e["bytecode"], wallet);
    deployTx = factory.getDeployTransaction(cashless.parseCoin("1000000000"));
    deployTx.gasLimit = 3000000;
    let tokenAddress;
    console.log("Deploying stablecoin...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
        let receipt = await provider.getTransactionReceipt(tx.hash);
        console.log("test stablecoin address:", receipt.contractAddress);
        tokenAddress = receipt.contractAddress;
	} catch(e) {
		console.log('error deploying stablecoin:', e.message);
		return
    }
	factory = new ethers.ContractFactory(c["abi"], c["bytecode"], wallet);
	deployTx = factory.getDeployTransaction(randomHash(), tokenAddress);
	deployTx.gasLimit = 6721975;
	console.log("Deploying cashless...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		let receipt = await provider.getTransactionReceipt(tx.hash);
		console.log("cashless address:", receipt.contractAddress)
		return receipt.contractAddress;
	} catch(e) {
		console.log('error deploying contract:', e.message);
		return
    }
}

var testBasicClaim = async (priv1, priv2) => {
	try {
        let wallet1 = new ethers.Wallet(priv1, provider);
        let wallet2 = new ethers.Wallet(priv2, provider);
		let cashlessContract1 = cashless.contract(providerURL, wallet1);
        let cashlessContract2 = cashless.contract(providerURL, wallet2);
        let stablecoinContract1 = cashless.stablecoinContract(providerURL, wallet1);
		let cashlessLibContract = cashless.libContract(providerURL);
		let address1 = cashless.addressFromPriv(priv1);
		let address2 = cashless.addressFromPriv(priv2);
		await cashless.fundReservesTx(cashlessContract1, stablecoinContract1, '8.0');
		let h1 = randomHash();
		let claim = cashless.encodeClaim('8.0', 0, now()-10000, now()+1000000, address1, address2, h1, emptyBytes32, 1);
		let sig1 = await cashless.signClaim(cashlessContract1, cashlessLibContract, claim);
		let sig2 = await cashless.signClaim(cashlessContract2, cashlessLibContract, claim);
		await cashless.proposeSettlementTx(cashlessContract2, claim, sig1, sig2);
		await cashless.redeemReservesTx(cashlessContract2, '8.0', address2);
		return true;
	} catch(e) {
		console.log('error in testBasicClaim:', e.message);
		return false;
	}
}

var testBasicCyclicReciprocity = async (priv1, priv2, priv3) => {
	try {
        let wallet1 = new ethers.Wallet(priv1, provider);
        let wallet2 = new ethers.Wallet(priv2, provider);
        let wallet3 = new ethers.Wallet(priv3, provider);
		let cashlessContract1 = cashless.contract(providerURL, wallet1);
		let cashlessContract2 = cashless.contract(providerURL, wallet2);
		let cashlessContract3 = cashless.contract(providerURL, wallet3);
		let cashlessLibContract = cashless.libContract(providerURL);
		let address1 = await wallet1.getAddress();
		let address2 = await wallet2.getAddress();
        let address3 = await wallet3.getAddress();
        let stablecoinContract1 = cashless.stablecoinContract(providerURL, wallet1);
		await cashless.fundReservesTx(cashlessContract1, stablecoinContract1, '10.0');
        let h1 = randomHash();
        console.log(address1, address2);
        let claim12 = cashless.encodeClaim('10.0', 0, now()-10000, now()+1000000, address1, address2, h1, emptyBytes32, 1);
		let claim12sig1 = await cashless.signClaim(cashlessContract1, cashlessLibContract, claim12);
		let claim12sig2 = await cashless.signClaim(cashlessContract2, cashlessLibContract, claim12);
		let claim23 = cashless.encodeClaim('6.0', 0, now()-10000, now()+1000000, address2, address3, h1, emptyBytes32, 1);
		let claim23sig1 = await cashless.signClaim(cashlessContract2, cashlessLibContract, claim23);
		let claim23sig2 = await cashless.signClaim(cashlessContract3, cashlessLibContract, claim23);
		let claim31 = cashless.encodeClaim('4.0', 0, now()-10000, now()+1000000, address3, address1, h1, emptyBytes32, 1);
		let claim31sig1 = await cashless.signClaim(cashlessContract3, cashlessLibContract, claim31);
		let claim31sig2 = await cashless.signClaim(cashlessContract1, cashlessLibContract, claim31);
        let loopName = randomHash();
        console.log("3");
		let loopID = await cashless.getLoopID(cashlessLibContract, loopName, [address1, address2, address3]);
		let claim12b = cashless.encodeClaim('6.0', 0, now()-10000, now()+1000000, address1, address2, h1, loopID, 2);
		let claim12bsig1 = await cashless.signClaim(cashlessContract1, cashlessLibContract, claim12b);
		let claim12bsig2 = await cashless.signClaim(cashlessContract2, cashlessLibContract, claim12b);
		let claim23b = cashless.encodeClaim('2.0', 0, now()-10000, now()+1000000, address2, address3, h1, loopID, 2);
		let claim23bsig1 = await cashless.signClaim(cashlessContract2, cashlessLibContract, claim23b);
		let claim23bsig2 = await cashless.signClaim(cashlessContract3, cashlessLibContract, claim23b);
		let claim31b = cashless.encodeClaim('0.0', 0, now()-10000, now()+1000000, address3, address1, h1, loopID, 2);
		let claim31bsig1 = await cashless.signClaim(cashlessContract3, cashlessLibContract, claim31b);
		let claim31bsig2 = await cashless.signClaim(cashlessContract1, cashlessLibContract, claim31b);
		await cashless.proposeLoopTx(cashlessContract1, loopName, [address1, address2, address3], '4.0');
		let encodedLoopClaim12 = await cashless.encodeLoopClaim(cashlessLibContract, claim12, claim12sig1, claim12sig2);
		let encodedLoopClaim12b = await cashless.encodeLoopClaim(cashlessLibContract, claim12b, claim12bsig1, claim12bsig2);
		await cashless.commitLoopClaimTx(cashlessContract3, loopID, encodedLoopClaim12, encodedLoopClaim12b);
		let encodedLoopClaim23 = await cashless.encodeLoopClaim(cashlessLibContract, claim23, claim23sig1, claim23sig2);
		let encodedLoopClaim23b = await await cashless.encodeLoopClaim(cashlessLibContract, claim23b, claim23bsig1, claim23bsig2);
		cashless.commitLoopClaimTx(cashlessContract3, loopID, encodedLoopClaim23, encodedLoopClaim23b);
		let encodedLoopClaim31 = await cashless.encodeLoopClaim(cashlessLibContract, claim31, claim31sig1, claim31sig2);
		let encodedLoopClaim31b = await cashless.encodeLoopClaim(cashlessLibContract, claim31b, claim31bsig1, claim31bsig2);
		await cashless.commitLoopClaimTx(cashlessContract3, loopID, encodedLoopClaim31, encodedLoopClaim31b);
		await cashless.proposeSettlementTx(cashlessContract1, claim12b, claim12bsig1, claim12bsig2);
        await cashless.proposeSettlementTx(cashlessContract2, claim23b, claim23bsig1, claim23bsig2);
		await cashless.redeemReservesTx(cashlessContract2, '4.0', address2);
		await cashless.redeemReservesTx(cashlessContract3, '2.0', address3);
		return true;
	} catch(e) {
		console.log('error in testCyclicReciprocity:', e.message);
		return false;
	}
}

var runTests = async (priv1, priv2, priv3) => {
	try {
        let wallet1 = new ethers.Wallet(priv1, provider);
        let wallet2 = new ethers.Wallet(priv2, provider);
        let wallet3 = new ethers.Wallet(priv3, provider);
		let addr = await deployCashless(wallet1);
		if (addr.toString() != "0x20346Aebaacfa94B8dcd7F5cE3B7f25d3163C672") {
			throw {message: 'MUST use correct dev blockchain configuration (and restart it) before running this test'};
		}
        let stablecoinContract1 = cashless.stablecoinContract(providerURL, wallet1);
        await cashless.stablecoinTransferTx(stablecoinContract1, await wallet2.getAddress(), "100");
        await cashless.stablecoinTransferTx(stablecoinContract1, await wallet3.getAddress(), "100");
		let passed = await testBasicClaim(priv1, priv2);
		if (!passed) {
			throw {message: 'failed testBasicClaim'};
        }
        for (let i=0; i<5; i++) {
            passed = await testBasicCyclicReciprocity(priv1, priv2, priv3);
            if (!passed) {
                throw {message: 'failed testBasicCyclicReciprocity'};
            }
        }
		return 'success!';
	} catch(e) {
		console.log("error:", e.message);
		return 'fail!';
	}
}

(async () => {
	let result = await runTests(testKeys.priv1, testKeys.priv2, testKeys.priv3);
	console.log(result);
})();