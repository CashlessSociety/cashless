const ethers = require('ethers');
const fs = require('fs');
const crypto = require('crypto');
const testKeys = require('./testKeys.js');

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:7545');

var cashless;

var hashString = str => {
	const hash = crypto.createHash('sha256');
	hash.update(str);
	return hash.digest();
}

var deployCashless = async wallet => {
	let rawABI = fs.readFileSync('bin/Cashless.abi');
	let contractABI = JSON.parse(rawABI);
	let rawBIN = fs.readFileSync('bin/Cashless.bin');
	let contractBIN = JSON.parse(rawBIN)['object'];
	let factory = new ethers.ContractFactory(contractABI, contractBIN, wallet);
	let deployTx = factory.getDeployTransaction(hashString('abc'));
	deployTx.gasLimit = 6500000;
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
		return 'success!';
	} catch(e) {
		console.log('error in test:', e.message);
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
