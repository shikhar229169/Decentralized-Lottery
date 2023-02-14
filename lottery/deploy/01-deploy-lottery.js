const { network, ethers } = require("hardhat");
const { networkConfig, namedNetworks } = require("../helper-hardhat-config.js");
const { verifyContract } = require("../utils/verification.js");
require("dotenv").config();

const VRF_SUB_FUND_AMT = ethers.utils.parseEther("2");

module.exports = async function({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let VRFCoordinatorV2, subscriptionId;
    let vrfCoordinatorV2Mock;


    if (namedNetworks.includes(network.name)) {
        console.log("Local Network Detetcted!");
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        // const vrfCoordinatorV2Mock = await deployments.get("VRFCoordinatorV2Mock");
        VRFCoordinatorV2 = vrfCoordinatorV2Mock.address;
        const txnResponse = await vrfCoordinatorV2Mock.createSubscription();
        const txnReceipt = await txnResponse.wait(1);
        subscriptionId = txnReceipt.events[0].args.subId;

        // Fund the subscription
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMT);
    }
    else {
        VRFCoordinatorV2 = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subId"];
    }

    const entranceFees = networkConfig[chainId]["entranceFees"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    const args = [VRFCoordinatorV2, entranceFees, gasLane, subscriptionId, callbackGasLimit, interval];
    
    const lottery = await deploy("Lottery", {
        from: deployer,
        log: true,
        args: args,
        waitConfirmations: network.config.blockConfirmations,
    });

    // Add the consumer for local network
    if (namedNetworks.includes(network.name)) {
        // here lottery.address is the consumer address of the contract for which we want to get randomness
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), lottery.address);
    }

    if (!namedNetworks.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verifyContract(lottery.address, args);
    }
}

module.exports.tags = ["all", "lottery"];