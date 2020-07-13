const cashless = require('./cashless');
const testKeys = require('./testKeys.js');
const ethers = require('ethers');
const fs = require('fs');

const providerURL = 'http://127.0.0.1:8545';
const contractDir = 'build/contracts/';
const provider = new ethers.providers.JsonRpcProvider(providerURL);
const emptyBytes32 = Buffer.alloc(32);
const emptyAddress = '0x0000000000000000000000000000000000000000';
var cashlessAddress;
var cashlessLibAddress;

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
	let lib = JSON.parse(fs.readFileSync('build/contracts/CashlessLibPub.json'));
	let c = JSON.parse(fs.readFileSync('build/contracts/Cashless.json'));
	let factory = new ethers.ContractFactory(lib["abi"], lib["bytecode"], wallet);
	let deployTx = factory.getDeployTransaction();
	deployTx.gasLimit = 600000;
	console.log("Deploying lib...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		let receipt = await provider.getTransactionReceipt(tx.hash);
		cashlessLibAddress = receipt.contractAddress;
	} catch(e) {
		console.log('error deploying lib:', e.message);
		return
	}
	factory = new ethers.ContractFactory(c["abi"], c["bytecode"], wallet);
	deployTx = factory.getDeployTransaction(randomHash());
	deployTx.gasLimit = 6721975;
	console.log("Deploying cashless...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		let receipt = await provider.getTransactionReceipt(tx.hash);
		cashlessAddress = receipt.contractAddress;
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
		let tx1 = await cashless.fundReserves(providerURL, priv1, cashlessAddress, '8.0', contractDir);
		let h1 = randomHash();
		let claim = cashless.encodeClaim('8.0', 0, now()-10000, now()+1000000, wallet1.address, wallet2.address, h1, emptyBytes32, emptyBytes32, 1);
		console.log('created claim:', claim);
		let sig1 = await cashless.signClaim(providerURL, priv1, cashlessAddress, cashlessLibAddress, claim, contractDir);
		let sig2 = await cashless.signClaim(providerURL, priv2, cashlessAddress, cashlessLibAddress, claim, contractDir);
		let tx2 = await cashless.proposeSettlement(providerURL, priv2, cashlessAddress, claim, sig1, sig2, contractDir);
		let tx3 = await cashless.withdrawReserves(providerURL, priv2, cashlessAddress, '8.0', contractDir);
		return true;
	} catch(e) {
		console.log('error in testBasicClaim:', e.message);
		return false;
	}
}

var testClaimToFutureMember = async (memberPriv, futurePriv) => {
	try {
		let memberWallet = new ethers.Wallet(memberPriv, provider);
		let futureWallet = new ethers.Wallet(futurePriv, provider);
		let tx1 = await cashless.fundReserves(providerURL, memberPriv, cashlessAddress, '1.95', contractDir);
		let h1 = randomHash();
		let alias = cashless.hashString('somehuman@gmail.com');
		let claim = cashless.encodeClaim('1.95', 0, now()-10000, now()+1000000, memberWallet.address, emptyAddress, h1, alias, emptyBytes32, 1);
		console.log('created claim:', claim);
		let sig1 = await cashless.signClaim(providerURL, memberPriv, cashlessAddress, cashlessLibAddress, claim, contractDir);
		let sig2 = await cashless.signClaim(providerURL, futurePriv, cashlessAddress, cashlessLibAddress, claim, contractDir);
		let tx2 = await cashless.issuePendingAlias(providerURL, memberPriv, cashlessAddress, alias, contractDir);
		let tx3 = await cashless.initReserves(providerURL, futurePriv, cashlessAddress, '0.0', contractDir);
		let tx4 = await cashless.commitPendingAlias(providerURL, memberPriv, cashlessAddress, alias, futureWallet.address, contractDir);
		let tx5 = await cashless.proposeSettlement(providerURL, memberPriv, cashlessAddress, claim, sig1, sig2, contractDir);
		let tx6 = await cashless.withdrawReserves(providerURL, futurePriv, cashlessAddress, '1.95', contractDir);
		return true;
	} catch(e) {
		console.log('error in testClaimToFutureMember:', e.message);
		return false;
	}
}

var testBasicCyclicReciprocity = async (priv1, priv2, priv3) => {
	try {
		let wallet1 = new ethers.Wallet(priv1, provider);
		let wallet2 = new ethers.Wallet(priv2, provider);
		let wallet3 = new ethers.Wallet(priv3, provider);
		let tx1 = await cashless.fundReserves(providerURL, priv1, cashlessAddress, '10.0', contractDir);
		let h1 = randomHash();
		let claim12 = cashless.encodeClaim('10.0', 0, now()-10000, now()+1000000, wallet1.address, wallet2.address, h1, emptyBytes32, emptyBytes32, 1);
		console.log('created claim12:', claim12);
		let claim12sig1 = await cashless.signClaim(providerURL, priv1, cashlessAddress, cashlessLibAddress, claim12, contractDir);
		let claim12sig2 = await cashless.signClaim(providerURL, priv2, cashlessAddress, cashlessLibAddress, claim12, contractDir);
		let claim23 = cashless.encodeClaim('6.0', 0, now()-10000, now()+1000000, wallet2.address, wallet3.address, h1, emptyBytes32, emptyBytes32, 1);
		console.log('created claim23:', claim23);
		let claim23sig1 = await cashless.signClaim(providerURL, priv2, cashlessAddress, cashlessLibAddress, claim23, contractDir);
		let claim23sig2 = await cashless.signClaim(providerURL, priv3, cashlessAddress, cashlessLibAddress, claim23, contractDir);
		let claim31 = cashless.encodeClaim('4.0', 0, now()-10000, now()+1000000, wallet3.address, wallet1.address, h1, emptyBytes32, emptyBytes32, 1);
		console.log('created claim31:', claim31);
		let claim31sig1 = await cashless.signClaim(providerURL, priv3, cashlessAddress, cashlessLibAddress, claim31, contractDir);
		let claim31sig2 = await cashless.signClaim(providerURL, priv1, cashlessAddress, cashlessLibAddress, claim31, contractDir);
		let loopName = randomHash();
		let loopID = await cashless.getLoopID(providerURL, cashlessLibAddress, loopName, [wallet1.address, wallet2.address, wallet3.address], contractDir);
		console.log("got loop ID:", loopID);
		let claim12b = cashless.encodeClaim('6.0', 0, now()-10000, now()+1000000, wallet1.address, wallet2.address, h1, emptyBytes32, loopID, 2);
		console.log('created claim12b:', claim12b);
		let claim12bsig1 = await cashless.signClaim(providerURL, priv1, cashlessAddress, cashlessLibAddress, claim12b, contractDir);
		let claim12bsig2 = await cashless.signClaim(providerURL, priv2, cashlessAddress, cashlessLibAddress, claim12b, contractDir);
		let claim23b = cashless.encodeClaim('2.0', 0, now()-10000, now()+1000000, wallet2.address, wallet3.address, h1, emptyBytes32, loopID, 2);
		console.log('created claim23b:', claim23b);
		let claim23bsig1 = await cashless.signClaim(providerURL, priv2, cashlessAddress, cashlessLibAddress, claim23b, contractDir);
		let claim23bsig2 = await cashless.signClaim(providerURL, priv3, cashlessAddress, cashlessLibAddress, claim23b, contractDir);
		let claim31b = cashless.encodeClaim('0.0', 0, now()-10000, now()+1000000, wallet3.address, wallet1.address, h1, emptyBytes32, loopID, 2);
		console.log('created claim31b:', claim31b);
		let claim31bsig1 = await cashless.signClaim(providerURL, priv3, cashlessAddress, cashlessLibAddress, claim31b, contractDir);
		let claim31bsig2 = await cashless.signClaim(providerURL, priv1, cashlessAddress, cashlessLibAddress, claim31b, contractDir);
		let tx2 = await cashless.proposeLoop(providerURL, priv1, cashlessAddress, loopName, [wallet1.address, wallet2.address, wallet3.address], ethers.utils.parseEther('4.0'), now()+1000000, contractDir);
		let encodedLoopClaim12 = await cashless.encodeLoopClaim(providerURL, cashlessLibAddress, claim12, claim12sig1, claim12sig2, contractDir);
		let encodedLoopClaim12b = await cashless.encodeLoopClaim(providerURL, cashlessLibAddress, claim12b, claim12bsig1, claim12bsig2, contractDir);
		let tx3 = await cashless.commitLoopClaim(providerURL, priv3, cashlessAddress, loopID, encodedLoopClaim12, encodedLoopClaim12b, contractDir);
		let encodedLoopClaim23 = await cashless.encodeLoopClaim(providerURL, cashlessLibAddress, claim23, claim23sig1, claim23sig2, contractDir);
		let encodedLoopClaim23b = await await cashless.encodeLoopClaim(providerURL, cashlessLibAddress, claim23b, claim23bsig1, claim23bsig2, contractDir);
		let tx4 = cashless.commitLoopClaim(providerURL, priv3, cashlessAddress, loopID, encodedLoopClaim23, encodedLoopClaim23b, contractDir);
		let encodedLoopClaim31 = await cashless.encodeLoopClaim(providerURL, cashlessLibAddress, claim31, claim31sig1, claim31sig2, contractDir);
		let encodedLoopClaim31b = await cashless.encodeLoopClaim(providerURL, cashlessLibAddress, claim31b, claim31bsig1, claim31bsig2, contractDir);
		let tx5 = await cashless.commitLoopClaim(providerURL, priv3, cashlessAddress, loopID, encodedLoopClaim31, encodedLoopClaim31b, contractDir);
		let tx6 = await cashless.proposeSettlement(providerURL, priv1, cashlessAddress, claim12b, claim12bsig1, claim12bsig2, contractDir);
		let tx7 = await cashless.proposeSettlement(providerURL, priv2, cashlessAddress, claim23b, claim23bsig1, claim23bsig2, contractDir);
		let tx8 = await cashless.withdrawReserves(providerURL, priv2, cashlessAddress, '4.0', contractDir);
		let tx9 = await cashless.withdrawReserves(providerURL, priv3, cashlessAddress, '2.0', contractDir);
		return true;
	} catch(e) {
		console.log('error in testBasicClaim:', e.message);
		return false;
	}
}

var runTests = async (priv1, priv2, priv3) => {
	try {
		let wallet1 = new ethers.Wallet(priv1, provider);
		let txHash = await deployCashless(wallet1);
		console.log("deployed contract:", txHash, "\naddress:", cashlessAddress);
		let tx1h = await cashless.initReserves(providerURL, priv1, cashlessAddress, '10.0', contractDir);
		let tx2h =  await cashless.initReserves(providerURL, priv2, cashlessAddress, '0.0', contractDir);
		let passed = await testBasicClaim(priv1, priv2);
		if (!passed) {
			throw '';
		}
		passed = await testClaimToFutureMember(priv1, priv3);
		if (!passed) {
			throw '';
		}
		passed = await testBasicCyclicReciprocity(priv1, priv2, priv3);
		if (!passed) {
			throw '';
		}
		return 'success!';
	} catch(e) {
		return 'fail!';
	}
}

(async () => {
	let result = await runTests(testKeys.priv1, testKeys.priv2, testKeys.priv3);
	console.log(result);
})();