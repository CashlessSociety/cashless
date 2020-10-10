const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
    let address = args[3];
	let contract = cashless.stablecoinContract(providerURL, null);
    let resp = await contract.balanceOf(address);
    console.log(Number(resp));
    console.log(resp/cashless.parseCoin("1"));
})();