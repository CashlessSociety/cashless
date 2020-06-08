from py_eth_sig_utils import signing
from operator import itemgetter
from eth_abi import encode_abi
import sys, json, binascii

ecsign = signing.utils.ecsign

with open("Reserves.abi", "r") as f:
	raw_reserves_abi = f.read()
with open("Reserves.bin", "r") as f:
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
			self.owner = self.contract.functions.getOwner().call()
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

	def fund_contract(self, wei_value, gas):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
		tx = {"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address, "to": self.contract.address, "value": wei_value}
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def sign_claim(self, claimData):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
		tx_hash = self.contract.functions.getClaimHash(claimData).call()
		sig = ecsign(tx_hash, self.account.privateKey)
		v = sig[0]
		r = sig[1].to_bytes((sig[1].bit_length()+7)//8, 'big')
		s = sig[2].to_bytes((sig[2].bit_length()+7)//8, 'big')
		if self.owner == self.account.address:
			if not self.contract.functions.verifySignedClaim(claimData, True, v, r, s).call():
				raise ValueError("Claim failed verification")
		else:
			if not self.contract.functions.verifySignedClaim(claimData, False, v, r, s).call():
				raise ValueError("Claim failed verification")
		return v, r, s

	def get_encoded_claim(self, sid, receiver, amount, disputeDuration, vestTimestamp, voidTimestamp, nonce):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
		return self.contract.functions.encodeClaim(sid, receiver, amount, disputeDuration, vestTimestamp, voidTimestamp, nonce).call()

	def get_claim_id(self, sid, receiver):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
		return self.contract.functions.getClaimID(sid, receiver).call()

	def settle_claim(self, claimData, owner_sig, recv_sig, gas):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
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
			raise ValueError("Contract not deployed, deploy contract first!")
		v = [owner_sig[0], recv_sig[0]]
		r = [owner_sig[1], recv_sig[1]]
		s = [owner_sig[2], recv_sig[2]]
		settle = self.contract.functions.dispute(claimData, v, r, s)
		tx = settle.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def redeem_claim(self, claimID, gas):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
		r = self.contract.functions.redeemClaim(claimID)
		tx = r.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def redeem_default(self, claimID, gas):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
		r = self.contract.functions.redeemDefault(claimID)
		tx = r.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash

	def withdraw(self, amount, gas):
		if not self.deployed:
			raise ValueError("Contract not deployed, deploy contract first!")
		if self.owner != self.account.address:
			raise ValueError("Controller must be contract owner to withraw")
		r = self.contract.functions.withdraw(amount)
		tx = r.buildTransaction({"nonce": self.eth.getTransactionCount(self.account.address), "gasPrice": self.eth.gasPrice, "gas": gas, "from": self.account.address})
		signed = self.account.signTransaction(tx)
		tx_hash = self.eth.sendRawTransaction(signed.rawTransaction)
		return tx_hash
