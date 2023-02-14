import { ethers } from "./ethers-5.6.esm.min.js";
import { contractAddress, abi } from "./constants.js";

const connectButton = document.getElementById("connectButton");
const enterLotteryButton = document.getElementById("enterLotteryButton");
const connectResponse = document.getElementById("connectResponse");
const enterLotteryResponse = document.getElementById("enterLotteryResponse");

connectButton.addEventListener("click", () => {
    connect();
})

enterLotteryButton.addEventListener("click", () => {
    enterLottery();
})

window.onload = async() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const lottery = new ethers.Contract(contractAddress, abi, signer);
    const entranceFees = await lottery.getEntranceFees();
    const feesDisplay = document.getElementById("feeDisplay");
    feesDisplay.innerText = (entranceFees/1e18).toString() + " ETH";


    if (window.ethereum.selectedAddress != null) {
        const accountAddressShow = document.querySelector("#accountAddressShow span");
        let acctAddress = window.ethereum.selectedAddress;
        acctAddress = acctAddress.substring(0, 8) + "......" + acctAddress.substring(35);
        accountAddressShow.innerText = acctAddress;
        connectResponse.innerText = "Connected!";
    }
}


window.ethereum.on("accountsChanged", () => {
    const accountAddressShow = document.querySelector("#accountAddressShow span");
    let acctAddress = window.ethereum.selectedAddress;
    if (acctAddress == null) {
        accountAddressShow.innerText = "Connect your wallet from button below";
        connectResponse.innerText = "No wallets are Connected";
    }
    else {
        acctAddress = acctAddress.substring(0, 8) + "......" + acctAddress.substring(35);
        accountAddressShow.innerText = acctAddress;
        connectResponse.innerText = "Connected!";
    }
    enterLotteryResponse.innerText = "";
})

async function connect() {
    if (typeof window.ethereum != "undefined") {
        try {
            connectResponse.innerText = "Connecting.."
            await window.ethereum.request({method: "eth_requestAccounts"});  
            connectResponse.innerText = "Connected!";
        }
        catch(err) {
            if (err.message.toLowerCase().includes("user rejected the request.")) {
                connectResponse.innerText = "User rejected the request.";
            }
            else {
                connectResponse.innerText = "Error connecting to Wallet.";
            }
        }
    }
    else {
        connectResponse.innerText ="Metamask not Detected!";
    }

    const accountAddressShow = document.querySelector("#accountAddressShow span");
    let acctAddress = window.ethereum.selectedAddress;
    acctAddress = acctAddress.substring(0, 8) + "......" + acctAddress.substring(35);
    accountAddressShow.innerText = acctAddress;
}

async function enterLottery() {
    if (typeof window.ethereum == "undefined") {
        enterLotteryResponse.innerText = "No metamask wallet detected";
        return;
    }
    if (window.ethereum.selectedAddress == null) {
        connectResponse.innerText = "Please connect your wallet first"
        return;
    }

    enterLotteryResponse.innerText = "Processing...";

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const lottery = new ethers.Contract(contractAddress, abi, signer);
    const fees = await lottery.getEntranceFees();

    try {
        const response = await lottery.enterLottery({value: fees});
        enterLotteryResponse.innerText = "Almost there! Hold tight while we fetch your participation number";
        await new Promise((resolve, reject) => {
            lottery.once("participantEntry", () => {
                resolve();
            });
        }); 
        const participationId = await lottery.getNumberOfParticipants();
        enterLotteryResponse.innerText = `Voilla! You are registered. Sit back and wait. Your participation number is ${participationId}`;
    }
    catch (err) {
        if (err.message.toLowerCase().includes("user denied")) {
            enterLotteryResponse.innerText = "Rejected by User";
        }
        else {
            enterLotteryResponse.innerText = "Uh-Oh! Caught an Error";
        }
    }
}

async function winnerSelectedEventFunc() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const lottery = new ethers.Contract(contractAddress, abi, signer);
    const winnerResponse = document.getElementById("winnerResponse");
    
    lottery.on("WinnerSelected", async() => {
        const winner = await lottery.getRecentWinner();
        winnerResponse.innerText = winner;
    })
}

winnerSelectedEventFunc();