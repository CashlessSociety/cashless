const ethers = require('ethers');
const fs = require('fs');
const crypto = require('crypto');
const testkeys = require('./testKeys.js');

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:7545');

var cashless;

var hashString = str => {
	const hash = crypto.createHash('sha256');
	hash.update(str);
	return hash.digest();
}

var deployCashless = deployerPriv => {
	let rawABI = fs.readFileSync('bin/Cashless.abi');
	let contractABI = JSON.parse(rawABI);
	let rawBIN = fs.readFileSync('bin/Cashless.bin');
	let contractBIN = JSON.parse(rawBIN)['object'];
	let wallet = new ethers.Wallet(deployerPriv, provider);
	let factory = new ethers.ContractFactory(contractABI, contractBIN, wallet);
	let deployTx = factory.getDeployTransaction(hashString('abc'));
	deployTx.gasLimit = 6500000;
	deployTx.gasPrice = 30000000000;
	return new Promise((resolve, reject) => {
		wallet.sendTransaction(deployTx)
		.then(function(tx){
			provider.getTransactionReceipt(tx.hash)
			.then(function(receipt) {
				cashless = new ethers.Contract(receipt.contractAddress, contractABI, provider);
				resolve(tx.hash);
			})
			.catch(function(error) {
				reject(error);
			});
		})
		.catch(function(error) {
			reject(error);
		});
	});
}

var initReserves = (amount, priv) => {
	let myContract = cashless.connect(new ethers.Wallet(priv, provider));
	let options = {value: ethers.utils.parseEther(amount), gasLimit: 1000000};
	return new Promise((resolve, reject) => {
		myContract.functions.createReserves(options)
		.then(function(result) {
			resolve(result);
		})
		.catch(function(error) {
			reject(error);
		});
	});
}

var testDeployAndInit = priv => {
	deployCashless(priv)
	.then(txHash => {
		console.log("deployed contract:", txHash, "\naddress:", cashless.address);
		initReserves('10.0', priv)
		.then(tx => {
			console.log("created reserves:", tx.hash);
		})
		.catch(error => {
			console.log("error createing reserves:", error.message);
		});
	})
	.catch(error => {
		console.log("error deploying:", error.message);
	});
}

testDeployAndInit(testkeys.priv1);
