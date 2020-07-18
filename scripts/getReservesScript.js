const cashless = require('./../cashless.js');
const ethers = require('ethers');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let cashlessAddress = args[3];
	let reservesAddress = args[4];
	let resp = await cashless.getReserves(providerURL, cashlessAddress, reservesAddress, './../build/contracts/');
	let readable = {balance: (resp["balance"]/ethers.utils.parseEther("1")).toString(), grossClaimed: (resp["grossClaimed"]/ethers.utils.parseEther("1")).toString(), grossDefaulted: (resp["grossDefaulted"]/ethers.utils.parseEther("1")).toString(), grossPaid: (resp["grossPaid"]/ethers.utils.parseEther("1")).toString()};
	console.log("reserves info:", JSON.stringify(readable));
})();