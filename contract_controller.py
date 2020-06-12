from py_eth_sig_utils import signing
from operator import itemgetter
from eth_abi import encode_abi, decode_abi
import sys, json, binascii

ecsign = signing.utils.ecsign

with open("bin/Reserves.abi", "r") as f:
	raw_reserves_abi = f.read()
with open("bin/Reserves.bin", "r") as f:
	raw_reserves_bytecode = f.read()
RESERVES_ABI = json.loads(raw_reserves_abi)
RESERVES_BYTECODE = json.loads(raw_reserves_bytecode)["object"]

class ReservesContractControl:
	def __init__(self, priv, w3_provider, contract_address=None, abi=RESERVES_ABI, bytecode=RESERVES_BYTECODE):
		self.eth = w3_provider.eth
		self.account = self.eth.account.privateKeyToAccount(priv)
		self.abi = abi
		self.bytecode = bytecode
		self.deployed = False
		self.owner = None
		if contract_address is None:
			self.contract = self.eth.contract(abi=self.abi, bytecode=self.bytecode)
		else:
			self.contract = self.eth.contract(address=contract_address, abi=abi, bytecode=bytecode)
			self.owner = self.contract.functions.owner().call()
			self.deployed = True

	def deploy(self, contractID, gas):
		if self.deployed:
			raise ValueError(f"Contract already deployed ({self.contract.address})")
		constructed_contract = self.contract.constructor(contractID)
		basetx = {"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas":gas, "from": self.account.address}
		tx = constructed_contract.buildTransaction(basetx)
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		self.owner = self.account.address
		self.deployed = True
		try:
			tx_receipt = self.eth.waitForTransactionReceipt(tx_hash)
			contract_address = tx_receipt["contractAddress"]
			self.contract = self.eth.contract(address=contract_address, abi=self.abi, bytecode=self.bytecode)
			return tx_hash, contract_address
		except:
			return tx_hash, None

	def fund(self, wei_value, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		tx = {"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address, "to": self.contract.address, "value": wei_value}
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def withdraw(self, amount, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		if self.owner != self.account.address:
			raise ValueError("Controller must be contract owner to withraw")
		r = self.contract.functions.withdraw(amount)
		tx = r.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def sign_claim(self, claimData, priv=None):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		acct = self.account
		if priv != None:
			acct = self.eth.account.privateKeyToAccount(priv)
		h = self.contract.functions.getClaimHash(claimData).call()
		sig = ecsign(h, acct.privateKey)
		v = sig[0]
		r = sig[1].to_bytes((sig[1].bit_length()+7)//8, 'big')
		s = sig[2].to_bytes((sig[2].bit_length()+7)//8, 'big')
		if self.owner == acct.address:
			if not self.contract.functions.verifySignedClaim(claimData, True, v, r, s).call():
				raise ValueError("Signed claim failed verification")
		else:
			if not self.contract.functions.verifySignedClaim(claimData, False, v, r, s).call():
				raise ValueError("Signed claim failed verification")
		return v, r, s

	def settle_claim(self, claimData, owner_sig, recv_sig, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		v = [owner_sig[0], recv_sig[0]]
		r = [owner_sig[1], recv_sig[1]]
		s = [owner_sig[2], recv_sig[2]]
		settle = self.contract.functions.settle(claimData, v, r, s)
		tx = settle.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def dispute_claim(self, claimData, owner_sig, recv_sig, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		v = [owner_sig[0], recv_sig[0]]
		r = [owner_sig[1], recv_sig[1]]
		s = [owner_sig[2], recv_sig[2]]
		dispute = self.contract.functions.dispute(claimData, v, r, s)
		tx = dispute.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def redeem_claim(self, claimID, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		r = self.contract.functions.redeemClaim(claimID)
		tx = r.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def encode_claim(self, sid, receiver, amount, disputeDuration, vestTimestamp, voidTimestamp, nonce, cyclicContract=None):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		if cyclicContract == None:
			cyclicContract = self.contract.address
		return self.contract.functions.encodeClaim(sid, receiver, amount, disputeDuration, vestTimestamp, voidTimestamp, nonce, cyclicContract).call()

	def decode_claim(self, claimData):
		return decode_abi(['bytes32', 'address', 'uint256[4]', 'uint8'], claimData)

	def get_claim(self, cid, idx):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.claims(cid, idx).call()

	def get_claim_id(self, sid, receiver):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.getClaimID(sid, receiver).call()

	def get_latest_claim(self, cid):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		l = self.contract.functions.getClaimLength(cid).call()
		return self.contract.functions.claims(cid, l-1).call()

	def get_claim_hash(self, claimData):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.getClaimHash(claimData).call()

	def get_all_claim_ids(self):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.getAllClaimIDs().call()

	def get_claim_length(self, cid):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.getClaimLength(cid).call()

	def get_current_claim_value(self, cid):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.getAdjustedClaimAmount(cid).call()

	def get_settlement(self, cid):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.settlements(cid).call()

	def get_settle_time(self, cid):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.settlementTimestamps(cid, 0).call()

	def get_disput_start_time(self, cid):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		return self.contract.functions.settlementTimestamps(cid, 1).call()

with open("bin/CyclicReciprocity.abi", "r") as f:
	raw_cyclic_abi = f.read()
with open("bin/CyclicReciprocity.bin", "r") as f:
	raw_cyclic_bytecode = f.read()
CYCLIC_ABI = json.loads(raw_cyclic_abi)
CYCLIC_BYTECODE = json.loads(raw_cyclic_bytecode)["object"]

class CyclicReciprocityContractControl:
	def __init__(self, priv, w3_provider, contract_address=None, abi=CYCLIC_ABI, bytecode=CYCLIC_BYTECODE):
		self.eth = w3_provider.eth
		self.account = self.eth.account.privateKeyToAccount(priv)
		self.abi = abi
		self.bytecode = bytecode
		self.deployed = False
		self.owner = None
		if contract_address is None:
			self.contract = self.eth.contract(abi=self.abi, bytecode=self.bytecode)
		else:
			self.contract = self.eth.contract(address=contract_address, abi=abi, bytecode=bytecode)
			self.loop = self.contract.functions.getLoop().call()
			self.amount = self.contract.functions.minFlow().call()
			self.locktime = self.contract.functions.lockTime().call()
			self.deployed = True

	def deploy(self, loop, amount, locktime, gas):
		if self.deployed:
			raise ValueError(f"Contract already deployed ({self.contract.address})")
		constructed_contract = self.contract.constructor(loop, amount, locktime)
		basetx = {"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas":gas, "from": self.account.address}
		tx = constructed_contract.buildTransaction(basetx)
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		self.loop = loop
		self.amount = amount
		self.locktime = locktime
		self.deployed = True
		try:
			tx_receipt = self.eth.waitForTransactionReceipt(tx_hash)
			contract_address = tx_receipt["contractAddress"]
			self.contract = self.eth.contract(address=contract_address, abi=self.abi, bytecode=self.bytecode)
			return tx_hash, contract_address
		except:
			return tx_hash, None

	def submit_claim(self, reserves, data1, owner_sig1, recv_sig1, data2, owner_sig2, recv_sig2, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		v1 = [owner_sig1[0], recv_sig1[0]]
		r1 = [owner_sig1[1], recv_sig1[1]]
		s1 = [owner_sig1[2], recv_sig1[2]]
		v2 = [owner_sig2[0], recv_sig2[0]]
		r2 = [owner_sig2[1], recv_sig2[1]]
		s2 = [owner_sig2[2], recv_sig2[2]]
		encoded1 = encode_abi(['address', 'bytes', 'uint8[2]', 'bytes32[2]', 'bytes32[2]'], (reserves, data1, v1, r1, s1))
		encoded2 = encode_abi(['address', 'bytes', 'uint8[2]', 'bytes32[2]', 'bytes32[2]'], (reserves, data2, v2, r2, s2))
		submit = self.contract.functions.submitClaim(encoded1, encoded2)
		tx = submit.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def settle_claim(self, reserves, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		settle = self.contract.functions.settle(reserves)
		tx = settle.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def dispute_claim(self, reserves, gas):
		if not self.deployed:
			raise ValueError("No contract address exists (deploy contract first or instantiate existing contract)")
		dispute = self.contract.functions.dispute(reserves)
		tx = dispute.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash
