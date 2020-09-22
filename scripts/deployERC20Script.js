const ethers = require('ethers');
const fs = require('fs');

var deployERC20 = async (wallet, gasPrice) => {
	let c = JSON.parse(fs.readFileSync('./../build/contracts/TestERC20.json'));
    let factory = new ethers.ContractFactory(c["abi"], c["bytecode"], wallet);
	let deployTx = factory.getDeployTransaction(ethers.utils.parseEther("1000000000"));
	deployTx.gasLimit = 3000000;
	deployTx.gasPrice = gasPrice;
	console.log("Deploying TestERC20...");
	try {
		let tx = await wallet.sendTransaction(deployTx);
		console.log("deployment tx:", tx.hash);
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
	await deployERC20(wallet, gasPrice);
})();