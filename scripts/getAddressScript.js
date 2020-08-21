const cashless = require('./../cashless.js');

(async () => {
	console.log(cashless.addressFromPriv(process.argv[2]));
})();