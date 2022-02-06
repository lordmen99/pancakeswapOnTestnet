require('dotenv').config();
var fs = require('fs')
var Tx = require('ethereumjs-tx').Transaction;
var Web3 = require('web3')
var Common = require('ethereumjs-common').default;

var web3 = new Web3(new Web3.providers.HttpProvider('https://data-seed-prebsc-1-s1.binance.org:8545/'))
var BSC_FORK = Common.forCustomChain(
    'mainnet',
    {
        name: 'Binance Smart Chain Mainnet',
        networkId: 97,
        chainId: 97,
        url: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
    },
    'istanbul',
);

// SPECIFY_THE_AMOUNT_OF_BNB_YOU_WANT_TO_BUY_FOR_HERE
var originalAmountToBuyWith = '0.00001' + Math.random().toString().slice(2,7);
var bnbAmount = web3.utils.toWei(originalAmountToBuyWith, 'ether');

var targetAccounts = [
    {
    address: process.env.WALLET, //my metamask
    privateKey: process.env.PRIVATE_KEY // my private key
    }
]

var targetIndex = 0;
var targetAccount = targetAccounts[targetIndex];

console.log(`Buying BUSD for ${originalAmountToBuyWith} BNB from pancakeswap for address ${targetAccount.address}`);

var res = swapTokensOnPancakeUsingBNB(targetAccounts[targetIndex], bnbAmount)
        .catch(err=>console.log(err))
console.log(res);


async function swapTokensOnPancakeUsingBNB(acc, amount) {

    var amountToBuyWith = web3.utils.toHex(amount);
    var privateKey = Buffer.from(acc.privateKey.slice(2), 'hex')  ;
    
    var tokenAddress = '0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7'; // busd token
    var WBNBAddress = '0xae13d989dac2f0debff460ac112a837c89baa7cd'; // WBNB token address

    var amountOutMin = '1' + Math.random().toString().slice(2,6);
    var pancakeSwapRouterAddress = '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3';

    var routerAbi = JSON.parse(fs.readFileSync('pancake-router-abi.json', 'utf-8'));
    var contract = new web3.eth.Contract(routerAbi, pancakeSwapRouterAddress, {from: acc.address});
    var data = contract.methods.swapExactETHForTokens(
        web3.utils.toHex(amountOutMin),
        [WBNBAddress,
         tokenAddress],
        acc.address,
        web3.utils.toHex(Math.round(Date.now()/1000)+60*20),
    );

    const balance = await web3.eth.getBalance(acc.address);
    console.log(balance)

    var count = await web3.eth.getTransactionCount(acc.address);
    var rawTransaction = {
        "from":acc.address,
        "gasPrice":web3.utils.toHex(50000000000),
        "gasLimit":web3.utils.toHex(290000),
        "to":pancakeSwapRouterAddress,
        "value":web3.utils.toHex(amountToBuyWith),
        "data":data.encodeABI(),
        "nonce":web3.utils.toHex(count)
    };

    var transaction = new Tx(rawTransaction, { 'common': BSC_FORK });
    transaction.sign(privateKey);

    var result = await web3.eth.sendSignedTransaction('0x' + transaction.serialize().toString('hex'));
    console.log(result)
    return result;
}
