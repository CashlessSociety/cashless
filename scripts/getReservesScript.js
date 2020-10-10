const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let reservesAddress = args[3];
	let contract = cashless.contract(providerURL, null);
    let resp = await cashless.getReserves(contract, reservesAddress);
    let readable = {balance: (resp["balance"]/cashless.parseCoin("1")).toString()};
    console.log("reserves info:", JSON.stringify(readable));
})();