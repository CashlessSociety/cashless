from web3 import Web3, HTTPProvider
from contract_controller import ReservesContractControl
from hashlib import sha256
import time, binascii, random

def random_hash():
	return sha256(''.join([random.choice('abcdefghijklmnopqrstuvwxyz1234567890') for _ in range(10)]).encode()).digest()

if __name__ == '__main__':
	priv1 = "fa9066494f87ea600d2047819f2ddab50f90e034ecf5bd279a55035ff8d555ee"
	priv2 = "44ad5d96637fe21728a16b2aa7c4c35eb6c548f3f4a7724101e4747c2e7a1c21"
	priv3 = "755324529362e2e77d0bc3433b20f18955fcc4d45a6ab14b6183f18f6d1d2d6c"

	# NOTE: MUST BE RUNNING LOCAL GANACHE SERVER
	w3 = Web3(HTTPProvider("http://localhost:7545"))

	# TEST DEPLOY CONTRACT
	reservesA = ReservesContractControl(priv1, w3)
	reservesA.deploy(random_hash(), 4000000)
	reservesB = ReservesContractControl(priv2, w3)
	reservesB.deploy(random_hash(), 4000000)

	# TEST FUND CONTRACT
	reservesA.fund(Web3.toWei(12, "ether"), 1000000)

	# TEST SETTLEMENT (NO DISPUTE)
	vest_time = int(time.time())-50000
	void_time = vest_time + 100000
	dispute_length = 0
	d = reservesA.encode_claim(random_hash(), reservesB.contract.address, Web3.toWei(20, "ether"), dispute_length, vest_time, void_time, 1)
	s1 = reservesA.sign_claim(d)
	s2 = reservesA.sign_claim(d, priv=priv2)
	try:
		reservesA.sign_claim(d, priv=priv3)
		raise ValueError('FAILED TEST')
	except:
		pass
	reservesA.settle_claim(d, s1, s2, 1000000)
	if (Web3.toWei(10, "ether") != w3.eth.getBalance(reservesB.contract.address)) or (Web3.toWei(2, "ether") != w3.eth.getBalance(reservesA.contract.address)):
		raise ValueError('FAILED TEST')
	print("PASS")
