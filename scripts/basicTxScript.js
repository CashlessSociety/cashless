const ethers = require('ethers');

(async () => {
	let args = process.argv;
	let network = args[2];
	let providerURL;
	if (network == "mainnet" || network == "ropsten") {
		let apiKey = args[3];
		providerURL = "https://"+network+".infura.io/v3/"+apiKey;
	} else {
		let port = args[3];
		providerURL = "http://127.0.0.1:"+port;
	}
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(args[4], provider);
	let tx = {
  		to: args[5],
  		value: ethers.utils.parseEther(args[6])
	}
	let txreceipt = await wallet.sendTransaction(tx);
	console.log("tx:", txreceipt.hash);
})();