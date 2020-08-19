const cashless = require('./../cashless.js');
const ethers = require('ethers');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let reservesAddress = args[3];
	let contract = cashless.contract(providerURL, null);
	let resp = await cashless.getReserves(contract, reservesAddress);
	if (resp['owner']=='0x0000000000000000000000000000000000000000') {
		console.log("reserves do not exist");
	} else {
		let readable = {balance: (resp["balance"]/ethers.utils.parseEther("1")).toString(), grossClaimed: (resp["grossClaimed"]/ethers.utils.parseEther("1")).toString(), grossDefaulted: (resp["grossDefaulted"]/ethers.utils.parseEther("1")).toString(), grossPaid: (resp["grossPaid"]/ethers.utils.parseEther("1")).toString()};
		console.log("reserves info:", JSON.stringify(readable));
	}
})();