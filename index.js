require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const ethers = require('ethers');
const { parseEther } = require('ethers/lib/utils');
const axios = require('axios');
const Web3 = require('web3')
const Tx = require('ethereumjs-tx')


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

const {
    ChainId,
    Fetcher,
    WETH,
    Route,
    Trade,
    TokenAmount,
    TradeType,
    Percent,
    Token,
} = require('@pancakeswap-libs/sdk-v2')

const chainId = ChainId.MAINNET

let token
let weth
let provider
let signer
let uniswap

const ACCOUNT = process.env.ACCOUNT;
const GAS_GWEI = process.env.GAS_GWEI;
const GAS_LIMIT = process.env.GAS_LIMIT;
const TOKEN_ADDRESS = process.env.CONTRACT_ADDRESS;
const SLIPPAGE = parseInt(500);
const slippageTolerance = new Percent(SLIPPAGE, '100');
const EXCHANGE_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E'

provider = new ethers.providers.getDefaultProvider(process.env.RPC_URL);
const privateKey = process.env.PRIVATE_KEY;//new Buffer.from(process.env.PRIVATE_KEY, 'hex');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));
signer = new ethers.Wallet(privateKey, provider);

let minABI = [
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
  
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'name',
      outputs: [{ name: '', type: 'string' }],
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'symbol',
      outputs: [{ name: '', type: 'string' }],
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'amountETHMin',
      outputs: [{ name: '', type: 'uint256' }],
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'amountTokenDesired',
      outputs: [{ name: '', type: 'uint256' }],
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'totalSupply',
      outputs: [{ name: '', type: 'uint256' }],
      type: 'function',
    },
  ]

  uniswap = new ethers.Contract(
    EXCHANGE_ADDRESS,
    [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function approve(address spender, uint value) external returns (bool)',
    ],
    signer,
  )



app.post('/v1/token_info', async function (req, res) {

    let contractAddress = req.body.contract;

    token = await Fetcher.fetchTokenData(chainId, contractAddress, provider)
    weth = WETH[chainId]

    let contracts = new web3.eth.Contract(minABI, contractAddress)

    let tokenName = await contracts.methods.name().call();
    let tokenSymbol = await contracts.methods.symbol().call();
    let decimal = await contracts.methods.decimals().call();

    const pair = await Fetcher.fetchPairData(token, weth, provider);
    const route = new Route([pair], weth);
    const trade = new Trade(route, new TokenAmount(weth, 1000000000000000000),TradeType.EXACT_INPUT);

    //let Pprice = route.midPrice.invert().toSignificant(6);
    let Pprice = trade.executionPrice.toSignificant(6);
    //let con = web3.utils.fromWei(Pprice, 'ether')

    let results  = "Token Name: "+ tokenName + " Symbol: "+ tokenSymbol+ " Price: 1 BNB = "+ Pprice + " Digit = " + decimal + "";
    //let results  = "Price: 1 BNB = "+ Pprice + " ";
    return res.send({ error: false, data: results, message: 'success' });

});

app.post('/v1/buy', async function (req, res) {

    let ETH_AMOUNT = req.body.amount;
    let TOKENADDRESS = req.body.token;

    token = await Fetcher.fetchTokenData(chainId, TOKENADDRESS, provider);
    weth = WETH[chainId];
            
    let GAS = web3.utils.toWei(GAS_GWEI, 'gwei');

    gasPrice = Math.floor(GAS);
    gasLimit = Math.floor(GAS_LIMIT);
            
    try {

        const _ethAmount = ethers.utils.parseEther(ETH_AMOUNT)
        const pair = await Fetcher.fetchPairData(token, weth, provider)
        const route = new Route([pair], weth)
        const trade = new Trade(route, new TokenAmount(weth, _ethAmount),TradeType.EXACT_INPUT)
        const path = [weth.address, token.address]
            
        const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw
        const amountOutMinHex = ethers.BigNumber.from( amountOutMin.toString()).toHexString()
            
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20
        const deadlineHex = ethers.BigNumber.from(deadline.toString()).toHexString()
            
        const inputAmount = trade.inputAmount.raw
        const inputAmountHex = ethers.BigNumber.from(inputAmount.toString()).toHexString()
            
        const tx = await uniswap.swapExactETHForTokens(
            amountOutMinHex,
             path,
            ACCOUNT,
            deadlineHex,
            {
                    value: inputAmountHex,
                    gasPrice: ethers.BigNumber.from(gasPrice).toHexString(),
                    gasLimit: ethers.BigNumber.from(gasLimit).toHexString(),
            },
            )
            
        let trxReceipt = null
         while (trxReceipt == null) {
            trxReceipt = await web3.eth.getTransactionReceipt(tx.hash)
            await sleep(100)
        }
            
        if (trxReceipt.status == 1) {
            let results = "https://bscscan.com/tx/"+tx.hash;
            return res.send({ error: false, data: results, message: 'success' });
        } else {
            let results = "Error while swap, please check your account if there is enough BNB";
            return res.send({ error: true, data: results, message: 'failed' });
        }
    } catch (err) {
      console.log(err);
      let results = "Error while swap, please check your account if there is enough BNB";
      return res.send({ error: true, data: results, message: 'failed' });
       

    }

});

app.all("*", function (req, res, next) {
    return res.send('page not found');
    next();
});
    
app.listen(8080, function () {
    console.log('Node app is running on port 8080');
});
    
module.exports = app;