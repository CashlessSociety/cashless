const ethers = require('ethers');
const fs = require('fs');
const crypto = require('crypto');
const cashless = require('./../cashless.js');

var deployCashless = async (wallet, gasPrice) => {
	let lib = JSON.parse(fs.readFileSync('./../build/contracts/CashlessLibPub.json'));
	let c = JSON.parse(fs.readFileSync('./../build/contracts/Cashless.json'));
	let factory = new ethers.ContractFactory(lib["abi"], lib["bytecode"], wallet);
	let deployTx = factory.getDeployTransaction();
	deployTx.gasLimit = 1000000;
	deployTx.gasPrice = gasPrice;
	console.log("Deploying lib...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		console.log("cashlessLib deployment:", tx.hash);
	} catch(e) {
		console.log('error deploying lib:', e.message);
		return
	}
	factory = new ethers.ContractFactory(c["abi"], c["bytecode"], wallet);
	deployTx = factory.getDeployTransaction(cashless.randomHash());
	deployTx.gasLimit = 6721975;
	deployTx.gasPrice = gasPrice;
	console.log("Deploying cashless...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		console.log("cashless deployment:", tx.hash);
		return 
	} catch(e) {
		console.log('error deploying contract:', e.message);
		return 
	}
}

(async () => {
	let args = process.argv;
	let provider = new ethers.providers.JsonRpcProvider(args[2]);
	let priv = args[3];
	let wallet = new ethers.Wallet(priv, provider);
	await deployCashless(wallet, Number(args[4]));
})();
