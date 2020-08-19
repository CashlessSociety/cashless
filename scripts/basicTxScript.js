const ethers = require('ethers');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(args[3], provider);
	let tx = {
  		to: args[4],
  		value: ethers.utils.parseEther(args[5])
	}
	let txreceipt = await wallet.sendTransaction(tx);
	console.log("tx:", txreceipt.hash);
})();