const ethers = require('ethers');
const fs = require('fs');
const crypto = require('crypto');
const ethjsutil = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const testKeys = require('./testKeys.js');

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:7545');
const ecsign = ethjsutil.ecsign;
const emptyBytes32 = Buffer.alloc(32);
const emptyAddress = '0x0000000000000000000000000000000000000000';
var cashless;

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
	let rawABI = fs.readFileSync('bin/Cashless.abi');
	let contractABI = JSON.parse(rawABI);
	let rawBIN = fs.readFileSync('bin/Cashless.bin');
	let contractBIN = JSON.parse(rawBIN)['object'];
	let factory = new ethers.ContractFactory(contractABI, contractBIN, wallet);
	let deployTx = factory.getDeployTransaction(randomHash());
	deployTx.gasLimit = 6700000;
	deployTx.gasPrice = 30000000000;
	try {
		let tx = await wallet.sendTransaction(deployTx);
		let receipt = await provider.getTransactionReceipt(tx.hash);
		cashless = new ethers.Contract(receipt.contractAddress, contractABI, provider);
		return receipt.contractAddress;
	} catch(e) {
		console.log('error deploying contract:', e.message);
		return
	}
}

var initReserves = async (wallet, fundAmountEth) => {
	let myContract = cashless.connect(wallet);
	let options = {value: ethers.utils.parseEther(fundAmountEth), gasLimit: 1000000};
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
	let options = {value: ethers.utils.parseEther(amountEth), gasLimit: 1000000};
	try {
		let tx = await myContract.functions.fundReserves(addressToFund, options);
		return tx;
	} catch(e) {
		console.log('error creating reserves:', e.message);
		return
	}
}

var withdrawReserves = async (wallet, amountEth, receiverAddress, tipAmountEth) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 1000000};
	try {
		let tx = await myContract.functions.withdrawReserves(ethers.utils.parseEther(amountEth), receiverAddress, ethers.utils.parseEther(tipAmountEth), options);
		return tx;
	} catch(e) {
		console.log('error creating reserves:', e.message);
		return
	}
}

var signClaim = async (wallet, claimData) => {
	let h = await cashless.functions.hashClaimData(claimData);
	h = h[0].substring(2);
	let bh = Uint8Array.from(Buffer.from(h, 'hex'));
	let priv = Uint8Array.from(Buffer.from(wallet.privateKey.substring(2), 'hex'));
	return ecsign(bh, priv);
}

var proposeSettlement = async (wallet, claimData, sig1, sig2) => {
	let myContract = cashless.connect(wallet);
	let options = {gasLimit: 1000000};
	let tx = await myContract.functions.proposeSettlement(claimData, [sig1.v, sig2.v], [sig1.r, sig2.r], [sig1.s, sig2.s], options);
	return tx;
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

var runTests = async (wallet1, wallet2, wallet3) => {
	try {
		let txHash = await deployCashless(wallet1);
		console.log("deployed contract:", txHash, "\naddress:", cashless.address);
		let tx1 = await initReserves(wallet1, '10.0');
		console.log("created reserves (1):", tx1.hash);
		let tx2 = await initReserves(wallet2, '0.0');
		console.log("created reserves (2):", tx2.hash);
		let tx3 = await initReserves(wallet3, '0.0');
		console.log("created reserves (3):", tx3.hash);
		let passed = await testBasicClaim(wallet1, wallet2);
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
