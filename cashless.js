const ethers = require('ethers');
const fs = require('fs');
const crypto = require('crypto');
const ethjsutil = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const testKeys = require('./testKeys.js');

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
const ecsign = ethjsutil.ecsign;
const emptyBytes32 = Buffer.alloc(32);
const emptyAddress = '0x0000000000000000000000000000000000000000';
var cashless;
var cashlessLib;

var hashString = str => {
	let hash = crypto.createHash('sha256');
	hash.update(str);
	return hash.digest();
}

var randomHash = () => {
	var resultString = '';
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for ( var i = 0; i < 12; i++ ) {
	  resultString += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return hashString(resultString);
}

var now = () => {
	return Math.round(new Date().getTime() / 1000);
}

var deployCashless = async wallet => {
	let lib = JSON.parse(fs.readFileSync('build/contracts/CashlessLibPub.json'));
	let c = JSON.parse(fs.readFileSync('build/contracts/Cashless.json'));
	let factory = new ethers.ContractFactory(lib["abi"], lib["bytecode"], wallet);
	let deployTx = factory.getDeployTransaction();
	deployTx.gasLimit = 500000;
	console.log("Deploying lib...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		let receipt = await provider.getTransactionReceipt(tx.hash);
		cashlessLib = new ethers.Contract(receipt.contractAddress, lib["abi"], provider);
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
		cashless = new ethers.Contract(receipt.contractAddress, c["abi"], provider);
		return receipt.contractAddress;
	} catch(e) {
		console.log('error deploying contract:', e.message);
		return
	}
}

var initReserves = async (wallet, fundAmountEth) => {
	let myContract = cashless.connect(wallet);
	let options = {value: ethers.utils.parseEther(fundAmountEth), gasLimit: 90000};
	try {
		let tx = await myContract.functions.createReserves(options);
		return tx;
	} catch(e) {
		console.log('error creating reserves:', e.message);
		return
	}
}

var fundReserves = async (wallet, amountEth, addressToFund) => {
	let myContract = cashless.connect(wallet);
	let options = {value: ethers.utils.parseEther(amountEth), gasLimit: 50000};
	try {
		let tx = await myContract.functions.fundReserves(addressToFund, options);
		return tx;
	} catch(e) {
		console.log('error funding reserves:', e.message);
		return
	}
}

var withdrawReserves = async (wallet, amountEth, receiverAddress, tipAmountEth) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 60000};
	try {
		let tx = await myContract.functions.withdrawReserves(ethers.utils.parseEther(amountEth), receiverAddress, ethers.utils.parseEther(tipAmountEth), options);
		return tx;
	} catch(e) {
		console.log('error withdrawing reserves:', e.message);
		return
	}
}

var signClaim = async (wallet, claimData) => {
	let ds = await cashless.functions.DOMAIN_SEPARATOR();
	ds = ds[0];
	let h = await cashlessLib.functions.hashClaimData(claimData, ds);
	h = h[0].substring(2);
	let bh = Uint8Array.from(Buffer.from(h, 'hex'));
	let priv = Uint8Array.from(Buffer.from(wallet.privateKey.substring(2), 'hex'));
	return ecsign(bh, priv);
}

var proposeSettlement = async (wallet, claimData, sig1, sig2) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 800000};
	try{
		let tx = await myContract.functions.proposeSettlement(claimData, [sig1.v, sig2.v], [sig1.r, sig2.r], [sig1.s, sig2.s], options);
		return tx;
	} catch(e) {
		console.log("error proposing settlement:", e.message);
		return
	}
}

var proposeLoop = async (wallet, loopName, addresses, minFlow, lockTime) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 100000};
	try {
		let tx = await myContract.functions.proposeLoop(loopName, addresses, minFlow, lockTime);
		return tx;
	} catch(e) {
		console.log("error proposing loop:", e.message);
		return		
	}
}

var encodeLoopClaim = async (claim, sig1, sig2) => {
	try {
		let data = await cashlessLib.encodeLoopClaim(claim, [sig1.v, sig2.v], [sig1.r, sig2.r], [sig1.s, sig2.s]);
		return data;
	} catch(e) {
		console.log("error encoding loop claim:", e.message);
		return
	}
}

var issuePendingAlias = async (wallet, name) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 100000};
	try {
		let tx = await myContract.functions.addPendingAlias(name, options);
		return tx;
	} catch(e) {
		console.log("error issuing pending alias:", e.message);
		return
	}
}

var commitPendingAlias = async (wallet, name, address) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 100000};
	try {
		let tx = await myContract.functions.commitPendingAlias(name, address, options);
		return tx;
	} catch(e) {
		console.log("error committing pending alias:", e.message);
		return
	}
}

var commitLoopClaim = async (wallet, loopID, encodedClaim1, encodedClaim2) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 1000000};
	try {
		let tx = await myContract.functions.commitLoopClaim(loopID, encodedClaim1, encodedClaim2, options);
		return tx;
	} catch(e) {
		console.log("error committing loop claim:", e.message);
		return
	}
}

var testBasicClaim = async (wallet1, wallet2) => {
	try {
		let tx1 = await fundReserves(wallet1, '8.0', wallet1.address);
		console.log("funded reserves:", tx1.hash);
		let h1 = randomHash();
		let claim = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('8.0').toString(), 0, now()-10000, now()+1000000], [wallet1.address, wallet2.address], [h1, emptyBytes32, emptyBytes32], 1]);
		console.log('created claim:', claim);
		let sig1 = await signClaim(wallet1, claim);
		let sig2 = await signClaim(wallet2, claim);
		let tx2 = await proposeSettlement(wallet1, claim, sig1, sig2);
		console.log("settlement proposed:", tx2.hash);
		let tx3 = await withdrawReserves(wallet2, '7.9', wallet2.address, '0.1');
		console.log("withdraw complete:", tx3.hash);
		return true;
	} catch(e) {
		console.log('error in testBasicClaim:', e.message);
		return false;
	}
}

var testClaimToFutureMember = async (memberWallet, futureWallet) => {
	try {
		let tx1 = await fundReserves(memberWallet, '1.95', memberWallet.address);
		console.log("funded reserves:", tx1.hash);
		let h1 = randomHash();
		let name = hashString('somehuman@gmail.com');
		let claim = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('1.95').toString(), 0, now()-10000, now()+1000000], [memberWallet.address, emptyAddress], [h1, name, emptyBytes32], 1]);
		console.log('created claim:', claim);
		let sig1 = await signClaim(memberWallet, claim);
		let sig2 = await signClaim(futureWallet, claim);
		let tx2 = await issuePendingAlias(memberWallet, name);
		console.log("pending alias proposed:", tx2.hash);
		let tx3 = await initReserves(futureWallet, '0.0');
		console.log("created reserves (3):", tx3.hash);
		let tx4 = await commitPendingAlias(memberWallet, name, futureWallet.address);
		console.log("pending alias committed:", tx4.hash);
		let tx5 = await proposeSettlement(memberWallet, claim, sig1, sig2);
		console.log("settlement proposed:", tx5.hash);
		let tx6 = await withdrawReserves(futureWallet, '1.85', futureWallet.address, '0.1');
		console.log("withdraw complete:", tx6.hash);
		return true;
	} catch(e) {
		console.log('error in testClaimToFutureMember:', e.message);
		return false;
	}
}

var testBasicCyclicReciprocity = async (wallet1, wallet2, wallet3) => {
	try {
		let tx1 = await fundReserves(wallet1, '10.08', wallet1.address);
		console.log("funded reserves:", tx1.hash);
		let h1 = randomHash();
		let claim12 = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('10.0').toString(), 0, now()-10000, now()+1000000], [wallet1.address, wallet2.address], [h1, emptyBytes32, emptyBytes32], 1]);
		console.log('created claim12:', claim12);
		let claim12sig1 = await signClaim(wallet1, claim12);
		let claim12sig2 = await signClaim(wallet2, claim12);
		let claim23 = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('6.0').toString(), 0, now()-10000, now()+1000000], [wallet2.address, wallet3.address], [h1, emptyBytes32, emptyBytes32], 1]);
		console.log('created claim23:', claim23);
		let claim23sig1 = await signClaim(wallet2, claim23);
		let claim23sig2 = await signClaim(wallet3, claim23);
		let claim31 = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('4.0').toString(), 0, now()-10000, now()+1000000], [wallet3.address, wallet1.address], [h1, emptyBytes32, emptyBytes32], 1]);
		console.log('created claim31:', claim31);
		let claim31sig1 = await signClaim(wallet3, claim31);
		let claim31sig2 = await signClaim(wallet1, claim31);
		let loopName = randomHash();
		let loopID = await cashlessLib.functions.getLoopID(loopName, [wallet1.address, wallet2.address, wallet3.address]);
		loopID = loopID[0];
		console.log("got loop ID:", loopID);
		let claim12b = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('6.0').toString(), 0, now()-10000, now()+1000000], [wallet1.address, wallet2.address], [h1, emptyBytes32, loopID], 2]);
		console.log('created claim12b:', claim12b);
		let claim12bsig1 = await signClaim(wallet1, claim12b);
		let claim12bsig2 = await signClaim(wallet2, claim12b);
		let claim23b = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('2.0').toString(), 0, now()-10000, now()+1000000], [wallet2.address, wallet3.address], [h1, emptyBytes32, loopID], 2]);
		console.log('created claim23b:', claim23b);
		let claim23bsig1 = await signClaim(wallet2, claim23b);
		let claim23bsig2 = await signClaim(wallet3, claim23b);
		let claim31b = abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther('0.0').toString(), 0, now()-10000, now()+1000000], [wallet3.address, wallet1.address], [h1, emptyBytes32, loopID], 2]);
		console.log('created claim31b:', claim31b);
		let claim31bsig1 = await signClaim(wallet3, claim31b);
		let claim31bsig2 = await signClaim(wallet1, claim31b);
		let tx2 = await proposeLoop(wallet1, loopName, [wallet1.address, wallet2.address, wallet3.address], ethers.utils.parseEther('4.0'), now()+1000000);
		console.log("loop proposed:", tx2.hash);
		let encodedLoopClaim12 = await encodeLoopClaim(claim12, claim12sig1, claim12sig2);
		let encodedLoopClaim12b = await encodeLoopClaim(claim12b, claim12bsig1, claim12bsig2);
		let tx3 = await commitLoopClaim(wallet3, loopID, encodedLoopClaim12, encodedLoopClaim12b);
		console.log("committed to loop proposal (12):", tx3.hash);
		let encodedLoopClaim23 = await encodeLoopClaim(claim23, claim23sig1, claim23sig2);
		let encodedLoopClaim23b = await encodeLoopClaim(claim23b, claim23bsig1, claim23bsig2);
		let tx4 = await commitLoopClaim(wallet3, loopID, encodedLoopClaim23, encodedLoopClaim23b);
		console.log("committed to loop proposal (23):", tx4.hash);
		let encodedLoopClaim31 = await encodeLoopClaim(claim31, claim31sig1, claim31sig2);
		let encodedLoopClaim31b = await encodeLoopClaim(claim31b, claim31bsig1, claim31bsig2);
		let tx5 = await commitLoopClaim(wallet3, loopID, encodedLoopClaim31, encodedLoopClaim31b);
		console.log("committed to loop proposal (31):", tx5.hash);
		let tx6 = await proposeSettlement(wallet1, claim12b, claim12bsig1, claim12bsig2);
		console.log("settlement proposed:", tx6.hash);
		let tx7 = await proposeSettlement(wallet1, claim23b, claim23bsig1, claim23bsig2);
		console.log("settlement proposed:", tx7.hash);
		let tx8 = await withdrawReserves(wallet2, '3.9', wallet2.address, '0.1');
		console.log("withdraw complete:", tx8.hash);
		let tx9 = await withdrawReserves(wallet3, '1.9', wallet3.address, '0.1');
		console.log("withdraw complete:", tx9.hash);
		return true;
	} catch(e) {
		console.log('error in testBasicClaim:', e.message);
		return false;
	}
}

var runTests = async (wallet1, wallet2, wallet3) => {
	try {
		let txHash = await deployCashless(wallet1);
		console.log("deployed contract:", txHash, "\naddress:", cashless.address);
		let tx1 = await initReserves(wallet1, '10.0');
		console.log("created reserves (1):", tx1.hash);
		let tx2 = await initReserves(wallet2, '0.0');
		console.log("created reserves (2):", tx2.hash);
		let passed = await testBasicClaim(wallet1, wallet2);
		if (!passed) {
			throw '';
		}
		passed = await testClaimToFutureMember(wallet1, wallet3);
		if (!passed) {
			throw '';
		}
		passed = await testBasicCyclicReciprocity(wallet1, wallet2, wallet3);
		if (!passed) {
			throw '';
		}
		return 'success!';
	} catch(e) {
		return 'fail!';
	}
}

(async () => {
	wallet1 = new ethers.Wallet(testKeys.priv1, provider);
	wallet2 = new ethers.Wallet(testKeys.priv2, provider);
	wallet3 = new ethers.Wallet(testKeys.priv3, provider);
	let result = await runTests(wallet1, wallet2, wallet3);
	console.log(result);
})();
