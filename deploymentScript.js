const ethers = require('ethers');
const fs = require('fs');
const crypto = require('crypto');

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

var deployCashless = async wallet => {
	let lib = JSON.parse(fs.readFileSync('build/contracts/CashlessLibPub.json'));
	let c = JSON.parse(fs.readFileSync('build/contracts/Cashless.json'));
	let factory = new ethers.ContractFactory(lib["abi"], lib["bytecode"], wallet);
	let deployTx = factory.getDeployTransaction();
	deployTx.gasLimit = 500000;
	console.log("Deploying lib...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		console.log("cashlessLib deployment:", tx.hash);
	} catch(e) {
		console.log('error deploying lib:', e.message);
		return false;
	}
	factory = new ethers.ContractFactory(c["abi"], c["bytecode"], wallet);
	deployTx = factory.getDeployTransaction(randomHash());
	deployTx.gasLimit = 6721975;
	console.log("Deploying cashless...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		console.log("cashless deployment:", tx.hash);
		return true;
	} catch(e) {
		console.log('error deploying contract:', e.message);
		return false;
	}
}

(async () => {
	let args = process.argv;
	let provider = new ethers.providers.JsonRpcProvider(args[2]);
	let priv = args[3];
	let wallet = new ethers.Wallet(priv, provider);
	let res = await deployCashless(wallet);
	console.log("status:", res);
})();
