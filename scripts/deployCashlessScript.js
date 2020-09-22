const ethers = require('ethers');
const fs = require('fs');
const cashless = require('./../cashless.js');

var randomHash = () => {
	var resultString = '';
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for ( var i = 0; i < 12; i++ ) {
	  resultString += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return cashless.hashString(resultString);
}

var deployCashless = async (wallet, erc20Address, gasPrice) => {
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
	deployTx = factory.getDeployTransaction(randomHash(), erc20Address);
	deployTx.gasLimit = 5000000;
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
	let providerURL = args[2];
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let priv = args[3];
	let wallet = new ethers.Wallet(priv, provider);
    let gasPrice = Number(args[4]);
    let erc20 = cashless.erc20Contract(providerURL, wallet);
	await deployCashless(wallet, erc20.address, gasPrice);
})();
