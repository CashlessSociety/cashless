# cashless

## Installation 

1. Install Ganache CLI

`npm install -g ganache-cli`

2. Clone this repo 
(First you must install git globally and be granted access to this repo)

```
git clone https://github.com/superarius/cashless.git
cd cashless
```

3. Start Ganache CLI (in a separate terminal)

```
ganache-cli --seed cashless-dev
```

Alternatively if you want to use Ganache GUI start a workspace with these parameters:

```
PORT NUMBER: 8545
MNEMONIC: better salmon blade brick cattle vintage slow earn renew news gold rabbit
```


4. Run tests (this will execute against local server)

```
node cashlessTest.js
```
